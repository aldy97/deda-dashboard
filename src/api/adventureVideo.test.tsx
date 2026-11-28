import { describe, expect, it, vi } from 'vitest'
import { apiClient } from './client'
import {
  createVideoJob,
  fetchVideoCapabilities,
  fetchVideoJobs,
  fetchVideoJob,
  fetchVideoPreviewUrl,
  cancelVideoJob,
  retryVideoJob,
  VIDEO_QUERY_ROOT,
} from './adventureVideo'
import {
  formatCents,
  isTerminal,
  newRequestId,
  type VideoJobSummary,
} from '../types/adventureVideo'

vi.mock('./client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
}))

const mockGet = apiClient.get as unknown as ReturnType<typeof vi.fn>
const mockPost = apiClient.post as unknown as ReturnType<typeof vi.fn>

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
      .mockResolvedValueOnce({ data: { url: 'https://oss/x', expiresInSec: 3600 } })

    await expect(fetchVideoCapabilities()).resolves.toEqual({ enabled: true })
    await expect(fetchVideoJobs('ep-1')).resolves.toEqual([JOB])
    await expect(fetchVideoJob('job-1')).resolves.toMatchObject({ id: 'job-1' })
    await expect(fetchVideoPreviewUrl('job-1')).resolves.toEqual({
      url: 'https://oss/x',
      expiresInSec: 3600,
    })

    expect(mockGet).toHaveBeenNthCalledWith(
      1,
      '/analytics/adventure-video/capabilities',
    )
    expect(mockGet).toHaveBeenNthCalledWith(2, '/analytics/adventure-video/jobs', {
      params: { episodeId: 'ep-1' },
    })
    expect(mockGet).toHaveBeenNthCalledWith(
      3,
      '/analytics/adventure-video/jobs/job-1',
    )
    expect(mockGet).toHaveBeenNthCalledWith(
      4,
      '/analytics/adventure-video/jobs/job-1/preview-url',
    )
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
