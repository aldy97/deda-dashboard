import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { apiClient } from '../../api/client'
import Fleet from './index'

/**
 * 设备舰队页 · URL 驱动抽屉。
 *
 * ?deviceId=X 进入时自动打开设备详情抽屉；
 * 关闭抽屉清键（replace）；刷新/分享可还原。
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

function makeDeviceDetail() {
  return {
    deviceId: 'dev-drawer',
    deviceUuid: 'uuid-dd',
    characterKey: 'elly',
    deviceCode: 'D-DD',
    firmwareVersion: '2.0.0',
    macAddress: '11:22:33:44:55:66',
    wifiName: 'TestWiFi',
    ipAddress: '10.0.0.1',
    networkType: 'wifi',
    timezone: 'Asia/Shanghai',
    createdAt: '2026-06-01T00:00:00.000Z',
    realtime: {
      online: true,
      battery: 90,
      volume: 50,
      version: '2.0.0',
      charging: false,
      lastSeenAt: 1700000000000,
    },
    boundUsers: [],
    presence: [],
    dailyTurns: [],
    totals: { presenceDays: 10, turns: 80 },
  }
}

function stubAllApi() {
  mockGet.mockImplementation((url: string) => {
    if (url === '/analytics/fleet/summary') {
      return Promise.resolve({
        data: {
          date: '2026-11-13',
          totalDevices: 100,
          activatedDevices: 80,
          devicesPoweredOn: 60,
          powerOnRate: 0.75,
          onlineNow: 40,
          lowBatteryNow: 5,
          lowBatteryThreshold: 20,
          lowBatteryRate: 0.0625,
        },
      })
    }
    if (url === '/analytics/fleet/presence-trend') {
      return Promise.resolve({
        data: {
          startDate: '2026-10-15',
          endDate: '2026-11-13',
          presenceSince: '2026-01-01',
          series: [],
        },
      })
    }
    if (url === '/analytics/fleet/firmware-distribution') {
      return Promise.resolve({
        data: { total: 100, buckets: [] },
      })
    }
    if (url === '/analytics/fleet/churn-risk') {
      return Promise.resolve({
        data: { days: 7, asOf: '2026-11-13', count: 0, devices: [] },
      })
    }
    if (url === '/analytics/fleet/devices') {
      return Promise.resolve({
        data: { page: 1, pageSize: 20, total: 0, items: [] },
      })
    }
    if (url.startsWith('/analytics/fleet/devices/')) {
      return Promise.resolve({ data: makeDeviceDetail() })
    }
    return Promise.resolve({ data: null })
  })
}

function renderPage(entry = '/fleet') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <Fleet />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function search(): string {
  return screen.getByTestId('search').textContent ?? ''
}

describe('设备舰队页 · URL 驱动抽屉', () => {
  beforeEach(() => {
    mockGet.mockReset()
    stubAllApi()
  })

  it('不带 ?deviceId= 时不打开抽屉', async () => {
    renderPage('/fleet')
    await screen.findByText('设备舰队')
    // 抽屉标题不应该出现
    expect(screen.queryByText(/设备详情/)).toBeNull()
  })

  it('?deviceId=X 进入时自动打开抽屉', async () => {
    renderPage('/fleet?deviceId=dev-drawer')
    await screen.findByText('设备舰队')
    await waitFor(() => {
      expect(screen.getByText(/设备详情/)).toBeTruthy()
    })
    expect(search()).toContain('deviceId=dev-drawer')
  })

  it('关闭抽屉清掉 ?deviceId= 键', async () => {
    renderPage('/fleet?deviceId=dev-drawer')
    await screen.findByText('设备舰队')
    await waitFor(() => {
      expect(screen.getByText(/设备详情/)).toBeTruthy()
    })

    // 点关闭按钮（Drawer 的 X）
    const closeBtn = document.querySelector('.ant-drawer-close')
    expect(closeBtn).not.toBeNull()
    fireEvent.click(closeBtn as Element)

    await waitFor(() => {
      expect(search()).not.toContain('deviceId')
    })
  })

  it('刷新/分享可还原：?deviceId= 在 URL 中且抽屉内容渲染', async () => {
    renderPage('/fleet?deviceId=dev-drawer')
    await screen.findByText('设备舰队')
    await waitFor(() => {
      expect(screen.getByText(/设备详情/)).toBeTruthy()
    })
    // drawer 内容渲染（设备 ID 显示在标题和内容中）
    const devDrawerTexts = screen.getAllByText('dev-drawer')
    expect(devDrawerTexts.length).toBeGreaterThanOrEqual(1)
    // 确认是从 URL 读取的
    expect(search()).toContain('deviceId=dev-drawer')
  })
})
