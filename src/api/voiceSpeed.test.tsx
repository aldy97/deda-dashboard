import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { apiClient } from './client'
import {
  VOICE_SPEED_KEY,
  applyVoiceSpeed,
  fetchVoiceSpeed,
  saveVoiceSpeed,
  useApplyVoiceSpeed,
  useSaveVoiceSpeed,
  useVoiceSpeed,
} from './voiceSpeed'

vi.mock('./client', () => ({
  apiClient: { get: vi.fn(), patch: vi.fn(), post: vi.fn() },
}))

const mockGet = apiClient.get as unknown as ReturnType<typeof vi.fn>
const mockPatch = apiClient.patch as unknown as ReturnType<typeof vi.fn>
const mockPost = apiClient.post as unknown as ReturnType<typeof vi.fn>

const CONFIG = { normalSpd: 0.7, sleepSpd: 0.5 }

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

describe('voiceSpeed 读接口', () => {
  it('GET /analytics/voice-speed 返回配置', async () => {
    mockGet.mockResolvedValue({ data: CONFIG })
    await expect(fetchVoiceSpeed()).resolves.toEqual(CONFIG)
    expect(mockGet).toHaveBeenCalledWith('/analytics/voice-speed')
  })
})

describe('voiceSpeed 写接口', () => {
  it('PATCH /analytics/voice-speed 透传两个倍数', async () => {
    mockPatch.mockResolvedValue({ data: CONFIG })
    const payload = { normalSpd: 0.6, sleepSpd: 0.4 }
    await expect(saveVoiceSpeed(payload)).resolves.toEqual(CONFIG)
    expect(mockPatch).toHaveBeenCalledWith('/analytics/voice-speed', payload)
  })
})

describe('voiceSpeed 立即下发', () => {
  it('POST /analytics/voice-speed/apply 透传可选 mac 列表', async () => {
    const result = {
      targeted: 1,
      live: 1,
      deferred: 0,
      skipped: 0,
      results: [],
    }
    mockPost.mockResolvedValue({ data: result })

    await expect(
      applyVoiceSpeed({ macs: ['AA:BB:CC:DD:EE:FF'] }),
    ).resolves.toEqual(result)
    expect(mockPost).toHaveBeenCalledWith(
      '/analytics/voice-speed/apply',
      { macs: ['AA:BB:CC:DD:EE:FF'] },
      { timeout: 30000 },
    )
  })

  it('不传 mac 时发送空对象', async () => {
    mockPost.mockResolvedValue({
      data: { targeted: 0, live: 0, deferred: 0, skipped: 0, results: [] },
    })

    await applyVoiceSpeed()

    expect(mockPost).toHaveBeenCalledWith(
      '/analytics/voice-speed/apply',
      {},
      { timeout: 30000 },
    )
  })

  it('useApplyVoiceSpeed 成功后返回汇总', async () => {
    const summary = {
      targeted: 2,
      live: 1,
      deferred: 1,
      skipped: 0,
      results: [],
    }
    mockPost.mockResolvedValue({ data: summary })
    const wrapper = createWrapper()

    const { result } = renderHook(() => useApplyVoiceSpeed(), { wrapper })
    result.current.mutate({})

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(summary)
  })
})

describe('voiceSpeed hooks', () => {
  it('queryKey 与契约一致且读只发一次', async () => {
    mockGet.mockResolvedValue({ data: CONFIG })
    const wrapper = createWrapper()
    renderHook(() => useVoiceSpeed(), { wrapper })
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1))
    expect(VOICE_SPEED_KEY).toEqual(['analytics', 'voiceSpeed'])
  })

  it('保存成功后失效缓存并重取', async () => {
    const wrapper = createWrapper()
    let calls = 0
    mockGet.mockImplementation(() => {
      calls += 1
      return Promise.resolve({ data: CONFIG })
    })
    mockPatch.mockResolvedValue({ data: CONFIG })

    const { result } = renderHook(
      () => ({ query: useVoiceSpeed(), save: useSaveVoiceSpeed() }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true))
    expect(calls).toBe(1)

    result.current.save.mutate({ normalSpd: 0.6, sleepSpd: 0.4 })
    await waitFor(() => expect(result.current.save.isSuccess).toBe(true))
    await waitFor(() => expect(calls).toBe(2))
  })
})
