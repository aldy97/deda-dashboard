import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'
import {
  isPolling,
  type CreateVideoJobPayload,
  type VideoCapabilities,
  type VideoDownloadUrl,
  type VideoJobDetail,
  type VideoJobListResponse,
  type VideoJobSummary,
  type VideoPreviewUrl,
  type VideoStoryboardDraft,
} from '../types/adventureVideo'

/**
 * 冒险短视频接口层。
 *
 * queryKey 挂在 ['analytics','adventureVideo'] 下：建单/重试/取消成功后整组作废，
 * 与 Adventure Studio 的做法一致——低频操作，多刷几个请求换「界面永远等于库里真相」。
 *
 * 只有 queued / running 2 秒轮询；等待审核与终态都停。
 * 预览 URL 只活一小时，staleTime 按 expiresInSec 的 80% 计算，
 * 过期后由播放器 onError 或重新进入页面触发换签。
 */

export const VIDEO_QUERY_ROOT = ['analytics', 'adventureVideo'] as const

const BASE = '/analytics/adventure-video'
const RUNNING_POLL_MS = 2_000

export async function fetchVideoCapabilities(): Promise<VideoCapabilities> {
  const resp = await apiClient.get(`${BASE}/capabilities`)
  return resp.data as VideoCapabilities
}

export async function fetchVideoJobs(
  episodeId: string,
): Promise<VideoJobSummary[]> {
  const resp = await apiClient.get(`${BASE}/jobs`, { params: { episodeId } })
  return (resp.data as VideoJobListResponse).items
}

export async function fetchVideoJob(jobId: string): Promise<VideoJobDetail> {
  const resp = await apiClient.get(`${BASE}/jobs/${jobId}`)
  return resp.data as VideoJobDetail
}

export async function fetchVideoPreviewUrl(
  jobId: string,
): Promise<VideoPreviewUrl> {
  const resp = await apiClient.get(`${BASE}/jobs/${jobId}/preview-url`)
  return resp.data as VideoPreviewUrl
}

export async function fetchVideoDownloadUrl(
  jobId: string,
): Promise<VideoDownloadUrl> {
  const resp = await apiClient.get(`${BASE}/jobs/${jobId}/download-url`)
  return resp.data as VideoDownloadUrl
}

export async function validateVideoStoryboard(
  jobId: string,
  storyboard: VideoStoryboardDraft,
): Promise<{
  storyboard: VideoStoryboardDraft
  estimate: { totalSec: number; chars: number; clips: number }
}> {
  const resp = await apiClient.post(
    `${BASE}/jobs/${jobId}/storyboard/validate`,
    { storyboard },
  )
  return resp.data as {
    storyboard: VideoStoryboardDraft
    estimate: { totalSec: number; chars: number; clips: number }
  }
}

export async function saveVideoStoryboard(
  jobId: string,
  payload: {
    storyboard: VideoStoryboardDraft
    expectedRevision: number
    reason?: string
  },
): Promise<{ revision: number }> {
  const resp = await apiClient.put(`${BASE}/jobs/${jobId}/storyboard`, payload)
  return resp.data as { revision: number }
}

export async function revoiceVideoStoryboard(
  jobId: string,
  payload: { expectedRevision: number; reason: string },
): Promise<unknown> {
  const resp = await apiClient.post(
    `${BASE}/jobs/${jobId}/storyboard/revoice`,
    payload,
  )
  return resp.data
}

export async function regenerateVideoStoryboard(
  jobId: string,
  payload: { expectedRevision: number; reason: string },
): Promise<unknown> {
  const resp = await apiClient.post(
    `${BASE}/jobs/${jobId}/storyboard/regenerate`,
    payload,
  )
  return resp.data
}

export async function approveVideoStoryboard(
  jobId: string,
  payload: { expectedRevision: number; reason: string },
): Promise<unknown> {
  const resp = await apiClient.post(
    `${BASE}/jobs/${jobId}/storyboard/approve`,
    payload,
  )
  return resp.data
}

export async function createVideoJob(
  payload: CreateVideoJobPayload,
): Promise<{ job: VideoJobSummary; reused: boolean }> {
  const resp = await apiClient.post(`${BASE}/jobs`, payload)
  return resp.data as { job: VideoJobSummary; reused: boolean }
}

export async function retryVideoJob(
  jobId: string,
  reason: string,
): Promise<{ job: VideoJobSummary }> {
  const resp = await apiClient.post(`${BASE}/jobs/${jobId}/retry`, { reason })
  return resp.data as { job: VideoJobSummary }
}

export async function cancelVideoJob(
  jobId: string,
  reason: string,
): Promise<{ job: VideoJobSummary }> {
  const resp = await apiClient.post(`${BASE}/jobs/${jobId}/cancel`, { reason })
  return resp.data as { job: VideoJobSummary }
}

export function useVideoCapabilities() {
  return useQuery({
    queryKey: [...VIDEO_QUERY_ROOT, 'capabilities'],
    queryFn: fetchVideoCapabilities,
    staleTime: Infinity,
  })
}

export function useVideoJobs(episodeId: string | null) {
  return useQuery({
    queryKey: [...VIDEO_QUERY_ROOT, 'jobs', episodeId],
    queryFn: () => fetchVideoJobs(episodeId!),
    enabled: episodeId !== null,
    refetchInterval: (query) => {
      const items = query.state.data as VideoJobSummary[] | undefined
      if (!items || items.length === 0) return false
      return items.some((item) => isPolling(item.status))
        ? RUNNING_POLL_MS
        : false
    },
  })
}

export function useVideoJob(jobId: string | null) {
  return useQuery({
    queryKey: [...VIDEO_QUERY_ROOT, 'job', jobId],
    queryFn: () => fetchVideoJob(jobId!),
    enabled: jobId !== null,
    refetchInterval: (query) => {
      const job = query.state.data as VideoJobDetail | undefined
      if (!job) return false
      return isPolling(job.status) ? RUNNING_POLL_MS : false
    },
  })
}

export function useVideoPreviewUrl(jobId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...VIDEO_QUERY_ROOT, 'preview', jobId],
    queryFn: () => fetchVideoPreviewUrl(jobId!),
    enabled: jobId !== null && enabled,
    staleTime: (query) => {
      const data = query.state.data as VideoPreviewUrl | undefined
      return data ? Math.max(60_000, data.expiresInSec * 1000 * 0.8) : 0
    },
    retry: false,
  })
}

function useInvalidateVideo() {
  const client = useQueryClient()
  return () => client.invalidateQueries({ queryKey: VIDEO_QUERY_ROOT })
}

export function useValidateVideoStoryboard() {
  return useMutation({
    mutationFn: ({
      jobId,
      storyboard,
    }: {
      jobId: string
      storyboard: VideoStoryboardDraft
    }) => validateVideoStoryboard(jobId, storyboard),
  })
}

export function useSaveVideoStoryboard() {
  const invalidate = useInvalidateVideo()
  return useMutation({
    mutationFn: ({
      jobId,
      ...payload
    }: {
      jobId: string
      storyboard: VideoStoryboardDraft
      expectedRevision: number
      reason?: string
    }) => saveVideoStoryboard(jobId, payload),
    onSuccess: invalidate,
  })
}

export function useRevoiceVideoStoryboard() {
  const invalidate = useInvalidateVideo()
  return useMutation({
    mutationFn: ({
      jobId,
      ...payload
    }: {
      jobId: string
      expectedRevision: number
      reason: string
    }) => revoiceVideoStoryboard(jobId, payload),
    onSuccess: invalidate,
  })
}

export function useRegenerateVideoStoryboard() {
  const invalidate = useInvalidateVideo()
  return useMutation({
    mutationFn: ({
      jobId,
      ...payload
    }: {
      jobId: string
      expectedRevision: number
      reason: string
    }) => regenerateVideoStoryboard(jobId, payload),
    onSuccess: invalidate,
  })
}

export function useApproveVideoStoryboard() {
  const invalidate = useInvalidateVideo()
  return useMutation({
    mutationFn: ({
      jobId,
      ...payload
    }: {
      jobId: string
      expectedRevision: number
      reason: string
    }) => approveVideoStoryboard(jobId, payload),
    onSuccess: invalidate,
  })
}

export function useCreateVideoJob() {
  const invalidate = useInvalidateVideo()
  return useMutation({
    mutationFn: createVideoJob,
    onSuccess: invalidate,
  })
}

export function useRetryVideoJob() {
  const invalidate = useInvalidateVideo()
  return useMutation({
    mutationFn: ({ jobId, reason }: { jobId: string; reason: string }) =>
      retryVideoJob(jobId, reason),
    onSuccess: invalidate,
  })
}

export function useCancelVideoJob() {
  const invalidate = useInvalidateVideo()
  return useMutation({
    mutationFn: ({ jobId, reason }: { jobId: string; reason: string }) =>
      cancelVideoJob(jobId, reason),
    onSuccess: invalidate,
  })
}
