import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { apiClient } from './client'
import {
  TEST_DEVICES_KEY,
  addTestDevice,
  fetchAllTestDevices,
  fetchTestDevices,
  revokeTestDevice,
  useAddTestDevice,
  useAllTestDevices,
  useRevokeTestDevice,
  useTestDevices,
} from './testDevices'

vi.mock('./client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
}))

const mockGet = apiClient.get as unknown as ReturnType<typeof vi.fn>
const mockPost = apiClient.post as unknown as ReturnType<typeof vi.fn>

const ITEM = {
  id: 'wl-1',
  active: true,
  note: '3 号样机',
  addedBy: 'alice',
  addedAt: '2026-11-22T10:00:00.000Z',
  addedReason: '需要验证新一集',
  revokedBy: null,
  revokedAt: null,
  revokeReason: null,
  device: {
    id: 'dev-uuid-1',
    deviceId: 'aa:bb:cc:dd:ee:ff',
    deviceCode: 'CN-001',
    macAddress: 'AA:BB:CC:DD:EE:FF',
    characterKey: 'elly',
    firmwareVersion: '1.2.3',
  },
}

const LIST = {
  enabled: { adventure: true, sleep: true },
  items: [ITEM],
  total: 1,
}

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        retry: false,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

describe('testDevices 读接口', () => {
  it('GET /analytics/test-devices 原样透传筛选参数', async () => {
    mockGet.mockResolvedValue({ data: LIST })

    await expect(
      fetchTestDevices({
        keyword: 'aa:bb',
        includeRevoked: true,
        page: 2,
        pageSize: 10,
      }),
    ).resolves.toEqual(LIST)

    expect(mockGet).toHaveBeenCalledWith('/analytics/test-devices', {
      params: {
        keyword: 'aa:bb',
        includeRevoked: true,
        page: 2,
        pageSize: 10,
      },
    })
  })

  it('不带筛选时也不拼多余的 query', async () => {
    mockGet.mockResolvedValue({ data: LIST })

    await fetchTestDevices()

    expect(mockGet).toHaveBeenCalledWith('/analytics/test-devices', {
      params: {},
    })
  })
})

describe('testDevices 写接口', () => {
  it('POST 添加白名单', async () => {
    const result = { item: ITEM, reactivated: false }
    mockPost.mockResolvedValue({ data: result })

    await expect(
      addTestDevice({
        deviceId: 'CN-001',
        note: '3 号样机',
        reason: '需要验证新一集',
      }),
    ).resolves.toEqual(result)

    expect(mockPost).toHaveBeenCalledWith('/analytics/test-devices', {
      deviceId: 'CN-001',
      note: '3 号样机',
      reason: '需要验证新一集',
    })
  })

  it('POST revoke 对设备号做 URL 编码', async () => {
    mockPost.mockResolvedValue({
      data: { ok: true, clearedAdventureAssignment: true },
    })

    await revokeTestDevice('AA:BB/1', '验证结束，收回资格')

    expect(mockPost).toHaveBeenCalledWith(
      '/analytics/test-devices/AA%3ABB%2F1/revoke',
      { reason: '验证结束，收回资格' },
    )
  })
})

describe('testDevices 全量列表（样机下发下拉）', () => {
  function page(count: number, total: number) {
    return {
      data: {
        enabled: { adventure: true, sleep: true },
        items: Array.from({ length: count }, (_, i) => ({
          ...ITEM,
          id: `wl-${i}`,
        })),
        total,
      },
    }
  }

  it('按 200 一页把白名单拉全，并透出截断标记', async () => {
    mockGet
      .mockResolvedValueOnce({
        data: { ...LIST, items: [ITEM, ITEM], total: 3 },
      })
      .mockResolvedValueOnce({
        data: { ...LIST, items: [ITEM], total: 3 },
      })

    const result = await fetchAllTestDevices()

    expect(result.items).toHaveLength(3)
    expect(result.truncated).toBe(false)
    expect(mockGet).toHaveBeenNthCalledWith(1, '/analytics/test-devices', {
      params: { page: 1, pageSize: 200 },
    })
    expect(mockGet).toHaveBeenNthCalledWith(2, '/analytics/test-devices', {
      params: { page: 2, pageSize: 200 },
    })
  })

  it('超过 5 页（1000 台）时截断并标记 truncated', async () => {
    mockGet
      .mockResolvedValueOnce(page(200, 2000))
      .mockResolvedValueOnce(page(200, 2000))
      .mockResolvedValueOnce(page(200, 2000))
      .mockResolvedValueOnce(page(200, 2000))
      .mockResolvedValueOnce(page(200, 2000))

    const result = await fetchAllTestDevices()

    expect(result.items).toHaveLength(1000)
    expect(result.truncated).toBe(true)
    expect(mockGet).toHaveBeenCalledTimes(5)
  })

  it('某一页返回空时提前停止，不空转请求', async () => {
    mockGet
      .mockResolvedValueOnce(page(2, 5))
      .mockResolvedValueOnce(page(0, 5))

    const result = await fetchAllTestDevices()

    expect(result.items).toHaveLength(2)
    expect(result.truncated).toBe(true)
    expect(mockGet).toHaveBeenCalledTimes(2)
  })

  it('useAllTestDevices 在 enabled=false 时一次请求都不发', () => {
    const wrapper = createWrapper()

    const { result } = renderHook(() => useAllTestDevices(false), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('useAllTestDevices 打开后拉全量并缓存到白名单前缀下', async () => {
    mockGet.mockResolvedValue({ data: LIST })
    const wrapper = createWrapper()

    const { result } = renderHook(() => useAllTestDevices(true), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.items).toHaveLength(1)
    expect(result.current.data?.truncated).toBe(false)
    expect(result.current.data).toBeDefined()
  })
})

describe('testDevices hooks', () => {
  it('queryKey 带上筛选参数，且只发一次请求', async () => {
    mockGet.mockResolvedValue({ data: LIST })
    const wrapper = createWrapper()

    const { result } = renderHook(
      () => useTestDevices({ keyword: 'CN' }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledTimes(1)
    expect(TEST_DEVICES_KEY).toEqual(['analytics', 'testDevices'])
    expect(result.current.data).toEqual(LIST)
  })

  it('添加成功后失效整组白名单缓存', async () => {
    mockPost.mockResolvedValue({
      data: { item: ITEM, reactivated: false },
    })
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(() => useAddTestDevice(), { wrapper })
    result.current.mutate({
      deviceId: 'CN-001',
      reason: '需要验证新一集',
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: TEST_DEVICES_KEY })
  })

  it('撤销成功后失效整组白名单缓存', async () => {
    mockPost.mockResolvedValue({
      data: { ok: true, clearedAdventureAssignment: false },
    })
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(() => useRevokeTestDevice(), { wrapper })
    result.current.mutate({
      deviceId: 'CN-001',
      reason: '验证结束，收回资格',
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: TEST_DEVICES_KEY })
  })
})
