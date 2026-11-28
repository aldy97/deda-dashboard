import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'
import {
  isTerminal,
  type CreateVideoJobPayload,
  type VideoCapabilities,
  type VideoJobDetail,
  type VideoJobListResponse,
  type VideoJobSummary,
  type VideoPreviewUrl,
} from '../types/adventureVideo'

/**
 * 冒险短视频接口层。
 *
 * queryKey 挂在 ['analytics','adventureVideo'] 下：建单/重试/取消成功后整组作废，
 * 与 Adventure Studio 的做法一致——低频操作，多刷几个请求换「界面永远等于库里真相」。
 *
 * 运行中的作业 2 秒轮询，终态立刻停；预览 URL 只活 1 小时，staleTime 定 50 分钟，
 * 避免播放器每次重渲染都重新签名。
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
      return items.some((item) => !isTerminal(item.status))
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
      return isTerminal(job.status) ? false : RUNNING_POLL_MS
    },
  })
}

export function useVideoPreviewUrl(jobId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...VIDEO_QUERY_ROOT, 'preview', jobId],
    queryFn: () => fetchVideoPreviewUrl(jobId!),
    enabled: jobId !== null && enabled,
    staleTime: 50 * 60 * 1000,
    retry: false,
  })
}

function useInvalidateVideo() {
  const client = useQueryClient()
  return () => client.invalidateQueries({ queryKey: VIDEO_QUERY_ROOT })
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
