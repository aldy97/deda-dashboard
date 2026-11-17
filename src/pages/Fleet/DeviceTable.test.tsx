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
    ...overrides,
  }
}

function renderTable(onOpenDevice = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false },
    },
  })

  mockGet.mockResolvedValue({
    data: {
      page: 1,
      pageSize: 20,
      total: 2,
      items: [
        makeDeviceItem('dev-001'),
        makeDeviceItem('dev-002'),
      ],
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
