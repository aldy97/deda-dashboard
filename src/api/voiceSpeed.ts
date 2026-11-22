import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'

/** 全局语速配置（非哄睡 normalSpd + 哄睡 sleepSpd），与服务端 /analytics/voice-speed 对齐 */
export interface VoiceSpeedConfig {
  normalSpd: number
  sleepSpd: number
}

export interface VoiceSpeedApplyResultItem {
  deviceId: string
  mac: string
  applied: string
  reason?: string
}

export interface VoiceSpeedApplyResult {
  targeted: number
  live: number
  deferred: number
  skipped: number
  results: VoiceSpeedApplyResultItem[]
}

export const VOICE_SPEED_KEY = ['analytics', 'voiceSpeed'] as const

export async function fetchVoiceSpeed(): Promise<VoiceSpeedConfig> {
  const resp = await apiClient.get('/analytics/voice-speed')
  return resp.data as VoiceSpeedConfig
}

export async function saveVoiceSpeed(
  payload: VoiceSpeedConfig,
): Promise<VoiceSpeedConfig> {
  const resp = await apiClient.patch('/analytics/voice-speed', payload)
  return resp.data as VoiceSpeedConfig
}

export async function applyVoiceSpeed(payload?: {
  macs?: string[]
}): Promise<VoiceSpeedApplyResult> {
  const resp = await apiClient.post(
    '/analytics/voice-speed/apply',
    payload ?? {},
    { timeout: 30000 },
  )
  return resp.data as VoiceSpeedApplyResult
}

export function useVoiceSpeed() {
  return useQuery({ queryKey: VOICE_SPEED_KEY, queryFn: fetchVoiceSpeed })
}

export function useSaveVoiceSpeed() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: saveVoiceSpeed,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: VOICE_SPEED_KEY }),
  })
}

export function useApplyVoiceSpeed() {
  return useMutation({ mutationFn: applyVoiceSpeed })
}
