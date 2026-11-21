import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { apiClient } from './client'
import {
  VOICE_SPEED_KEY,
  fetchVoiceSpeed,
  saveVoiceSpeed,
  useSaveVoiceSpeed,
  useVoiceSpeed,
} from './voiceSpeed'

vi.mock('./client', () => ({
  apiClient: { get: vi.fn(), patch: vi.fn() },
}))

const mockGet = apiClient.get as unknown as ReturnType<typeof vi.fn>
const mockPatch = apiClient.patch as unknown as ReturnType<typeof vi.fn>

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
