import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import VideoJobCard from './VideoJobCard'
import type { VideoJobSummary } from '../../types/adventureVideo'

vi.mock('../../api/adventureVideo', () => ({
  useVideoPreviewUrl: vi.fn(() => ({
    isLoading: false,
    data: { url: 'https://oss/final.mp4?sig=1', expiresInSec: 3600 },
    error: null,
  })),
  useRetryVideoJob: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useCancelVideoJob: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}))

const BASE: VideoJobSummary = {
  id: 'job-1',
  episodeId: 'ep-1',
  episodeVersionId: 'v-1',
  businessKey: 'elly/1/3',
  contentHash: 'hash',
  kind: 'teaser',
  status: 'failed',
  stage: 'visual',
  aspect: '9:16',
  resolution: '720P',
  renderer: 'wan3.0-video',
  ttsMode: 'system',
  voiceSetVersion: 'system:abc',
  estimatedCostCents: 3655,
  actualCostCents: 0,
  errorCode: 'STORYBOARD_NOT_VERBATIM',
  errorMessage: '模型改写了原文',
  attempts: 1,
  createdAt: '2026-11-28T12:00:00+08:00',
  startedAt: '2026-11-28T12:00:10+08:00',
  finishedAt: '2026-11-28T12:01:00+08:00',
  finalObjectKey: null,
  finalDurationSec: null,
}

describe('VideoJobCard', () => {
  it('失败作业展示领域码、原因与重试入口', () => {
    render(<VideoJobCard job={BASE} authoring />)
    expect(screen.getByText('STORYBOARD_NOT_VERBATIM')).toBeTruthy()
    expect(screen.getByText('模型改写了原文')).toBeTruthy()
    expect(screen.getByRole('button', { name: /重\s*试/ })).toBeTruthy()
  })

  it('只读账号不能重试', () => {
    render(<VideoJobCard job={BASE} authoring={false} />)
    const retry = screen.getByRole('button', { name: /重\s*试/ }) as HTMLButtonElement
    expect(retry.disabled).toBe(true)
  })

  it('成功作业渲染播放器，并标注系统音色试跑', () => {
    render(
      <VideoJobCard
        job={{ ...BASE, status: 'succeeded', stage: 'done', errorCode: null, errorMessage: null }}
        authoring
      />,
    )
    const video = document.querySelector('video')
    expect(video?.getAttribute('src')).toBe('https://oss/final.mp4?sig=1')
    expect(screen.getByText(/系统音色试跑/)).toBeTruthy()
  })

  it('运行中显示取消入口，且不请求预览', () => {
    render(
      <VideoJobCard
        job={{ ...BASE, status: 'running', stage: 'voice', errorCode: null, errorMessage: null }}
        authoring
      />,
    )
    expect(screen.getByRole('button', { name: /取\s*消/ })).toBeTruthy()
    expect(document.querySelector('video')).toBeNull()
  })
})
