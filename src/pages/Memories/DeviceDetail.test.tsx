import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { apiClient } from '../../api/client'
import DeviceDetail from './DeviceDetail'
import type {
  CurrentMemoriesResponse,
  MemoryHistoryResponse,
} from '../../types/analytics'

/**
 * 记忆设备详情页跨页出口。
 * 头部区域：设备档案 → /users/:deviceId、该设备全部消息 → /messages?deviceId=<id>
 */

vi.mock('../../api/client', () => ({
  apiClient: { get: vi.fn() },
  TOKEN_KEY: 'deda_dashboard_token',
}))

const mockGet = apiClient.get as unknown as ReturnType<typeof vi.fn>

const CURRENT: CurrentMemoriesResponse = {
  deviceId: 'DEV001',
  memories: [
    {
      key: 'nickname',
      valueText: '小宝',
      version: 3,
      confidence: 0.9,
      injectionCount: 15,
      lastInjectedAt: '2026-11-14T09:00:00.000Z',
      lastConfirmedAt: '2026-11-13T08:00:00.000Z',
      validFrom: '2026-11-10T00:00:00.000Z',
    },
    {
      key: 'favorite_color',
      valueText: '蓝色',
      version: 2,
      confidence: 0.85,
      injectionCount: 10,
      lastInjectedAt: '2026-11-14T09:00:00.000Z',
      lastConfirmedAt: '2026-11-13T08:00:00.000Z',
      validFrom: '2026-11-10T00:00:00.000Z',
    },
    {
      key: 'favorite_animal',
      valueText: '大象',
      version: 1,
      confidence: 0.8,
      injectionCount: 8,
      lastInjectedAt: '2026-11-14T09:00:00.000Z',
      lastConfirmedAt: '2026-11-12T08:00:00.000Z',
      validFrom: '2026-11-10T00:00:00.000Z',
    },
    {
      key: 'favorite_story_type',
      valueText: '冒险故事',
      version: 4,
      confidence: 0.92,
      injectionCount: 20,
      lastInjectedAt: '2026-11-14T09:00:00.000Z',
      lastConfirmedAt: '2026-11-14T07:00:00.000Z',
      validFrom: '2026-11-10T00:00:00.000Z',
    },
    {
      key: 'personality',
      valueText: '活泼好奇',
      version: 2,
      confidence: 0.88,
      injectionCount: 12,
      lastInjectedAt: '2026-11-14T09:00:00.000Z',
      lastConfirmedAt: '2026-11-13T09:00:00.000Z',
      validFrom: '2026-11-10T00:00:00.000Z',
    },
  ],
}

const HISTORY: MemoryHistoryResponse = {
  deviceId: 'DEV001',
  key: 'nickname',
  versions: [
    {
      id: 'v1',
      version: 3,
      changeType: 'supersede',
      status: 'active',
      valueText: '小宝',
      confidence: 0.9,
      sourceTurnId: 'turn-abc-123',
      validFrom: '2026-11-10T00:00:00.000Z',
      validTo: null,
      createdAt: '2026-11-10T06:00:00.000Z',
    },
  ],
}

function renderPage(entry = '/memories/DEV001') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/memories/:deviceId" element={<DeviceDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('DeviceDetail 跨页出口', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockGet.mockImplementation((url: string) => {
      if (url === '/analytics/memories/current') {
        return Promise.resolve({ data: CURRENT })
      }
      if (url === '/analytics/memories/history') {
        return Promise.resolve({ data: HISTORY })
      }
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
  })

  it('头部渲染设备档案链接 → /users/DEV001', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/设备档案/)).toBeTruthy()
    })
    const link = screen.getByText(/设备档案/)
    expect(link.getAttribute('href')).toBe('/users/DEV001')
  })

  it('头部渲染该设备全部消息链接 → /messages?deviceId=DEV001', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/全部消息/)).toBeTruthy()
    })
    const link = screen.getByText(/全部消息/)
    expect(link.getAttribute('href')).toBe('/messages?deviceId=DEV001')
  })
})
