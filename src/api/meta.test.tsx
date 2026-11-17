import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { apiClient } from './client'
import { META_QUERY_KEY, fetchAnalyticsMeta, useAnalyticsMeta } from './meta'

/**
 * 契约守卫：锁死 /analytics/meta 的路径与「整站共用一份结论」的缓存口径。
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
  // 与 src/api/queryClient.ts 的生产配置对齐（retry 关掉以免测试变慢）
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

const META = {
  nodeEnv: 'staging',
  promptWriteEnabled: true,
  publishConfirmCode: 'DEDA2025',
}

describe('analytics meta 接口层', () => {
  it('走 GET /analytics/meta 并剥壳返回', async () => {
    respondWith(META)

    await expect(fetchAnalyticsMeta()).resolves.toEqual(META)
    expect(mockGet).toHaveBeenCalledWith('/analytics/meta')
  })

  it('queryKey 固定，环境标签与发布闸口读到同一份缓存', async () => {
    respondWith(META)
    const wrapper = createWrapper()

    const first = renderHook(() => useAnalyticsMeta(), { wrapper })
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true))
    const second = renderHook(() => useAnalyticsMeta(), { wrapper })
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true))

    expect(META_QUERY_KEY).toEqual(['analytics', 'meta'])
    expect(second.result.current.data).toEqual(META)
    // staleTime: Infinity —— 第二个消费者不得再发一次请求
    expect(mockGet).toHaveBeenCalledTimes(1)
  })

  it('接口失败时 isError 为真且不伪造 nodeEnv（前端据此 fail-closed）', async () => {
    mockGet.mockRejectedValue(new Error('network down'))
    const { result } = renderHook(() => useAnalyticsMeta(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
  })
})
