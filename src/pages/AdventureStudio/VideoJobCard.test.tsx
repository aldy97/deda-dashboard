import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import VideoJobCard from './VideoJobCard'
import type { VideoJobSummary } from '../../types/adventureVideo'

const { retryMutate, cancelMutate } = vi.hoisted(() => ({
  retryMutate: vi.fn(),
  cancelMutate: vi.fn(),
}))

vi.mock('../../api/adventureVideo', () => ({
  useVideoPreviewUrl: vi.fn(() => ({
    isLoading: false,
    data: { url: 'https://oss/final.mp4?sig=1', expiresInSec: 3600 },
    error: null,
  })),
  useRetryVideoJob: vi.fn(() => ({
    mutateAsync: retryMutate,
    isPending: false,
  })),
  useCancelVideoJob: vi.fn(() => ({
    mutateAsync: cancelMutate,
    isPending: false,
  })),
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
    const video = document.querySelector('video') as HTMLVideoElement
    expect(video?.getAttribute('src')).toBe('https://oss/final.mp4?sig=1')
    // 竖屏成片高度封顶，否则手机上播放器会把整页顶走
    expect(video).toHaveStyle({ maxHeight: '320px', objectFit: 'contain' })
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

  it('重试：填够理由后带 jobId 与理由提交', async () => {
    retryMutate.mockReset()
    retryMutate.mockResolvedValue({ job: BASE })
    render(<VideoJobCard job={BASE} authoring />)

    fireEvent.click(screen.getByRole('button', { name: /重\s*试/ }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(document.querySelector('textarea')!, {
      target: { value: '上一版角色漂移，换 seed 重跑' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: /重\s*试/ }))

    await waitFor(() => expect(retryMutate).toHaveBeenCalledTimes(1))
    expect(retryMutate).toHaveBeenCalledWith({
      jobId: 'job-1',
      reason: '上一版角色漂移，换 seed 重跑',
    })
  })

  it('取消：运行中的作业可以带理由取消', async () => {
    cancelMutate.mockReset()
    cancelMutate.mockResolvedValue({ job: BASE })
    render(
      <VideoJobCard
        job={{ ...BASE, status: 'running', stage: 'voice', errorCode: null, errorMessage: null }}
        authoring
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /取\s*消/ }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(document.querySelector('textarea')!, {
      target: { value: '这一集先不投放了' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: /取消作业/ }))

    await waitFor(() => expect(cancelMutate).toHaveBeenCalledTimes(1))
    expect(cancelMutate).toHaveBeenCalledWith({
      jobId: 'job-1',
      reason: '这一集先不投放了',
    })
  })
})
