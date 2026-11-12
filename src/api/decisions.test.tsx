import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { apiClient } from './client'
import {
  fetchIntentSummary,
  fetchIntentTrend,
  fetchReviewQueue,
  fetchSafetySummary,
  fetchSafetyTrend,
} from './analytics'
import {
  useIntentSummary,
  useIntentTrend,
  useReviewQueue,
  useSafetySummary,
  useSafetyTrend,
} from './queries'

/**
 * 契约守卫：锁死五个 decisions 接口的 URL 与参数透传。
 * apiClient 的响应拦截器会剥掉 { code, message, data } 信封，
 * 所以这里 mock 成已剥壳的形状（真实调用见 client.ts）。
 */
vi.mock('./client', () => ({
  apiClient: { get: vi.fn() },
}))

const mockGet = apiClient.get as unknown as ReturnType<typeof vi.fn>

function respondWith(data: unknown) {
  mockGet.mockResolvedValue({ data })
}

function createWrapper() {
  // 与 src/api/queryClient.ts 的生产配置对齐（retry 关掉以免测试变慢）：
  // staleTime 5min 是「同参数不重复发请求」这条断言成立的前提
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

const range = { startDate: '2026-11-06', endDate: '2026-11-12' }

describe('decisions 接口层', () => {
  it('safety-summary 走对路径并透传日期闭区间', async () => {
    respondWith({ total: 1 })
    const data = await fetchSafetySummary(range)

    expect(mockGet).toHaveBeenCalledWith('/analytics/decisions/safety-summary', {
      params: range,
    })
    expect(data).toEqual({ total: 1 })
  })

  it('safety-trend 透传 granularity', async () => {
    respondWith({ granularity: 'week', series: [] })
    await fetchSafetyTrend({ ...range, granularity: 'week' })

    expect(mockGet).toHaveBeenCalledWith('/analytics/decisions/safety-trend', {
      params: { ...range, granularity: 'week' },
    })
  })

  it('intent-summary 走对路径', async () => {
    respondWith({ total: 0 })
    await fetchIntentSummary(range)

    expect(mockGet).toHaveBeenCalledWith('/analytics/decisions/intent-summary', {
      params: range,
    })
  })

  it('intent-trend 透传 granularity', async () => {
    respondWith({ granularity: 'month', series: [] })
    await fetchIntentTrend({ ...range, granularity: 'month' })

    expect(mockGet).toHaveBeenCalledWith('/analytics/decisions/intent-trend', {
      params: { ...range, granularity: 'month' },
    })
  })

  it('review-queue 透传分页、类别、设备与排序（服务端分页）', async () => {
    respondWith({ total: 0, page: 2, pageSize: 50, items: [] })
    const query = {
      ...range,
      category: 'self_harm',
      deviceId: 'dev-uuid',
      page: 2,
      pageSize: 50,
      sort: 'createdAt_asc' as const,
    }
    await fetchReviewQueue(query)

    expect(mockGet).toHaveBeenCalledWith('/analytics/decisions/review-queue', {
      params: query,
    })
  })
})

describe('decisions hooks 层', () => {
  it('四个概览/趋势 hook 都能取到数据', async () => {
    const wrapper = createWrapper()
    respondWith({ ok: true })

    const cases = [
      [useSafetySummary, range],
      [useSafetyTrend, range],
      [useIntentSummary, range],
      [useIntentTrend, range],
    ] as const

    for (const [hook, params] of cases) {
      const { result, unmount } = renderHook(() => hook(params), { wrapper })
      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual({ ok: true })
      unmount()
    }
  })

  it('相同参数的 queryKey 命中缓存，不重复发请求', async () => {
    const wrapper = createWrapper()
    respondWith({ total: 7 })

    const first = renderHook(() => useSafetySummary(range), { wrapper })
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true))
    const callsAfterFirst = mockGet.mock.calls.length

    const second = renderHook(() => useSafetySummary(range), { wrapper })
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true))
    expect(mockGet.mock.calls.length).toBe(callsAfterFirst)
  })

  it('复核队列翻页时保留上一页数据（placeholderData），避免表格闪空', async () => {
    const wrapper = createWrapper()
    const page1 = { total: 45, page: 1, pageSize: 20, items: [{ turnId: 'a' }] }
    const page2 = { total: 45, page: 2, pageSize: 20, items: [{ turnId: 'b' }] }
    respondWith(page1)

    const { result, rerender } = renderHook(
      ({ page }: { page: number }) =>
        useReviewQueue({ ...range, page, pageSize: 20 }),
      { wrapper, initialProps: { page: 1 } },
    )
    await waitFor(() => expect(result.current.data).toEqual(page1))

    respondWith(page2)
    rerender({ page: 2 })
    // 新请求在飞，旧数据仍在，表格不会闪成空态
    expect(result.current.data).toEqual(page1)
    await waitFor(() => expect(result.current.data).toEqual(page2))
  })
})
