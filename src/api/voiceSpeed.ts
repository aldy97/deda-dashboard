import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'

/** 全局语速配置（非哄睡 normalSpd + 哄睡 sleepSpd），与服务端 /analytics/voice-speed 对齐 */
export interface VoiceSpeedConfig {
  normalSpd: number
  sleepSpd: number
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
