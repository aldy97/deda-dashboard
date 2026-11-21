import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import {
  VOICE_TIMBRES_KEY,
  createVoiceTimbre,
  deleteVoiceTimbre,
  fetchVoiceTimbres,
  updateVoiceTimbre,
  useCreateVoiceTimbre,
  useDeleteVoiceTimbre,
  useUpdateVoiceTimbre,
} from './voiceTimbre'
import { apiClient } from './client'

vi.mock('./client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

const mockGet = apiClient.get as unknown as ReturnType<typeof vi.fn>
const mockPost = apiClient.post as unknown as ReturnType<typeof vi.fn>
const mockPut = apiClient.put as unknown as ReturnType<typeof vi.fn>
const mockDelete = apiClient.delete as unknown as ReturnType<typeof vi.fn>

const item = {
  characterKey: 'elly',
  timbreId: '1000957',
  updatedAt: '2026-11-21T00:00:00.000Z',
  personaConfigured: true,
  devicesInUse: 3,
}

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

describe('voiceTimbre api', () => {
  it('fetchVoiceTimbres reads the list array from the envelope', async () => {
    mockGet.mockResolvedValue({ data: [item] })

    await expect(fetchVoiceTimbres()).resolves.toEqual([item])
    expect(mockGet).toHaveBeenCalledWith('/analytics/voice-timbres')
  })

  it('createVoiceTimbre posts key and timbreId', async () => {
    mockPost.mockResolvedValue({ data: item })

    await createVoiceTimbre({ characterKey: 'elly', timbreId: '1000957' })
    expect(mockPost).toHaveBeenCalledWith('/analytics/voice-timbres', {
      characterKey: 'elly',
      timbreId: '1000957',
    })
  })

  it('updateVoiceTimbre puts to the encoded key path', async () => {
    mockPut.mockResolvedValue({ data: item })

    await updateVoiceTimbre('el ly', { timbreId: '1000958' })
    expect(mockPut).toHaveBeenCalledWith(
      '/analytics/voice-timbres/el%20ly',
      { timbreId: '1000958' },
    )
  })

  it('deleteVoiceTimbre only sends force when asked', async () => {
    mockDelete.mockResolvedValue({ data: undefined })

    await deleteVoiceTimbre('elly')
    await deleteVoiceTimbre('elly', true)

    expect(mockDelete).toHaveBeenNthCalledWith(
      1,
      '/analytics/voice-timbres/elly',
    )
    expect(mockDelete).toHaveBeenNthCalledWith(
      2,
      '/analytics/voice-timbres/elly',
      { params: { force: true } },
    )
  })

  it('invalidates the list after create/update/delete', async () => {
    const client = makeClient()
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    mockPost.mockResolvedValue({ data: item })
    mockPut.mockResolvedValue({ data: item })
    mockDelete.mockResolvedValue({ data: undefined })

    const { result } = renderHook(
      () => ({
        create: useCreateVoiceTimbre(),
        update: useUpdateVoiceTimbre(),
        remove: useDeleteVoiceTimbre(),
      }),
      { wrapper: wrapper(client) },
    )

    await result.current.create.mutateAsync({
      characterKey: 'elly',
      timbreId: '1000957',
    })
    await result.current.update.mutateAsync({
      characterKey: 'elly',
      timbreId: '1000958',
    })
    await result.current.remove.mutateAsync({
      characterKey: 'elly',
      force: true,
    })

    await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(3))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: VOICE_TIMBRES_KEY })
  })
})
