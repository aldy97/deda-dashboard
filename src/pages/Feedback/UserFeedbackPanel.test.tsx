import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { apiClient } from '../../api/client'
import UserFeedbackPanel from './UserFeedbackPanel'
import type { UserFeedbackListResponse } from '../../types/analytics'

vi.mock('../../api/client', () => ({
  apiClient: { get: vi.fn() },
  TOKEN_KEY: 'deda_dashboard_token',
}))

const mockGet = apiClient.get as unknown as ReturnType<typeof vi.fn>

const EMPTY_RESPONSE: UserFeedbackListResponse = {
  total: 0,
  page: 1,
  pageSize: 20,
  items: [],
}

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="search">{location.search}</div>
}

function renderPanel(entry = '/feedback?tab=user') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <UserFeedbackPanel />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function search(): string {
  return screen.getByTestId('search').textContent ?? ''
}

/** 最后一次 /analytics/feedback/user-feedbacks 调用的查询参数 */
function lastUserFeedbackParams(): Record<string, unknown> | undefined {
  const calls = mockGet.mock.calls.filter(
    (call: unknown[]) => call[0] === '/analytics/feedback/user-feedbacks',
  )
  if (calls.length === 0) return undefined
  return (calls[calls.length - 1][1] as { params?: Record<string, unknown> })?.params
}

describe('UserFeedbackPanel · deviceId 预筛', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockGet.mockResolvedValue({ data: EMPTY_RESPONSE })
  })

  it('?deviceId= 传入后 API 请求带 deviceId 参数', async () => {
    renderPanel('/feedback?tab=user&deviceId=dev-abc')

    await waitFor(() => {
      const params = lastUserFeedbackParams()
      expect(params?.deviceId).toBe('dev-abc')
    })
  })

  it('无 ?deviceId= 时 API 请求不带 deviceId', async () => {
    renderPanel('/feedback?tab=user')

    // 先确认请求真的发出去了，否则「deviceId 是 undefined」会因为根本没调用而假通过
    await waitFor(() => {
      expect(lastUserFeedbackParams()).toBeDefined()
    })
    expect(lastUserFeedbackParams()?.deviceId).toBeUndefined()
  })

  it('渲染可关闭 Tag「设备：X」', async () => {
    renderPanel('/feedback?tab=user&deviceId=dev-abc')

    expect(await screen.findByText(/设备：dev-abc/)).toBeTruthy()
  })

  it('关闭 Tag 后清掉 deviceId 并恢复全量', async () => {
    renderPanel('/feedback?tab=user&deviceId=dev-abc')

    const tag = await screen.findByText(/设备：dev-abc/)
    const closeBtn = tag.querySelector('.ant-tag-close-icon')
    expect(closeBtn).not.toBeNull()
    fireEvent.click(closeBtn as Element)

    // URL 不再有 deviceId
    await waitFor(() => {
      expect(search()).not.toContain('deviceId')
    })

    // API 请求也不带 deviceId
    const params = lastUserFeedbackParams()
    expect(params?.deviceId).toBeUndefined()
  })
})