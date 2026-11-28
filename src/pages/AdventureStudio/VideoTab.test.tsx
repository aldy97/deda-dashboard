import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import VideoTab from './VideoTab'
import { useVideoCapabilities } from '../../api/adventureVideo'
import type { VideoCapabilities } from '../../types/adventureVideo'

vi.mock('../../api/adventureVideo', () => ({
  useVideoCapabilities: vi.fn(),
  useVideoJobs: vi.fn(() => ({ data: [], isLoading: false, error: null })),
  useCreateVideoJob: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}))

const mockCaps = useVideoCapabilities as unknown as ReturnType<typeof vi.fn>

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
    mockCaps.mockReturnValue({ isLoading: false, data: { ...CAPS, enabled: false } })
    renderTab()
    expect(screen.getByText('短视频工作台在本环境未开启')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /生成 60 秒预告/ })).toBeNull()
  })

  it('未发布时禁用生成并给出提示', () => {
    mockCaps.mockReturnValue({ isLoading: false, data: CAPS })
    renderTab({ published: false, currentVersionId: null })
    expect(screen.getByText(/只有已发布的故事才能生成预告/)).toBeTruthy()
    const button = screen.getByRole('button', {
      name: /生成 60 秒预告/,
    }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
  })

  it('已发布 + authoring 时可生成，并展示预算与试跑提示', () => {
    mockCaps.mockReturnValue({ isLoading: false, data: CAPS })
    renderTab()
    const button = screen.getByRole('button', {
      name: /生成 60 秒预告/,
    }) as HTMLButtonElement
    expect(button.disabled).toBe(false)
    expect(screen.getByText(/单支预算 50.00 元/)).toBeTruthy()
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
})
