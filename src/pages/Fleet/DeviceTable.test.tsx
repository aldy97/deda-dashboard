import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { apiClient } from '../../api/client'
import DeviceTable from './DeviceTable'

/**
 * 设备明细表的下钻链接契约。
 *
 * 设备 ID 列是到 /users/:deviceId 的 Link（行内链接 stopPropagation）；
 * 操作列「详情」触发 onOpenDevice 回调。
 */
vi.mock('../../api/client', () => ({
  apiClient: { get: vi.fn() },
  TOKEN_KEY: 'deda_dashboard_token',
}))

const mockGet = apiClient.get as unknown as ReturnType<typeof vi.fn>

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="search">{location.search}</div>
}

function makeDeviceItem(deviceId: string, overrides: Record<string, unknown> = {}) {
  return {
    deviceId,
    deviceUuid: `uuid-${deviceId}`,
    characterKey: 'elly',
    deviceCode: `D-${deviceId}`,
    firmwareVersion: '1.0.0',
    macAddress: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    boundUsers: 1,
    realtime: null,
    presenceDays7d: 5,
    lastPresenceDate: '2026-11-10',
    turns7d: 20,
    testWhitelist: null,
    ...overrides,
  }
}

function renderTable(
  onOpenDevice = vi.fn(),
  items: Record<string, unknown>[] = [
    makeDeviceItem('dev-001'),
    makeDeviceItem('dev-002'),
  ],
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false },
    },
  })

  mockGet.mockResolvedValue({
    data: {
      page: 1,
      pageSize: 20,
      total: items.length,
      items,
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/fleet']}>
        <DeviceTable onOpenDevice={onOpenDevice} />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('DeviceTable · 下钻链接', () => {
  beforeEach(() => {
    mockGet.mockReset()
  })

  it('设备 ID 列是到 /users/:deviceId 的 Link', async () => {
    renderTable()
    const link = await screen.findByText('dev-001')
    const anchor = link.closest('a')
    expect(anchor).toBeTruthy()
    expect(anchor!.getAttribute('href')).toBe('/users/dev-001')
  })

  it('第二行设备 ID 也正确链接', async () => {
    renderTable()
    const link = await screen.findByText('dev-002')
    const anchor = link.closest('a')
    expect(anchor).toBeTruthy()
    expect(anchor!.getAttribute('href')).toBe('/users/dev-002')
  })

  it('操作列"详情"按钮触发 onOpenDevice', async () => {
    const onOpenDevice = vi.fn()
    renderTable(onOpenDevice)
    await screen.findByText('dev-001')

    const detailLinks = screen.getAllByText('详情')
    expect(detailLinks.length).toBeGreaterThanOrEqual(1)

    fireEvent.click(detailLinks[0])
    expect(onOpenDevice).toHaveBeenCalledWith('dev-001')
  })

  it('点击设备 ID 链接时不会触发行事件（stopPropagation）', async () => {
    const onOpenDevice = vi.fn()
    renderTable(onOpenDevice)
    await screen.findByText('dev-001')

    const link = screen.getByText('dev-001').closest('a')!
    fireEvent.click(link)
    // 设备 ID 链接不应触发 onOpenDevice（行点击被阻止冒泡了）
    expect(onOpenDevice).not.toHaveBeenCalled()
  })
})

describe('DeviceTable · 测试白名单标签', () => {
  beforeEach(() => {
    mockGet.mockReset()
  })

  it('在白名单且有备注时，设备 ID 列显示备注 Tag（黄色）', async () => {
    renderTable(vi.fn(), [
      makeDeviceItem('dev-001', {
        testWhitelist: { note: '3 号样机-熊枫' },
      }),
    ])
    await screen.findByText('dev-001')

    const tag = screen.getByText('3 号样机-熊枫')
    expect(tag.className).toContain('ant-tag')
    expect(tag.className).toContain('ant-tag-gold')
  })

  it('在白名单但备注为空时显示「白名单」', async () => {
    renderTable(vi.fn(), [
      makeDeviceItem('dev-001', { testWhitelist: { note: null } }),
      makeDeviceItem('dev-002', { testWhitelist: { note: '   ' } }),
    ])
    await screen.findByText('dev-001')

    expect(screen.getAllByText('白名单')).toHaveLength(2)
  })

  it('不在白名单（testWhitelist=null）时不显示任何 Tag', async () => {
    renderTable()
    await screen.findByText('dev-001')

    expect(screen.queryByText('白名单')).toBeNull()
    expect(document.querySelectorAll('.ant-tag-gold')).toHaveLength(0)
  })

  it('备注标签与设备 ID 同一行，左边缘固定对齐且 Tag 不被拉伸', async () => {
    renderTable(vi.fn(), [
      makeDeviceItem('aabbccddeeff', {
        testWhitelist: { note: '3 号样机-熊枫' },
      }),
    ])
    const link = await screen.findByText('aabbccddeeff')
    const tag = screen.getByText('3 号样机-熊枫')
    const cell = screen.getByTestId('device-id-cell')
    const tagSlot = screen.getByTestId('device-whitelist-tag')

    // 第一列固定宽度：设备 ID 长短不影响第二列 Tag 的左边缘
    expect(cell.style.display).toBe('grid')
    expect(cell.style.gridTemplateColumns).toBe('104px minmax(0px, 1fr)')
    expect(cell.style.columnGap).toBe('4px')
    expect(cell.contains(tag)).toBe(true)
    expect(cell.children[1]).toBe(tagSlot)
    expect(tagSlot.contains(tag)).toBe(true)

    // 只对齐左边缘：Tag 宽度由备注内容决定，右侧不拉伸
    expect(tagSlot.style.justifySelf).toBe('start')

    // 超长设备 ID 在自己的第一列内省略，不推挤 Tag
    expect(tag.style.flexShrink).toBe('0')
    expect(link.style.minWidth).toBe('0px')
    expect(link.style.textOverflow).toBe('ellipsis')
    expect(link.getAttribute('title')).toBe('aabbccddeeff')
  })
})
