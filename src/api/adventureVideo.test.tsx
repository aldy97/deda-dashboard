import { describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { apiClient } from './client'
import {
  createVideoJob,
  fetchVideoCapabilities,
  fetchVideoJobs,
  fetchVideoJob,
  fetchVideoPreviewUrl,
  fetchVideoDownloadUrl,
  validateVideoStoryboard,
  saveVideoStoryboard,
  revoiceVideoStoryboard,
  regenerateVideoStoryboard,
  approveVideoStoryboard,
  cancelVideoJob,
  retryVideoJob,
  useCancelVideoJob,
  useCreateVideoJob,
  useRetryVideoJob,
  useVideoCapabilities,
  useVideoJob,
  useVideoJobs,
  useVideoPreviewUrl,
  useValidateVideoStoryboard,
  useSaveVideoStoryboard,
  useRevoiceVideoStoryboard,
  useRegenerateVideoStoryboard,
  useApproveVideoStoryboard,
  VIDEO_QUERY_ROOT,
} from './adventureVideo'
import {
  formatCents,
  isPolling,
  isTerminal,
  newRequestId,
  type VideoJobSummary,
} from '../types/adventureVideo'

vi.mock('./client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}))

const mockGet = apiClient.get as unknown as ReturnType<typeof vi.fn>
const mockPost = apiClient.post as unknown as ReturnType<typeof vi.fn>
const mockPut = apiClient.put as unknown as ReturnType<typeof vi.fn>

const JOB: VideoJobSummary = {
  id: 'job-1',
  episodeId: 'ep-1',
  episodeVersionId: 'v-1',
  businessKey: 'elly/1/3',
  contentHash: 'hash',
  kind: 'teaser',
  status: 'queued',
  stage: 'queued',
  aspect: '9:16',
  resolution: '720P',
  renderer: 'wan3.0-video',
  ttsMode: 'system',
  voiceSetVersion: 'system:abc',
  estimatedCostCents: 3655,
  actualCostCents: 0,
  errorCode: null,
  errorMessage: null,
  attempts: 0,
  createdAt: '2026-11-28T12:00:00+08:00',
  startedAt: null,
  finishedAt: null,
  finalObjectKey: null,
  finalDurationSec: null,
}

describe('adventureVideo api', () => {
  it('query root 挂在 analytics/adventureVideo 下', () => {
    expect(VIDEO_QUERY_ROOT).toEqual(['analytics', 'adventureVideo'])
  })

  it('能力、列表、详情、预览 URL 的路径与解包正确', async () => {
    mockGet
      .mockResolvedValueOnce({ data: { enabled: true } })
      .mockResolvedValueOnce({ data: { items: [JOB] } })
      .mockResolvedValueOnce({ data: { ...JOB, shots: [], assets: [] } })
      .mockResolvedValueOnce({
        data: { url: 'https://oss/x', expiresInSec: 3600 },
      })

    await expect(fetchVideoCapabilities()).resolves.toEqual({ enabled: true })
    await expect(fetchVideoJobs('ep-1')).resolves.toEqual([JOB])
    await expect(fetchVideoJob('job-1')).resolves.toMatchObject({
      id: 'job-1',
    })
    await expect(fetchVideoPreviewUrl('job-1')).resolves.toEqual({
      url: 'https://oss/x',
      expiresInSec: 3600,
    })

    expect(mockGet).toHaveBeenNthCalledWith(
      1,
      '/analytics/adventure-video/capabilities',
    )
    expect(mockGet).toHaveBeenNthCalledWith(
      2,
      '/analytics/adventure-video/jobs',
      {
        params: { episodeId: 'ep-1' },
      },
    )
    expect(mockGet).toHaveBeenNthCalledWith(
      3,
      '/analytics/adventure-video/jobs/job-1',
    )
    expect(mockGet).toHaveBeenNthCalledWith(
      4,
      '/analytics/adventure-video/jobs/job-1/preview-url',
    )
  })

  it('分镜审核与下载接口路径正确', async () => {
    mockGet.mockReset()
    mockPost.mockReset()
    mockPut.mockReset()
    mockGet.mockResolvedValue({
      data: { url: 'https://oss/x', expiresInSec: 60, filename: 'a.mp4' },
    })
    mockPost.mockResolvedValue({
      data: {
        storyboard: {},
        estimate: { totalSec: 57, chars: 250, clips: 2 },
      },
    })
    mockPut.mockResolvedValue({ data: { revision: 3 } })

    const storyboard = { stylePrompt: 'p', beats: [] }
    await fetchVideoDownloadUrl('job-1')
    await validateVideoStoryboard('job-1', storyboard)
    await saveVideoStoryboard('job-1', {
      storyboard,
      expectedRevision: 2,
      reason: '改文案',
    })
    await revoiceVideoStoryboard('job-1', {
      expectedRevision: 3,
      reason: '重新配音',
    })
    await regenerateVideoStoryboard('job-1', {
      expectedRevision: 3,
      reason: '重新生成',
    })
    await approveVideoStoryboard('job-1', {
      expectedRevision: 3,
      reason: '审批通过',
    })

    expect(mockGet).toHaveBeenCalledWith(
      '/analytics/adventure-video/jobs/job-1/download-url',
    )
    expect(mockPost).toHaveBeenNthCalledWith(
      1,
      '/analytics/adventure-video/jobs/job-1/storyboard/validate',
      { storyboard },
    )
    expect(mockPut).toHaveBeenCalledWith(
      '/analytics/adventure-video/jobs/job-1/storyboard',
      { storyboard, expectedRevision: 2, reason: '改文案' },
    )
    for (const [index, action] of [
      'revoice',
      'regenerate',
      'approve',
    ].entries()) {
      expect(mockPost).toHaveBeenNthCalledWith(
        index + 2,
        `/analytics/adventure-video/jobs/job-1/storyboard/${action}`,
        {
          expectedRevision: 3,
          reason:
            index === 0 ? '重新配音' : index === 1 ? '重新生成' : '审批通过',
        },
      )
    }
  })

  it('创建作业把幂等键与理由原样透传', async () => {
    mockPost.mockResolvedValue({ data: { job: JOB, reused: false } })
    await createVideoJob({
      episodeId: 'ep-1',
      episodeVersionId: 'v-1',
      requestId: 'video-12345678',
      resolution: '720P',
      reason: '给第 3 集做一支投放预告',
    })
    expect(mockPost).toHaveBeenCalledWith('/analytics/adventure-video/jobs', {
      episodeId: 'ep-1',
      episodeVersionId: 'v-1',
      requestId: 'video-12345678',
      resolution: '720P',
      reason: '给第 3 集做一支投放预告',
    })
  })

  it('重试 / 取消走各自子路径并只带 reason', async () => {
    mockPost.mockResolvedValue({ data: { job: JOB } })
    await retryVideoJob('job-1', '换 seed 重跑一次')
    await cancelVideoJob('job-1', '先不投放了')
    expect(mockPost).toHaveBeenNthCalledWith(
      1,
      '/analytics/adventure-video/jobs/job-1/retry',
      { reason: '换 seed 重跑一次' },
    )
    expect(mockPost).toHaveBeenNthCalledWith(
      2,
      '/analytics/adventure-video/jobs/job-1/cancel',
      { reason: '先不投放了' },
    )
  })
})

describe('adventureVideo 展示辅助', () => {
  it('终态判定', () => {
    expect(isTerminal('succeeded')).toBe(true)
    expect(isTerminal('failed')).toBe(true)
    expect(isTerminal('canceled')).toBe(true)
    expect(isTerminal('queued')).toBe(false)
    expect(isTerminal('running')).toBe(false)
    expect(isTerminal('awaiting_review')).toBe(false)
  })

  it('只有 queued / running 轮询，待审核不轮询', () => {
    expect(isPolling('queued')).toBe(true)
    expect(isPolling('running')).toBe(true)
    expect(isPolling('awaiting_review')).toBe(false)
    expect(isPolling('succeeded')).toBe(false)
  })

  it('金额按分转元', () => {
    expect(formatCents(3655)).toBe('36.55 元')
  })

  it('requestId 符合服务端 8–64 位白名单', () => {
    const id = newRequestId()
    expect(id).toMatch(/^[A-Za-z0-9_-]{8,64}$/)
    expect(newRequestId()).not.toBe(id)
  })
})

describe('adventureVideo hooks', () => {
  function makeWrapper(client: QueryClient) {
    return function Wrapper({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      )
    }
  }

  it('能力 / 列表 / 详情按 queryKey 取数', async () => {
    mockGet.mockReset()
    mockGet
      .mockResolvedValueOnce({ data: { enabled: true } })
      .mockResolvedValueOnce({ data: { items: [JOB] } })
      .mockResolvedValueOnce({ data: { ...JOB, shots: [], assets: [] } })

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const wrapper = makeWrapper(client)

    const caps = renderHook(() => useVideoCapabilities(), { wrapper })
    await waitFor(() =>
      expect(caps.result.current.data).toEqual({ enabled: true }),
    )

    const jobs = renderHook(() => useVideoJobs('ep-1'), { wrapper })
    await waitFor(() => expect(jobs.result.current.data).toEqual([JOB]))

    const job = renderHook(() => useVideoJob('job-1'), { wrapper })
    await waitFor(() => expect(job.result.current.data?.id).toBe('job-1'))

    client.clear()
  })

  it('预览地址在 enabled=false 时不发请求', () => {
    mockGet.mockReset()
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const wrapper = makeWrapper(client)
    const preview = renderHook(() => useVideoPreviewUrl('job-1', false), {
      wrapper,
    })
    expect(preview.result.current.fetchStatus).toBe('idle')
    expect(mockGet).not.toHaveBeenCalled()
    client.clear()
  })

  it('分镜审核 mutations 成功后都作废整组视频缓存', async () => {
    mockPost.mockReset()
    mockPut.mockReset()
    mockPost.mockResolvedValue({
      data: {
        storyboard: { stylePrompt: 'p', beats: [] },
        estimate: { totalSec: 57, chars: 250, clips: 2 },
      },
    })
    mockPut.mockResolvedValue({ data: { revision: 3 } })
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    const wrapper = makeWrapper(client)
    const storyboard = { stylePrompt: 'p', beats: [] }

    const validate = renderHook(() => useValidateVideoStoryboard(), {
      wrapper,
    })
    await act(async () => {
      await validate.result.current.mutateAsync({ jobId: 'job-1', storyboard })
    })

    const save = renderHook(() => useSaveVideoStoryboard(), { wrapper })
    await act(async () => {
      await save.result.current.mutateAsync({
        jobId: 'job-1',
        storyboard,
        expectedRevision: 2,
      })
    })

    const revoice = renderHook(() => useRevoiceVideoStoryboard(), { wrapper })
    await act(async () => {
      await revoice.result.current.mutateAsync({
        jobId: 'job-1',
        expectedRevision: 3,
        reason: '重新配音',
      })
    })

    const regenerate = renderHook(() => useRegenerateVideoStoryboard(), {
      wrapper,
    })
    await act(async () => {
      await regenerate.result.current.mutateAsync({
        jobId: 'job-1',
        expectedRevision: 3,
        reason: '重新生成',
      })
    })

    const approve = renderHook(() => useApproveVideoStoryboard(), { wrapper })
    await act(async () => {
      await approve.result.current.mutateAsync({
        jobId: 'job-1',
        expectedRevision: 3,
        reason: '审批通过',
      })
    })

    expect(mockPut).toHaveBeenCalledTimes(1)
    expect(invalidate).toHaveBeenCalledTimes(4)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: VIDEO_QUERY_ROOT })
    client.clear()
  })

  it('三个 mutation 成功后都作废整组视频缓存', async () => {
    mockPost.mockReset()
    mockPost.mockResolvedValue({ data: { job: JOB, reused: false } })
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    const wrapper = makeWrapper(client)

    const create = renderHook(() => useCreateVideoJob(), { wrapper })
    await act(async () => {
      await create.result.current.mutateAsync({
        episodeId: 'ep-1',
        episodeVersionId: 'v-1',
        requestId: 'video-12345678',
        reason: '做一支故事短片',
      })
    })

    const retry = renderHook(() => useRetryVideoJob(), { wrapper })
    await act(async () => {
      await retry.result.current.mutateAsync({
        jobId: 'job-1',
        reason: '重跑一次',
      })
    })

    const cancel = renderHook(() => useCancelVideoJob(), { wrapper })
    await act(async () => {
      await cancel.result.current.mutateAsync({
        jobId: 'job-1',
        reason: '先不投放',
      })
    })

    expect(invalidate).toHaveBeenCalledTimes(3)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: VIDEO_QUERY_ROOT })
    client.clear()
  })
})
