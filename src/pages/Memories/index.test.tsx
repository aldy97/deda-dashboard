import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { apiClient } from '../../api/client'
import Memories from './index'
import type {
  MemoriesOverviewResponse,
  MemoryDevicesResponse,
} from '../../types/analytics'

/**
 * 记忆档案列表页跨页出口。
 * 设备列表行的「消息」链接 → /messages?deviceId=<id>，且 stopPropagation 不触发行跳转。
 */

vi.mock('../../api/client', () => ({
  apiClient: { get: vi.fn() },
  TOKEN_KEY: 'deda_dashboard_token',
}))

const mockGet = apiClient.get as unknown as ReturnType<typeof vi.fn>

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}{location.search}</div>
}

const OVERVIEW: MemoriesOverviewResponse = {
  deviceTotal: 100,
  deviceWithMemories: 60,
  deviceCoverage: 0.6,
  totalActiveMemories: 120,
  totalVersions: 300,
  slotCoverage: [
    { key: 'nickname', deviceCount: 55, coverage: 0.55 },
    { key: 'favorite_color', deviceCount: 40, coverage: 0.4 },
    { key: 'favorite_animal', deviceCount: 38, coverage: 0.38 },
    { key: 'favorite_story_type', deviceCount: 50, coverage: 0.5 },
    { key: 'personality', deviceCount: 45, coverage: 0.45 },
  ],
}

function makeDevices(): MemoryDevicesResponse {
  return {
    total: 1,
    page: 1,
    pageSize: 20,
    items: [
      {
        deviceId: 'DEV001',
        deviceCode: 'D001',
        activeCount: 3,
        totalVersions: 8,
        lastChangeAt: '2026-11-14T10:00:00.000Z',
      },
    ],
  }
}

function renderPage(entry = '/memories') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <Memories />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Memories 设备列表跨页出口', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockGet.mockImplementation((url: string) => {
      if (url === '/analytics/memories/overview') {
        return Promise.resolve({ data: OVERVIEW })
      }
      if (url.startsWith('/analytics/memories/devices')) {
        return Promise.resolve({ data: makeDevices() })
      }
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
  })

  it('设备列表行渲染「消息」链接 → /messages?deviceId=<id>', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('DEV001')).toBeTruthy()
    })

    const msgLink = screen.getByText('消息')
    expect(msgLink).toBeTruthy()
    expect(msgLink.getAttribute('href')).toBe('/messages?deviceId=DEV001')
  })

  it('点「消息」不触发行跳转到 /memories/:deviceId', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('DEV001')).toBeTruthy()
    })

    const msgLink = screen.getByText('消息')
    // stopPropagation: 点消息链接不应触发行点击 → URL 应来自 Link（/messages?deviceId=）
    // 而非行 onClick（/memories/DEV001）
    fireEvent.click(msgLink)
    const probe = screen.getByTestId('location')
    expect(probe.textContent).toContain('/messages?deviceId=')
    expect(probe.textContent).not.toContain('/memories/DEV001')
  })
})
