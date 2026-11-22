import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import PreviewSimulator from './PreviewSimulator'
import { useAdventureSimulate } from '../../api/queries'
import type {
  CapabilitiesResponse,
  EpisodeContent,
  EpisodeIdentity,
  SimulationResult,
} from '../../types/adventureAdmin'

vi.mock('../../api/queries', () => ({
  useAdventureSimulate: vi.fn(),
}))

const mockSimulate = useAdventureSimulate as unknown as ReturnType<typeof vi.fn>

const capabilities: CapabilitiesResponse = {
  season: 1,
  characterKeys: ['elly'],
  interactionTypes: ['open_question', 'two_choice', 'repeat_after_me', 'reward'],
  replyWaitingInteractionTypes: ['open_question', 'two_choice', 'repeat_after_me'],
  segmentKinds: ['narration', 'interaction'],
  lintThresholds: {
    maxInteractionTextChars: 60,
    maxNarrationTextChars: 220,
    maxTitleChars: 24,
    maxStarsPerEpisode: 3,
    minChoiceTextChars: 2,
    forbiddenWords: [],
  },
  simulationThresholds: { maxAwaitPoints: 2, maxSessionSeconds: 120 },
  fixedExitText: '不想玩了。',
  profile: 'authoring',
  authoring: true,
  testStoryEnabled: false,
}

const identity: EpisodeIdentity = { characterKey: 'elly', season: 1, episodeNumber: 1 }

const content: EpisodeContent = {
  title: '听风原野第一天',
  recap: null,
  segments: [{ order: 0, kind: 'narration', text: '森林的清晨很安静。' }],
}

function mutation(overrides: Record<string, unknown> = {}) {
  return {
    mutate: vi.fn(),
    data: undefined,
    error: null,
    isPending: false,
    reset: vi.fn(),
    ...overrides,
  }
}

const result: SimulationResult = {
  businessKey: 'elly/1/1',
  recap: null,
  beats: [
    {
      says: ['森林的清晨很安静。', '你想先去森林，还是先去海边？'],
      stopsAtOrder: 1,
      waitsForReply: true,
      interactionType: 'two_choice',
      starsAwarded: 1,
      choices: [
        { key: 'A', text: '去森林', reply: '森林里有鸟叫。' },
        { key: 'B', text: '去海边', reply: '海浪拍上沙滩。' },
      ],
      praise: null,
      outcome: 'await_reply',
    },
    {
      says: ['真棒，我们继续。'],
      stopsAtOrder: null,
      waitsForReply: false,
      interactionType: null,
      starsAwarded: 0,
      choices: null,
      praise: '哇，你说得真清楚！',
      outcome: 'episode_complete',
    },
  ],
  totalSpokenChars: 120,
  estimatedSeconds: 180,
  awaitsReplyCount: 3,
  totalStars: 2,
  problems: [
    {
      severity: 'warning',
      code: 'AWAIT_TOO_MANY',
      message: '开口次数超过上限',
      businessKey: 'elly/1/1',
    },
  ],
}

describe('PreviewSimulator', () => {
  it('首次进去是「试播整集」，点击后发一次请求并保留在结果里', () => {
    const sim = mutation()
    mockSimulate.mockReturnValue(sim)

    render(<PreviewSimulator identity={identity} content={content} capabilities={capabilities} />)
    expect(screen.getByRole('button', { name: /试播整集/ })).toBeTruthy()
    expect(screen.getByText(/不写库、不留审计/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /试播整集/ }))

    expect(sim.mutate).toHaveBeenCalledTimes(1)
    expect(sim.mutate).toHaveBeenCalledWith({ identity, content })
    expect(screen.getByRole('button', { name: /重新试播/ })).toBeTruthy()
  })

  it('请求失败时显示服务端消息，不当成「没有结果」', () => {
    mockSimulate.mockReturnValue(
      mutation({ error: { status: 500, message: '试播服务挂了', domainCode: null } }),
    )

    render(<PreviewSimulator identity={identity} content={content} capabilities={capabilities} />)
    expect(screen.getByText('试播失败')).toBeTruthy()
    expect(screen.getByText('试播服务挂了')).toBeTruthy()
  })

  it('请求进行中按钮转圈', () => {
    mockSimulate.mockReturnValue(mutation({ isPending: true }))
    render(<PreviewSimulator identity={identity} content={content} capabilities={capabilities} />)
    expect(screen.getByRole('button', { name: /试播整集/ })).toHaveClass('ant-btn-loading')
  })

  it('结果面板摊开时长 / 开口次数 / 星光 / 字数，超限标红', () => {
    mockSimulate.mockReturnValue(mutation({ data: result }))
    render(<PreviewSimulator identity={identity} content={content} capabilities={capabilities} />)

    const duration = screen.getByText('3 分 0 秒 / 上限 2 分 0 秒')
    expect(duration).toBeTruthy()
    expect(duration.className).toContain('ant-typography-danger')
    const awaits = screen.getByText('3 / 上限 2')
    expect(awaits.className).toContain('ant-typography-danger')
    expect(screen.getByText('2 颗')).toBeTruthy()
    expect(screen.getByText('120 字')).toBeTruthy()
  })

  it('未超限时数字不着色，也不渲染问题块', () => {
    mockSimulate.mockReturnValue(
      mutation({
        data: {
          ...result,
          estimatedSeconds: 30,
          awaitsReplyCount: 1,
          problems: [],
        },
      }),
    )
    render(<PreviewSimulator identity={identity} content={content} capabilities={capabilities} />)

    const duration = screen.getByText('30 秒 / 上限 2 分 0 秒')
    expect(duration.className).not.toContain('ant-typography-danger')
    expect(screen.queryByText(/试播发现/)).toBeNull()
  })

  it('问题列表逐条显示 code 与说明', () => {
    mockSimulate.mockReturnValue(mutation({ data: result }))
    render(<PreviewSimulator identity={identity} content={content} capabilities={capabilities} />)

    expect(screen.getByText('试播发现 1 个问题')).toBeTruthy()
    expect(screen.getByText('AWAIT_TOO_MANY')).toBeTruthy()
    expect(screen.getByText('开口次数超过上限')).toBeTruthy()
  })

  it('时间线区分「停等回答」与「连着播」，并展示选项、表扬、发星与完集', () => {
    mockSimulate.mockReturnValue(mutation({ data: result }))
    render(<PreviewSimulator identity={identity} content={content} capabilities={capabilities} />)

    expect(screen.getByText('第 1 拍')).toBeTruthy()
    expect(screen.getByText(/停在 #1 等孩子回答 · 二选一/)).toBeTruthy()
    expect(screen.getByText('这一拍发 1 颗星')).toBeTruthy()
    expect(screen.getByText('等回答')).toBeTruthy()
    expect(screen.getByText('孩子可以选：A（去森林） / B（去海边）')).toBeTruthy()

    expect(screen.getByText('第 2 拍')).toBeTruthy()
    expect(screen.getByText('连着播，不等回答')).toBeTruthy()
    expect(screen.getByText('这一集播完了')).toBeTruthy()
    expect(
      screen.getByText('孩子开口后会听到，不判对错：哇，你说得真清楚！'),
    ).toBeTruthy()
  })
})
