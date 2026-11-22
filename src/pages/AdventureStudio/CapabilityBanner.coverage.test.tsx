import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import CapabilityBanner from './CapabilityBanner'
import { useAdventureCapabilities } from '../../api/queries'
import type { CapabilitiesResponse } from '../../types/adventureAdmin'

vi.mock('../../api/queries', () => ({
  useAdventureCapabilities: vi.fn(),
}))

const mockCaps = useAdventureCapabilities as unknown as ReturnType<typeof vi.fn>

const capabilities: CapabilitiesResponse = {
  season: 2,
  characterKeys: ['elly', 'polly'],
  interactionTypes: [
    'open_question',
    'two_choice',
    'repeat_after_me',
    'reward',
  ],
  replyWaitingInteractionTypes: [
    'open_question',
    'two_choice',
    'repeat_after_me',
  ],
  segmentKinds: ['narration', 'interaction'],
  lintThresholds: {
    maxInteractionTextChars: 60,
    maxNarrationTextChars: 220,
    maxTitleChars: 24,
    maxStarsPerEpisode: 3,
    minChoiceTextChars: 2,
    forbiddenWords: ['暴力', '血'],
  },
  simulationThresholds: {
    maxAwaitPoints: 12,
    maxSessionSeconds: 900,
  },
  fixedExitText: '不想玩了。',
  profile: 'authoring',
  authoring: true,
  testStoryEnabled: false,
}

function query(overrides: Record<string, unknown> = {}) {
  return { isPending: false, error: null, data: undefined, ...overrides }
}

describe('CapabilityBanner', () => {
  it('能力清单还在加载时什么都不渲染', () => {
    mockCaps.mockReturnValue(query({ isPending: true }))
    const { container } = render(<CapabilityBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('403 是「没权限」而不是故障，给出申请超管的具体做法', () => {
    mockCaps.mockReturnValue(
      query({ error: { status: 403, message: 'Forbidden', domainCode: null } }),
    )
    render(<CapabilityBanner />)
    expect(screen.getByText('你没有冒险内容管理权限')).toBeTruthy()
    expect(screen.getByText(/ANALYTICS_ADMIN_USERS/)).toBeTruthy()
  })

  it('其它错误按加载失败展示服务端消息', () => {
    mockCaps.mockReturnValue(
      query({ error: { status: 500, message: '数据库连不上', domainCode: null } }),
    )
    render(<CapabilityBanner />)
    expect(screen.getByText('能力清单加载失败')).toBeTruthy()
    expect(screen.getByText('数据库连不上')).toBeTruthy()
  })

  it('成功但没数据时不渲染空壳横幅', () => {
    mockCaps.mockReturnValue(query())
    const { container } = render(<CapabilityBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('可写环境展示阈值、IP、需孩子开口的交互原语与禁用词数量', () => {
    mockCaps.mockReturnValue(query({ data: capabilities }))
    render(<CapabilityBanner />)

    expect(screen.getByText('可写环境 · authoring')).toBeTruthy()
    expect(screen.getByText('第 2 季')).toBeTruthy()
    expect(screen.getByText('小象 Elly')).toBeTruthy()
    expect(screen.getByText('小马 Polly')).toBeTruthy()
    expect(
      screen.getByText(
        '交互原语：open_question（需孩子开口）、two_choice（需孩子开口）、repeat_after_me（需孩子开口）、reward',
      ),
    ).toBeTruthy()
    expect(
      screen.getByText(
        /旁白 ≤ 220 字 · 互动引导词 ≤ 60 字 · 标题 ≤ 24 字 · 单集星光 ≤ 3 颗 · 开口次数 ≤ 12 次 · 预计时长 ≤ 15 分钟 · 禁用词 2 个/,
      ),
    ).toBeTruthy()
    expect(screen.queryByText(/当前环境只读/)).toBeNull()
  })

  it('只读环境显式标出 profile，并说明这是设计如此', () => {
    mockCaps.mockReturnValue(
      query({
        data: {
          ...capabilities,
          authoring: false,
          profile: 'readonly',
          lintThresholds: { ...capabilities.lintThresholds, forbiddenWords: [] },
        },
      }),
    )
    render(<CapabilityBanner />)

    expect(
      screen.getByText('当前环境只读（CONTENT_ADMIN_PROFILE=readonly），所有写操作会被服务端拒绝'),
    ).toBeTruthy()
    expect(screen.getByText('只读环境 · readonly')).toBeTruthy()
    expect(screen.queryByText(/禁用词/)).toBeNull()
  })
})
