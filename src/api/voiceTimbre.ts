import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'

/** 与 deda-server GET /analytics/voice-timbres 对齐（信封 data 即数组） */
export interface VoiceTimbreItem {
  characterKey: string
  timbreId: string
  updatedAt: string
  /** false = 该角色没有 persona_<key> 人设，对话会回落 Elly */
  personaConfigured: boolean
  devicesInUse: number
}

export interface VoiceTimbreRecord {
  characterKey: string
  timbreId: string
  updatedAt: string
}

export const VOICE_TIMBRES_KEY = ['analytics', 'voiceTimbres'] as const

const basePath = '/analytics/voice-timbres'
const itemPath = (characterKey: string) =>
  `${basePath}/${encodeURIComponent(characterKey)}`

export async function fetchVoiceTimbres(): Promise<VoiceTimbreItem[]> {
  const resp = await apiClient.get(basePath)
  return resp.data as VoiceTimbreItem[]
}

export async function createVoiceTimbre(payload: {
  characterKey: string
  timbreId: string
}): Promise<VoiceTimbreRecord> {
  const resp = await apiClient.post(basePath, payload)
  return resp.data as VoiceTimbreRecord
}

export async function updateVoiceTimbre(
  characterKey: string,
  payload: { timbreId: string },
): Promise<VoiceTimbreRecord> {
  const resp = await apiClient.put(itemPath(characterKey), payload)
  return resp.data as VoiceTimbreRecord
}

export async function deleteVoiceTimbre(
  characterKey: string,
  force = false,
): Promise<void> {
  if (force) {
    await apiClient.delete(itemPath(characterKey), { params: { force: true } })
    return
  }
  await apiClient.delete(itemPath(characterKey))
}

export function useVoiceTimbres() {
  return useQuery({
    queryKey: VOICE_TIMBRES_KEY,
    queryFn: fetchVoiceTimbres,
  })
}

function useInvalidate() {
  const queryClient = useQueryClient()
  return () =>
    queryClient.invalidateQueries({ queryKey: VOICE_TIMBRES_KEY })
}

export function useCreateVoiceTimbre() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: createVoiceTimbre, onSuccess: invalidate })
}

export function useUpdateVoiceTimbre() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (payload: { characterKey: string; timbreId: string }) =>
      updateVoiceTimbre(payload.characterKey, { timbreId: payload.timbreId }),
    onSuccess: invalidate,
  })
}

export function useDeleteVoiceTimbre() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (payload: { characterKey: string; force?: boolean }) =>
      deleteVoiceTimbre(payload.characterKey, payload.force ?? false),
    onSuccess: invalidate,
  })
}
