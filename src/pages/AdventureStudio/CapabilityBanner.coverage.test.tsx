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

  it('可写环境不再渲染能力横幅：环境标签已移到页面 Header', () => {
    mockCaps.mockReturnValue(query({ data: capabilities }))
    const { container } = render(<CapabilityBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('只读环境只保留只读告警，环境标签由页面 Header 展示', () => {
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
    expect(screen.queryByText('只读环境 · readonly')).toBeNull()
    expect(screen.queryByText(/禁用词/)).toBeNull()
  })
})
