import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import AdventureStudio from './index'
import type {
  CapabilitiesResponse,
  EpisodeDetail,
  EpisodeSummary,
} from '../../types/adventureAdmin'
import {
  useAdventureAudit,
  useAdventureAuthoring,
  useAdventureCapabilities,
  useAdventureEpisode,
  useAdventureEpisodes,
  useAdventureExport,
  useAdventureImport,
  useAdventureImportPreview,
  useAdventureLint,
  useAdventurePublishLint,
  useAdventureRecovery,
  useAdventureRecoveryReset,
  useAdventureRecoverySweep,
} from '../../api/queries'

/**
 * 页面级集成：mock 掉读接口与写函数，渲染真实页面与四个真实 tab。
 * 验证「进页面只挂当前 tab、?tab= 能还原现场、切 tab 会换内容并写 URL、
 * 打开/关闭详情抽屉不丢列表上下文」。
 */
vi.mock('../../api/queries', () => ({
  useAdventureCapabilities: vi.fn(),
  useAdventureAuthoring: vi.fn(),
  useAdventureEpisodes: vi.fn(),
  useAdventureEpisode: vi.fn(),
  useAdventureAudit: vi.fn(),
  useAdventureRecovery: vi.fn(),
  useAdventureLint: vi.fn(),
  useAdventurePublishLint: vi.fn(),
  useAdventureExport: vi.fn(),
  useAdventureImportPreview: vi.fn(),
  useAdventureImport: vi.fn(),
  useAdventureRecoverySweep: vi.fn(),
  useAdventureRecoveryReset: vi.fn(),
}))

vi.mock('../../api/adventureAdmin', () => ({
  createEpisode: vi.fn(),
  saveDraft: vi.fn(),
  publishEpisode: vi.fn(),
  revertEpisode: vi.fn(),
  retireEpisode: vi.fn(),
  restoreEpisode: vi.fn(),
  discardEpisodeDraft: vi.fn(),
  discardEpisode: vi.fn(),
  exportBundle: vi.fn(),
  previewImport: vi.fn(),
  applyImport: vi.fn(),
  convertScript: vi.fn(),
  checkContent: vi.fn(),
  simulateEpisode: vi.fn(),
  assignTestStory: vi.fn(),
  clearTestStory: vi.fn(),
  runRecoverySweep: vi.fn(),
  resetRecoveryBreaker: vi.fn(),
}))

const mockCaps = useAdventureCapabilities as unknown as ReturnType<typeof vi.fn>
const mockAuthoring = useAdventureAuthoring as unknown as ReturnType<typeof vi.fn>
const mockEpisodes = useAdventureEpisodes as unknown as ReturnType<typeof vi.fn>
const mockEpisode = useAdventureEpisode as unknown as ReturnType<typeof vi.fn>
const mockAudit = useAdventureAudit as unknown as ReturnType<typeof vi.fn>
const mockRecovery = useAdventureRecovery as unknown as ReturnType<typeof vi.fn>
const mockLint = useAdventureLint as unknown as ReturnType<typeof vi.fn>
const mockPublishLint = useAdventurePublishLint as unknown as ReturnType<typeof vi.fn>
const mockExport = useAdventureExport as unknown as ReturnType<typeof vi.fn>
const mockPreview = useAdventureImportPreview as unknown as ReturnType<typeof vi.fn>
const mockImport = useAdventureImport as unknown as ReturnType<typeof vi.fn>
const mockSweep = useAdventureRecoverySweep as unknown as ReturnType<typeof vi.fn>
const mockReset = useAdventureRecoveryReset as unknown as ReturnType<typeof vi.fn>

const capabilities: CapabilitiesResponse = {
  season: 1,
  characterKeys: ['elly'],
  interactionTypes: ['open_question', 'two_choice'],
  replyWaitingInteractionTypes: ['open_question'],
  segmentKinds: ['narration', 'interaction'],
  lintThresholds: {
    maxInteractionTextChars: 60,
    maxNarrationTextChars: 220,
    maxTitleChars: 24,
    maxStarsPerEpisode: 3,
    minChoiceTextChars: 2,
    forbiddenWords: [],
  },
  simulationThresholds: { maxAwaitPoints: 12, maxSessionSeconds: 900 },
  fixedExitText: '不想玩了。',
  profile: 'readonly',
  authoring: false,
  testStoryEnabled: false,
}

const summary: EpisodeSummary = {
  id: 'ep1',
  characterKey: 'elly',
  season: 1,
  episodeNumber: 1,
  businessKey: 'elly/1/1',
  title: '听风原野第一天',
  recap: null,
  published: true,
  retiredAt: null,
  currentVersionId: 'ver2',
  currentVersion: 2,
  publishedAt: '2026-11-20T10:00:00.000Z',
  hasDraft: true,
  draftVersionId: 'd1',
  draftVersion: 1,
  draftUpdatedAt: '2026-11-21T10:00:00.000Z',
  draftUpdatedBy: 'alice',
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-21T10:00:00.000Z',
}

const detail: EpisodeDetail = {
  summary,
  content: {
    title: '听风原野第一天',
    recap: null,
    segments: [{ order: 0, kind: 'narration', text: '森林的清晨很安静。' }],
  },
  contentSource: 'draft',
  baseVersionId: 'ver2',
  baseDraftUpdatedAt: '2026-11-21T10:00:00.000Z',
  lint: { ok: true, issues: [], errors: [], warnings: [] },
  impact: {
    devicesPlayingToday: 3,
    devicesStaleCrossDay: 0,
    devicesPinnedToOlderVersions: 0,
    totalDevicesEverStarted: 12,
    publishedVersionCount: 2,
  },
}

function auditHook() {
  return {
    data: { total: 0, page: 1, pageSize: 20, items: [] },
    isLoading: false,
    error: null,
  }
}

function recoveryHook() {
  return {
    data: {
      breaker: {
        enabled: true,
        tripped: false,
        failureCount: 0,
        degraded: false,
        trippedAt: null,
        windowMs: 600_000,
        threshold: 5,
        recentReasons: [],
        error: null,
      },
      config: {
        enabled: true,
        sweepIntervalMs: 300_000,
        staleAwaitMs: 600_000,
        staleAwaitAction: 'alert' as const,
        breakerWindowMs: 600_000,
        breakerThreshold: 5,
        breakerTrippedTtlSeconds: 600,
      },
      sweeps: [],
      engineFailures: [],
    },
    isLoading: false,
    error: null,
  }
}

function mockReads() {
  mockCaps.mockReturnValue({
    data: capabilities,
    isPending: false,
    error: null,
  })
  mockAuthoring.mockReturnValue(false)
  mockEpisodes.mockReturnValue({
    data: { items: [summary], total: 1 },
    isLoading: false,
    error: null,
  })
  mockEpisode.mockImplementation((episodeId: string | null) =>
    episodeId === null
      ? { data: undefined, isLoading: false, error: null }
      : { data: detail, isLoading: false, error: null, refetch: vi.fn() },
  )
  mockAudit.mockReturnValue(auditHook())
  mockRecovery.mockReturnValue(recoveryHook())
  mockLint.mockReturnValue({ mutate: vi.fn(), isPending: false, error: null })
  mockPublishLint.mockReturnValue({ data: undefined, isLoading: false })
  mockExport.mockReturnValue({
    data: undefined,
    error: null,
    isPending: false,
    mutate: vi.fn(),
  })
  mockPreview.mockReturnValue({
    data: undefined,
    error: null,
    isPending: false,
    mutate: vi.fn(),
    reset: vi.fn(),
  })
  mockImport.mockReturnValue({
    data: undefined,
    error: null,
    isPending: false,
    mutate: vi.fn(),
    reset: vi.fn(),
  })
  mockSweep.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    error: null,
  })
  mockReset.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    error: null,
  })
}

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.search}</div>
}

function renderPage(entry = '/adventure') {
  mockReads()
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <LocationProbe />
      <AdventureStudio />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockCaps.mockReset()
  mockAuthoring.mockReset()
  mockEpisodes.mockReset()
  mockEpisode.mockReset()
  mockAudit.mockReset()
  mockRecovery.mockReset()
  mockLint.mockReset()
  mockPublishLint.mockReset()
  mockExport.mockReset()
  mockPreview.mockReset()
  mockImport.mockReset()
  mockSweep.mockReset()
  mockReset.mockReset()
})

describe('冒险内容工作台集成：四个 tab 的挂载与还原', () => {
  it('默认进「故事集」，真实列表渲染数据，其余 tab 的请求组件不挂载', () => {
    renderPage()

    expect(screen.getByRole('tab', { name: '故事集' })).toBeInTheDocument()
    expect(screen.getAllByText('elly/1/1').length).toBeGreaterThan(0)
    expect(screen.getByText('听风原野第一天')).toBeInTheDocument()
    expect(screen.getByText('共 1 集')).toBeInTheDocument()

    expect(screen.queryByText('① 从本环境导出（只取已发布快照）')).toBeNull()
    expect(screen.queryByText('没有符合条件的审计记录')).toBeNull()
    expect(screen.queryByText('恢复熔断器')).toBeNull()
    expect(screen.getByTestId('location').textContent).toBe('')
  })

  it('?tab=transfer 直接还原「跨环境搬运」的导出与导入两张卡', () => {
    renderPage('/adventure?tab=transfer')

    expect(
      screen.getByText('① 从本环境导出（只取已发布快照）'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('② 导入到本环境（先 dry-run，再手输确认码）'),
    ).toBeInTheDocument()
    expect(screen.queryByText('共 1 集')).toBeNull()
  })

  it('?tab=audit 直接还原审计流水', () => {
    renderPage('/adventure?tab=audit')

    expect(screen.getByText('没有符合条件的审计记录')).toBeInTheDocument()
    expect(screen.getByText('全部动作')).toBeInTheDocument()
    expect(screen.getByTestId('location').textContent).toBe('?tab=audit')
  })

  it('?tab=recovery 直接还原自愈面板', () => {
    renderPage('/adventure?tab=recovery')

    expect(screen.getByText('恢复熔断器')).toBeInTheDocument()
    expect(
      screen.getByText('兜底链路正常，熔断器未跳闸'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('定时巡检（最近 20 份，新在前）'),
    ).toBeInTheDocument()
  })

  it('点 tab 换内容并写 URL：故事集 → 审计流水 → 自愈', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('tab', { name: '审计流水' }))
    expect(screen.getByText('没有符合条件的审计记录')).toBeInTheDocument()
    expect(screen.queryByText('共 1 集')).toBeNull()
    expect(screen.getByTestId('location').textContent).toBe('?tab=audit')

    await user.click(screen.getByRole('tab', { name: '自愈与兜底' }))
    expect(screen.getByText('恢复熔断器')).toBeInTheDocument()
    expect(screen.queryByText('没有符合条件的审计记录')).toBeNull()
    expect(screen.getByTestId('location').textContent).toBe('?tab=recovery')

    await user.click(screen.getByRole('tab', { name: '故事集' }))
    expect(screen.getByText('共 1 集')).toBeInTheDocument()
    expect(screen.getByTestId('location').textContent).toBe('?tab=episodes')
  })

  it('非法 tab 值回落故事集，页面照常渲染', () => {
    renderPage('/adventure?tab=legacy')

    expect(screen.getByText('共 1 集')).toBeInTheDocument()
    expect(screen.getByTestId('location').textContent).toBe('?tab=legacy')
  })
})

describe('冒险内容工作台集成：详情抽屉', () => {
  it('点行打开详情抽屉，URL 记下 episodeId', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByText('听风原野第一天'))

    expect(await screen.findByText('正在看草稿')).toBeInTheDocument()
    expect(screen.getByText('森林的清晨很安静。')).toBeInTheDocument()
    expect(screen.getByTestId('location').textContent).toBe('?episodeId=ep1')
  })

  it('从 ?episodeId= 进入时直接打开对应抽屉', async () => {
    renderPage('/adventure?tab=episodes&episodeId=ep1')

    expect(await screen.findByText('正在看草稿')).toBeInTheDocument()
    expect(screen.getByTestId('location').textContent).toBe(
      '?tab=episodes&episodeId=ep1',
    )
  })

  it('关闭抽屉后清掉 episodeId，列表与筛选状态仍在', async () => {
    renderPage('/adventure?tab=episodes&episodeId=ep1')

    expect(await screen.findByText('正在看草稿')).toBeInTheDocument()
    fireEvent.click(document.querySelector('.ant-drawer-close') as HTMLElement)

    await waitFor(() =>
      expect(screen.queryByText('正在看草稿')).toBeNull(),
    )
    expect(screen.getByText('共 1 集')).toBeInTheDocument()
    expect(screen.getByTestId('location').textContent).toBe('?tab=episodes')
  })
})
