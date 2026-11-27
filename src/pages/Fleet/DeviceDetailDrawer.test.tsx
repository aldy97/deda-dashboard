import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { apiClient } from '../../api/client'
import DeviceDetailDrawer from './DeviceDetailDrawer'

/**
 * 设备详情抽屉的出口链接契约。
 *
 * 抽屉打开时渲染「这里是快速预览」提示与三条出口链接：
 * 设备档案、记忆档案、消息明细。关闭时不渲染任何链接。
 */
vi.mock('../../api/client', () => ({
  apiClient: { get: vi.fn() },
  TOKEN_KEY: 'deda_dashboard_token',
}))

const mockGet = apiClient.get as unknown as ReturnType<typeof vi.fn>

function makeFleetDetail(overrides: Record<string, unknown> = {}) {
  return {
    deviceId: 'dev-1',
    deviceUuid: 'uuid-1',
    characterKey: 'elly',
    deviceCode: 'D001',
    firmwareVersion: '1.2.3',
    macAddress: 'aa:bb:cc:dd:ee:ff',
    wifiName: 'MyWiFi',
    ipAddress: '192.168.1.100',
    networkType: 'wifi',
    timezone: 'Asia/Shanghai',
    createdAt: '2026-01-01T00:00:00.000Z',
    realtime: {
      online: true,
      battery: 85,
      volume: 60,
      version: '1.2.3',
      charging: false,
      lastSeenAt: 1700000000000,
    },
    boundUsers: [],
    presence: [],
    dailyTurns: [],
    totals: { presenceDays: 7, turns: 42 },
    ...overrides,
  }
}

function renderDrawer(deviceId: string | null, onClose = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DeviceDetailDrawer deviceId={deviceId} onClose={onClose} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('DeviceDetailDrawer · 出口链接', () => {
  it('关闭时不渲染任何链接', () => {
    renderDrawer(null)
    expect(screen.queryByText(/快速预览/)).toBeNull()
    expect(screen.queryByText(/查看设备 360/)).toBeNull()
  })

  it('打开展示"快速预览"提示文案', async () => {
    mockGet.mockResolvedValueOnce({ data: makeFleetDetail() })
    renderDrawer('dev-1')
    expect(await screen.findByText(/快速预览/)).toBeTruthy()
    expect(screen.getByText(/完整设备 360/)).toBeTruthy()
  })

  it('渲染设备档案链接', async () => {
    mockGet.mockResolvedValueOnce({ data: makeFleetDetail() })
    renderDrawer('dev-1')
    const link = await screen.findByRole('link', { name: /设备档案/ })
    expect(link).toBeTruthy()
    expect(link.getAttribute('href')).toBe('/users/dev-1')
  })

  it('渲染记忆档案链接', async () => {
    mockGet.mockResolvedValueOnce({ data: makeFleetDetail() })
    renderDrawer('dev-1')
    const link = await screen.findByRole('link', { name: /记忆档案/ })
    expect(link).toBeTruthy()
    expect(link.getAttribute('href')).toBe('/memories/dev-1')
  })

  it('渲染消息明细链接', async () => {
    mockGet.mockResolvedValueOnce({ data: makeFleetDetail() })
    renderDrawer('dev-1')
    const link = await screen.findByRole('link', { name: /消息明细/ })
    expect(link).toBeTruthy()
    expect(link.getAttribute('href')).toBe('/messages?deviceId=dev-1')
  })
})

/**
 * 抽屉正文与设备档案页共用 src/components/device/DeviceProfile.tsx，
 * 这里补 boundUsers 非空的分支（设备档案页的 fixture 走的是空数组分支）。
 */
describe('DeviceProfile · 绑定用户', () => {
  it('boundUsers 非空时渲染 userId / 主账号标签，且不暴露 PII 字段', async () => {
    mockGet.mockResolvedValueOnce({
      data: makeFleetDetail({
        boundUsers: [
          {
            userId: 'user-owner',
            isOwner: true,
            boundAt: '2026-03-01T08:00:00.000Z',
          },
          {
            userId: 'user-member',
            isOwner: false,
            boundAt: '2026-04-02T09:30:00.000Z',
          },
        ],
      }),
    })
    renderDrawer('dev-1')

    expect(await screen.findByText('user-owner')).toBeTruthy()
    expect(screen.getByText('user-member')).toBeTruthy()
    expect(screen.getByText('主账号')).toBeTruthy()
    expect(screen.queryByText('暂无绑定用户')).toBeNull()
    // 绑定时间按本地时区格式化：CI 跑 UTC、本地 Asia/Shanghai，只断言日期
    expect(screen.getAllByText(/2026-03-01/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/2026-04-02/).length).toBeGreaterThanOrEqual(1)
  })

  it('绑定用户表的 userId 点得进家长档案，文本仍是 userId 以便复制', async () => {
    mockGet.mockResolvedValueOnce({
      data: makeFleetDetail({
        boundUsers: [
          {
            userId: 'user-owner',
            isOwner: true,
            boundAt: '2026-03-01T08:00:00.000Z',
          },
        ],
      }),
    })
    renderDrawer('dev-1')

    const link = await screen.findByRole('link', { name: 'user-owner' })
    expect(link.textContent).toBe('user-owner')
    expect(link.getAttribute('href')).toBe('/parents/user-owner')
  })

  it('boundUsers 为空时给空态而不是一张空表', async () => {
    mockGet.mockResolvedValueOnce({ data: makeFleetDetail() })
    renderDrawer('dev-1')
    expect(await screen.findByText('暂无绑定用户')).toBeTruthy()
  })
})

/**
 * 孩子信息 section 装配契约：设备存在时渲染并查询档案；
 * 设备 404 时 section 不挂载（child-profile 查询零触发，404 由抽屉错误态兜）。
 */
describe('DeviceDetailDrawer · 孩子信息 section', () => {
  it('设备存在时渲染孩子信息 section 并查询档案', async () => {
    mockGet
      .mockResolvedValueOnce({ data: makeFleetDetail() })
      .mockResolvedValueOnce({ data: { profile: null } })
    renderDrawer('dev-1')

    expect(await screen.findByText('未设置孩子档案')).toBeTruthy()
    expect(mockGet).toHaveBeenCalledWith('/analytics/fleet/devices/dev-1', {
      params: { days: 30 },
    })
    expect(mockGet).toHaveBeenCalledWith(
      '/analytics/fleet/devices/dev-1/child-profile',
    )
  })

  it('设备 404 时不挂载 section，child-profile 查询零触发', async () => {
    const err = Object.assign(new Error('not found'), { status: 404 })
    mockGet.mockRejectedValueOnce(err)
    renderDrawer('ghost-1')

    expect(await screen.findByText('设备不存在')).toBeTruthy()
    expect(screen.queryByText('孩子信息')).toBeNull()
    expect(mockGet).toHaveBeenCalledTimes(1)
  })
})
