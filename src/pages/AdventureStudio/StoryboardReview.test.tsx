import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import StoryboardReview from './StoryboardReview'
import type { VideoJobDetail } from '../../types/adventureVideo'

const {
  validateMutate,
  saveMutate,
  revoiceMutate,
  regenerateMutate,
  approveMutate,
  useVideoJob,
} = vi.hoisted(() => ({
  validateMutate: vi.fn(),
  saveMutate: vi.fn(),
  revoiceMutate: vi.fn(),
  regenerateMutate: vi.fn(),
  approveMutate: vi.fn(),
  useVideoJob: vi.fn(),
}))

vi.mock('../../api/adventureVideo', () => ({
  useVideoJob,
  useValidateVideoStoryboard: vi.fn(() => ({
    mutateAsync: validateMutate,
    isPending: false,
  })),
  useSaveVideoStoryboard: vi.fn(() => ({
    mutateAsync: saveMutate,
    isPending: false,
  })),
  useRevoiceVideoStoryboard: vi.fn(() => ({
    mutateAsync: revoiceMutate,
    isPending: false,
  })),
  useRegenerateVideoStoryboard: vi.fn(() => ({
    mutateAsync: regenerateMutate,
    isPending: false,
  })),
  useApproveVideoStoryboard: vi.fn(() => ({
    mutateAsync: approveMutate,
    isPending: false,
  })),
}))

const BEATS = Array.from({ length: 4 }, (_, index) => ({
  order: index,
  sourceSegmentOrders: [0],
  speaker: index === 2 ? ('elly' as const) : ('narrator' as const),
  text: '星星'.repeat(33),
  emotion:
    index === 0
      ? ('calm' as const)
      : index === 2
        ? ('gentle' as const)
        : ('curious' as const),
  characters: ['elly'] as Array<'elly' | 'polly'>,
  shot: '远景',
  visualPrompt: '月光下的湖边',
  optional: false,
}))

const DETAIL: VideoJobDetail = {
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
  storyboard: {
    version: 1,
    title: '星星湖',
    businessKey: 'elly/1/3',
    episodeVersionId: 'v-1',
    contentHash: 'hash',
    aspect: '9:16',
    resolution: '720P',
    stylePrompt: '柔和 3D 毛绒质感',
    totalTextChars: 264,
    beats: BEATS,
    clips: [
      { order: 0, beats: [0, 1] },
      { order: 1, beats: [2, 3] },
    ],
  },
  shots: [],
  assets: [],
  review: {
    revision: 2,
    sourceSegments: [{ kind: 'narration', text: '小象沿着湖边慢慢走。' }],
    estimate: { totalSec: 55, chars: 264, clips: 2 },
    voice: {
      ready: true,
      totalSec: 57.4,
      textMatches: true,
      beats: BEATS.map((beat) => ({
        order: beat.order,
        durationSec: 14,
        audioUrl: `https://oss/beat-${beat.order}.wav`,
      })),
    },
    canApprove: true,
  },
}

function renderReview() {
  return render(<StoryboardReview jobId="job-1" open onClose={vi.fn()} />)
}

describe('StoryboardReview', () => {
  it('展示原文、实测时长与 beat 编辑器', () => {
    useVideoJob.mockReturnValue({ isLoading: false, data: DETAIL })
    renderReview()
    expect(screen.getByText(/小象沿着湖边慢慢走/)).toBeTruthy()
    expect(screen.getByText(/实测 57.4 秒/)).toBeTruthy()
    expect(screen.getAllByDisplayValue(BEATS[0].text).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /校\s*验/ })).toBeTruthy()
  })

  it('校验成功后展示预估', async () => {
    validateMutate.mockReset()
    validateMutate.mockResolvedValue({
      estimate: { totalSec: 56.2, chars: 264, clips: 2 },
    })
    useVideoJob.mockReturnValue({ isLoading: false, data: DETAIL })
    renderReview()
    fireEvent.click(screen.getByRole('button', { name: /校\s*验/ }))
    await waitFor(() =>
      expect(screen.getByText(/校验通过：预估 56.2 秒/)).toBeTruthy(),
    )
  })

  it('编辑后保存，revision 与 storyboard 一起提交', async () => {
    saveMutate.mockReset()
    saveMutate.mockResolvedValue({ revision: 3 })
    useVideoJob.mockReturnValue({ isLoading: false, data: DETAIL })
    renderReview()
    fireEvent.change(screen.getAllByDisplayValue(BEATS[0].text)[0], {
      target: { value: '新的文案'.repeat(20) },
    })
    const save = screen.getByRole('button', {
      name: /保\s*存/,
    }) as HTMLButtonElement
    expect(save.disabled).toBe(false)
    fireEvent.click(save)
    await waitFor(() => expect(saveMutate).toHaveBeenCalledTimes(1))
    expect(saveMutate.mock.calls[0][0]).toMatchObject({
      jobId: 'job-1',
      expectedRevision: 2,
    })
    expect(saveMutate.mock.calls[0][0].storyboard.beats[0].text).toBe(
      '新的文案'.repeat(20),
    )
  })

  it('审批要理由；填够理由后提交并关闭', async () => {
    approveMutate.mockReset()
    approveMutate.mockResolvedValue({})
    const onClose = vi.fn()
    useVideoJob.mockReturnValue({ isLoading: false, data: DETAIL })
    render(<StoryboardReview jobId="job-1" open onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: '通过并生成' }))
    await waitFor(() =>
      expect(document.querySelector('.ant-modal')).toBeTruthy(),
    )
    const modal = document.querySelector('.ant-modal') as HTMLElement
    const ok = Array.from(modal.querySelectorAll('button')).find((button) =>
      /提\s*交/.test(button.textContent ?? ''),
    ) as HTMLButtonElement
    expect(ok.disabled).toBe(true)
    fireEvent.change(modal.querySelector('textarea')!, {
      target: { value: '实测 57 秒，内容与原文一致，同意出片' },
    })
    fireEvent.click(ok)
    await waitFor(() => expect(approveMutate).toHaveBeenCalledTimes(1))
    expect(approveMutate.mock.calls[0][0]).toMatchObject({
      jobId: 'job-1',
      expectedRevision: 2,
    })
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('有未保存修改时拒绝重配/审批', () => {
    useVideoJob.mockReturnValue({ isLoading: false, data: DETAIL })
    renderReview()
    fireEvent.change(screen.getAllByDisplayValue(BEATS[0].text)[0], {
      target: { value: '改一下' },
    })
    expect(
      (screen.getByRole('button', { name: '重新配音' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
    expect(
      (screen.getByRole('button', { name: '通过并生成' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
  })

  it('文案与音频不一致时禁用审批并提示', () => {
    useVideoJob.mockReturnValue({
      isLoading: false,
      data: {
        ...DETAIL,
        review: {
          ...DETAIL.review,
          canApprove: false,
          voice: { ...DETAIL.review.voice, textMatches: false },
        },
      },
    })
    renderReview()
    expect(screen.getByText(/文案已改，需重新配音/)).toBeTruthy()
    expect(
      (screen.getByRole('button', { name: '通过并生成' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
  })


  it('校验/保存失败展示服务端错误', async () => {
    validateMutate.mockReset()
    saveMutate.mockReset()
    validateMutate.mockRejectedValue(new Error('校验失败：字数超预算'))
    saveMutate.mockRejectedValue(new Error('保存失败：revision 冲突'))
    useVideoJob.mockReturnValue({ isLoading: false, data: DETAIL })
    renderReview()

    fireEvent.click(screen.getByRole('button', { name: /校\s*验/ }))
    await waitFor(() =>
      expect(screen.getByText('校验失败：字数超预算')).toBeTruthy(),
    )

    fireEvent.change(screen.getAllByDisplayValue(BEATS[0].text)[0], {
      target: { value: '改一下' },
    })
    fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }))
    await waitFor(() =>
      expect(screen.getByText('保存失败：revision 冲突')).toBeTruthy(),
    )
  })

  it('有未保存修改时点重新生成被拦下', () => {
    useVideoJob.mockReturnValue({ isLoading: false, data: DETAIL })
    renderReview()
    fireEvent.change(screen.getAllByDisplayValue(BEATS[0].text)[0], {
      target: { value: '改一下' },
    })
    fireEvent.click(screen.getByRole('button', { name: '重新生成分镜' }))
    expect(screen.getByText('有未保存的修改，请先保存再操作。')).toBeTruthy()
  })

  it('重新配音成功提交并关闭；失败展示错误', async () => {
    revoiceMutate.mockReset()
    revoiceMutate.mockResolvedValue({})
    const onClose = vi.fn()
    useVideoJob.mockReturnValue({ isLoading: false, data: DETAIL })
    const first = render(<StoryboardReview jobId="job-1" open onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: '重新配音' }))
    await waitFor(() => expect(document.querySelector('.ant-modal')).toBeTruthy())
    const modal = document.querySelector('.ant-modal') as HTMLElement
    fireEvent.change(modal.querySelector('textarea')!, {
      target: { value: '文案改过，重新配音确认时长' },
    })
    fireEvent.click(
      Array.from(modal.querySelectorAll('button')).find((button) =>
        /提\s*交/.test(button.textContent ?? ''),
      )!,
    )
    await waitFor(() => expect(revoiceMutate).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    first.unmount()

    revoiceMutate.mockRejectedValue(new Error('重新配音失败'))
    render(<StoryboardReview jobId="job-1" open onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '重新配音' }))
    await waitFor(() => expect(document.querySelector('.ant-modal')).toBeTruthy())
    const modal2 = document.querySelector('.ant-modal') as HTMLElement
    fireEvent.change(modal2.querySelector('textarea')!, {
      target: { value: '文案改过，重新配音确认时长' },
    })
    fireEvent.click(
      Array.from(modal2.querySelectorAll('button')).find((button) =>
        /提\s*交/.test(button.textContent ?? ''),
      )!,
    )
    await waitFor(() =>
      expect(screen.getByText('重新配音失败')).toBeTruthy(),
    )
  })

  it('画风/镜头/画面/情绪/optional 都能改', () => {
    useVideoJob.mockReturnValue({ isLoading: false, data: DETAIL })
    renderReview()

    fireEvent.change(screen.getByDisplayValue('柔和 3D 毛绒质感'), {
      target: { value: '新的画风' },
    })
    fireEvent.change(screen.getAllByPlaceholderText('景别/运镜/动作')[0], {
      target: { value: '特写' },
    })
    fireEvent.change(screen.getAllByPlaceholderText('画面描述')[0], {
      target: { value: '新的画面' },
    })
    fireEvent.click(screen.getAllByRole('switch')[0])

    fireEvent.mouseDown(screen.getAllByRole('combobox')[0])
    fireEvent.click(screen.getByText('兴奋'))

    expect(screen.getByDisplayValue('新的画风')).toBeTruthy()
    expect(screen.getByDisplayValue('特写')).toBeTruthy()
    expect(screen.getByDisplayValue('新的画面')).toBeTruthy()
  })

  it('理由弹窗可以取消', async () => {
    useVideoJob.mockReturnValue({ isLoading: false, data: DETAIL })
    renderReview()
    fireEvent.click(screen.getByRole('button', { name: '重新配音' }))
    await waitFor(() => expect(document.querySelector('.ant-modal')).toBeTruthy())
    const modal = document.querySelector('.ant-modal') as HTMLElement
    const cancel = Array.from(modal.querySelectorAll('button')).find((button) =>
      /返\s*回/.test(button.textContent ?? ''),
    )!
    revoiceMutate.mockReset()
    fireEvent.click(cancel)
    expect(revoiceMutate).not.toHaveBeenCalled()
  })

  it('重新生成分镜走独立确认弹窗', async () => {
    regenerateMutate.mockReset()
    regenerateMutate.mockResolvedValue({})
    const onClose = vi.fn()
    useVideoJob.mockReturnValue({ isLoading: false, data: DETAIL })
    render(<StoryboardReview jobId="job-1" open onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: '重新生成分镜' }))
    await waitFor(() =>
      expect(document.querySelector('.ant-modal')).toBeTruthy(),
    )
    const modal = document.querySelector('.ant-modal') as HTMLElement
    fireEvent.change(modal.querySelector('textarea')!, {
      target: { value: '分镜结构不对，重新生成一版' },
    })
    const ok = Array.from(modal.querySelectorAll('button')).find((button) =>
      /提\s*交/.test(button.textContent ?? ''),
    ) as HTMLButtonElement
    fireEvent.click(ok)
    await waitFor(() => expect(regenerateMutate).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})
