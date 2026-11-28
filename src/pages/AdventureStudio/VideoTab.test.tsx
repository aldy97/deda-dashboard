import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import VideoTab from './VideoTab'
import {
  useVideoCapabilities,
  useVideoJobs,
} from '../../api/adventureVideo'
import type {
  VideoCapabilities,
  VideoJobSummary,
} from '../../types/adventureVideo'

const { createMutate } = vi.hoisted(() => ({ createMutate: vi.fn() }))

vi.mock('../../api/adventureVideo', () => ({
  useVideoCapabilities: vi.fn(),
  useVideoJobs: vi.fn(() => ({ data: [], isLoading: false, error: null })),
  useCreateVideoJob: vi.fn(() => ({
    mutateAsync: createMutate,
    isPending: false,
  })),
  useVideoPreviewUrl: vi.fn(() => ({
    isLoading: false,
    data: null,
    error: null,
    refetch: vi.fn(),
  })),
  useRetryVideoJob: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useCancelVideoJob: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useVideoJob: vi.fn(() => ({ isLoading: false, data: undefined })),
  useValidateVideoStoryboard: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useSaveVideoStoryboard: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useRevoiceVideoStoryboard: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useRegenerateVideoStoryboard: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useApproveVideoStoryboard: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  fetchVideoDownloadUrl: vi.fn(),
  fetchVideoPreviewUrl: vi.fn(),
}))

const mockCaps = useVideoCapabilities as unknown as ReturnType<typeof vi.fn>
const mockJobs = useVideoJobs as unknown as ReturnType<typeof vi.fn>

const CAPS: VideoCapabilities = {
  enabled: true,
  ttsMode: 'system',
  aspect: '9:16',
  resolution: '720P',
  durationSec: 60,
  budgetCny: 50,
  voicesReady: true,
  voiceRoles: ['elly', 'polly', 'narrator'],
}

function renderTab(overrides: Partial<Parameters<typeof VideoTab>[0]> = {}) {
  return render(
    <VideoTab
      episodeId="ep-1"
      currentVersionId="v-1"
      published
      retiredAt={null}
      authoring
      {...overrides}
    />,
  )
}

describe('VideoTab', () => {
  it('开关关闭时说明原因，不显示生成按钮', () => {
    mockCaps.mockReturnValue({
      isLoading: false,
      data: { ...CAPS, enabled: false },
    })
    renderTab()
    expect(screen.getByText('短视频工作台在本环境未开启')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /生成故事短片/ })).toBeNull()
  })

  it('未发布时禁用生成并给出提示', () => {
    mockCaps.mockReturnValue({ isLoading: false, data: CAPS })
    renderTab({ published: false, currentVersionId: null })
    expect(screen.getByText(/只有已发布的故事才能生成故事短片/)).toBeTruthy()
    const button = screen.getByRole('button', {
      name: /生成故事短片/,
    }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
  })

  it('已发布 + authoring 时可生成，不再展示分辨率/预算摘要行', () => {
    mockCaps.mockReturnValue({ isLoading: false, data: CAPS })
    renderTab()
    const button = screen.getByRole('button', {
      name: /生成故事短片/,
    }) as HTMLButtonElement
    expect(button.disabled).toBe(false)
    expect(screen.queryByText(/单支预算/)).toBeNull()
    expect(screen.queryByText('9:16')).toBeNull()
    expect(screen.getByText('当前为系统音色试跑')).toBeTruthy()
  })

  it('复刻模式但音色未就绪时阻止出片', () => {
    mockCaps.mockReturnValue({
      isLoading: false,
      data: { ...CAPS, ttsMode: 'cloned', voicesReady: false },
    })
    renderTab()
    expect(screen.getByText('复刻音色未就绪')).toBeTruthy()
  })

  it('有待审核作业时渲染卡片并传入 reviewWritable', () => {
    mockCaps.mockReturnValue({
      isLoading: false,
      data: { ...CAPS, reviewWritable: true },
    })
    const job: VideoJobSummary = {
      id: 'job-1',
      episodeId: 'ep-1',
      episodeVersionId: 'v-1',
      businessKey: 'elly/1/3',
      contentHash: 'hash',
      kind: 'teaser',
      status: 'awaiting_review',
      stage: 'review',
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
    mockJobs.mockReturnValue({ data: [job], isLoading: false, error: null })
    renderTab()
    expect(screen.getByText('elly/1/3')).toBeTruthy()
    expect(screen.getByRole('button', { name: /审核分镜/ })).toBeTruthy()
    mockJobs.mockReturnValue({ data: [], isLoading: false, error: null })
  })

  it('能力加载中显示加载态', () => {
    mockCaps.mockReturnValue({ isLoading: true, data: undefined })
    const { container } = renderTab()
    expect(container.querySelector('.ant-spin')).toBeTruthy()
  })

  it('打开弹窗→填理由→提交：requestId/分辨率/理由随请求发出', async () => {
    createMutate.mockReset()
    createMutate.mockResolvedValue({ job: {}, reused: false })
    mockCaps.mockReturnValue({ isLoading: false, data: CAPS })
    renderTab()

    fireEvent.click(screen.getByRole('button', { name: /生成故事短片/ }))
    await screen.findByRole('dialog')
    fireEvent.change(document.querySelector('textarea')!, {
      target: { value: '给第 3 集做一支投放短片' },
    })
    fireEvent.click(screen.getByRole('button', { name: '开始生成' }))

    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1))
    const payload = createMutate.mock.calls[0][0]
    expect(payload).toMatchObject({
      episodeId: 'ep-1',
      episodeVersionId: 'v-1',
      resolution: '720P',
      reason: '给第 3 集做一支投放短片',
    })
    expect(payload.requestId).toMatch(/^video-/)
  })

  it('建单失败时在弹窗内显示可读错误', async () => {
    createMutate.mockReset()
    createMutate.mockRejectedValue(new Error('预估 60 元，超过单支预算 50 元'))
    mockCaps.mockReturnValue({ isLoading: false, data: CAPS })
    renderTab()

    fireEvent.click(screen.getByRole('button', { name: /生成故事短片/ }))
    await screen.findByRole('dialog')
    fireEvent.change(document.querySelector('textarea')!, {
      target: { value: '先试一次预算闸看看' },
    })
    fireEvent.click(screen.getByRole('button', { name: '开始生成' }))

    expect(
      await screen.findByText('预估 60 元，超过单支预算 50 元'),
    ).toBeTruthy()
  })
})
