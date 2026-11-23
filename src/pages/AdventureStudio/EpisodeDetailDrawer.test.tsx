import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EpisodeDetailDrawer from './EpisodeDetailDrawer'
import type { EpisodeContent, EpisodeDetail } from '../../types/adventureAdmin'
import {
  useAdventureAuthoring,
  useAdventureCapabilities,
  useAdventureEpisode,
  useAdventureLint,
  useAdventurePublishLint,
} from '../../api/queries'

vi.mock('../../api/queries', () => ({
  useAdventureAuthoring: vi.fn(),
  useAdventureCapabilities: vi.fn(),
  useAdventureEpisode: vi.fn(),
  useAdventureLint: vi.fn(),
  useAdventurePublishLint: vi.fn(),
}))

vi.mock('./EpisodeWorkspace', () => ({
  default: (props: {
    state: { change: (next: EpisodeContent) => void; dirty: boolean }
    onReload: () => void
  }) => (
    <div data-testid="workspace-tab" data-dirty={String(props.state.dirty)}>
      <button
        onClick={() =>
          props.state.change({
            title: '本地改动',
            recap: null,
            segments: [],
          })
        }
      >
        制造改动
      </button>
      <button onClick={props.onReload}>重新加载</button>
    </div>
  ),
}))

vi.mock('./VersionHistory', () => ({
  default: (props: { episodeId: string }) => (
    <div data-testid="versions-tab" data-episode={props.episodeId} />
  ),
}))

vi.mock('./ChoiceStatsPanel', () => ({
  default: (props: { episodeId: string }) => (
    <div data-testid="choices-tab" data-episode={props.episodeId} />
  ),
}))

vi.mock('./AuditLog', () => ({
  default: (props: { episodeId?: string }) => (
    <div data-testid="audit-tab" data-episode={props.episodeId ?? ''} />
  ),
}))

vi.mock('./DeviceTestAssign', () => ({
  default: (props: {
    episodeId: string
    characterKey: string | null
    authoring: boolean
    testStoryEnabled: boolean
  }) => (
    <div
      data-testid="test-tab"
      data-episode={props.episodeId}
      data-character={props.characterKey ?? ''}
      data-authoring={String(props.authoring)}
      data-enabled={String(props.testStoryEnabled)}
    />
  ),
}))

const mockAuthoring = useAdventureAuthoring as unknown as ReturnType<typeof vi.fn>
const mockCaps = useAdventureCapabilities as unknown as ReturnType<typeof vi.fn>
const mockEpisode = useAdventureEpisode as unknown as ReturnType<typeof vi.fn>
const mockLint = useAdventureLint as unknown as ReturnType<typeof vi.fn>
const mockPublishLint = useAdventurePublishLint as unknown as ReturnType<typeof vi.fn>

const capabilities = {
  season: 1,
  characterKeys: ['elly', 'polly'],
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
  profile: 'authoring',
  authoring: true,
  testStoryEnabled: true,
}

const content: EpisodeContent = {
  title: '听风原野第一天',
  recap: null,
  segments: [{ order: 0, kind: 'narration', text: '森林的清晨很安静。' }],
}

function detail(overrides: Partial<EpisodeDetail> = {}): EpisodeDetail {
  return {
    summary: {
      id: 'ep1',
      characterKey: 'elly',
      season: 1,
      episodeNumber: 1,
      businessKey: 'elly/1/1',
      title: '听风原野第一天',
      recap: null,
      published: true,
      retiredAt: null,
      currentVersionId: 'v2',
      currentVersion: 2,
      publishedAt: '2026-11-20T10:00:00.000Z',
      hasDraft: true,
      draftVersionId: 'd3',
      draftVersion: 3,
      draftUpdatedAt: '2026-11-21T10:00:00.000Z',
      draftUpdatedBy: 'alice',
      createdAt: '2026-11-01T10:00:00.000Z',
      updatedAt: '2026-11-21T10:00:00.000Z',
    },
    content,
    contentSource: 'draft',
    baseVersionId: 'v2',
    baseDraftUpdatedAt: '2026-11-21T10:00:00.000Z',
    lint: { ok: true, issues: [], errors: [], warnings: [] },
    impact: {
      devicesPlayingToday: 3,
      devicesStaleCrossDay: 1,
      devicesPinnedToOlderVersions: 2,
      totalDevicesEverStarted: 40,
      publishedVersionCount: 2,
    },
    ...overrides,
  }
}

function setup(options?: {
  episodeId?: string | null
  episode?: Record<string, unknown>
  authoring?: boolean
}) {
  const onClose = vi.fn()
  mockAuthoring.mockReturnValue(options?.authoring ?? true)
  mockCaps.mockReturnValue({ data: capabilities, isPending: false, error: null })
  mockEpisode.mockReturnValue(
    options?.episode ?? {
      data: detail(),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    },
  )
  mockLint.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    error: null,
  })
  mockPublishLint.mockReturnValue({ data: undefined, isLoading: false })
  const view = render(
    <EpisodeDetailDrawer
      episodeId={
        options && 'episodeId' in options ? (options.episodeId ?? null) : 'ep1'
      }
      onClose={onClose}
    />,
  )
  return { onClose, ...view }
}

beforeEach(() => {
  mockAuthoring.mockReset()
  mockCaps.mockReset()
  mockEpisode.mockReset()
  mockLint.mockReset()
  mockPublishLint.mockReset()
})

function clickDrawerClose() {
  const close = document.querySelector('.ant-drawer-close') as HTMLElement
  close.click()
}

describe('EpisodeDetailDrawer 打开与内容来源', () => {
  it('episodeId 为 null 时抽屉不打开', () => {
    setup({ episodeId: null })
    expect(screen.queryByText('故事集详情')).toBeNull()
    expect(screen.queryByTestId('workspace-tab')).toBeNull()
  })

  it('详情加载中显示抽屉标题与加载态', () => {
    setup({
      episode: { data: null, isLoading: true, error: null },
    })
    expect(screen.getByText('故事集详情')).toBeInTheDocument()
  })

  it('详情加载失败时显示错误原因', () => {
    setup({
      episode: {
        data: null,
        isLoading: false,
        error: new Error('详情挂了'),
      },
    })
    expect(screen.getByText('故事集详情加载失败')).toBeInTheDocument()
    expect(screen.getByText('详情挂了')).toBeInTheDocument()
  })

  it('authoring 环境：标题展示业务键/标题/状态，内容 tab 挂编辑器', async () => {
    const user = userEvent.setup()
    setup()

    expect(screen.getByText('elly/1/1')).toBeInTheDocument()
    expect(screen.getByText('听风原野第一天')).toBeInTheDocument()
    expect(screen.getByText('已发布 v2')).toBeInTheDocument()
    expect(screen.getByText('有草稿 v3')).toBeInTheDocument()
    expect(screen.getByText('正在看草稿')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '内容与编辑' })).toBeInTheDocument()
    expect(screen.getByTestId('workspace-tab')).toBeInTheDocument()
    expect(screen.queryByText('本环境只读，不能修改')).toBeNull()
    expect(
      screen.getByText(/草稿由 alice 于 /),
    ).toBeInTheDocument()

    const refetch = mockEpisode.mock.results[0]?.value.refetch as ReturnType<
      typeof vi.fn
    >
    await user.click(screen.getByRole('button', { name: '重新加载' }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('只读环境：不挂编辑器，改为展示校验结果与内容预览', () => {
    setup({ authoring: false })

    expect(screen.getByText('本环境只读，不能修改')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '内容' })).toBeInTheDocument()
    expect(screen.queryByTestId('workspace-tab')).toBeNull()
    expect(screen.getByText('当前内容的校验结果')).toBeInTheDocument()
    expect(screen.getByText('森林的清晨很安静。')).toBeInTheDocument()
  })

  it('未发布 / 已下架 / 无标题各有独立状态展示', () => {
    setup({
      episode: {
        data: detail({
          summary: {
            ...detail().summary,
            title: '',
            published: false,
            currentVersion: null,
            currentVersionId: null,
            hasDraft: false,
            retiredAt: '2026-11-18T08:00:00.000Z',
          },
        }),
        isLoading: false,
        error: null,
      },
      authoring: false,
    })

    expect(screen.getByText('（未填标题）')).toBeInTheDocument()
    expect(screen.getByText('已下架')).toBeInTheDocument()
    expect(screen.getByText(/这一集已于 /)).toBeInTheDocument()
    expect(screen.queryByText('有草稿 v3')).toBeNull()
  })

  it('未发布状态单独展示为「未发布」', () => {
    setup({
      episode: {
        data: detail({
          summary: {
            ...detail().summary,
            published: false,
            currentVersion: null,
            currentVersionId: null,
            hasDraft: false,
          },
        }),
        isLoading: false,
        error: null,
      },
      authoring: false,
    })

    expect(screen.getByText('未发布')).toBeInTheDocument()
  })

  it('未知 contentSource 原样透出而不是显示空白', () => {
    setup({
      episode: {
        data: detail({
          contentSource: 'mystery' as EpisodeDetail['contentSource'],
        }),
        isLoading: false,
        error: null,
      },
      authoring: false,
    })

    expect(screen.getByText('mystery')).toBeInTheDocument()
  })
})

describe('EpisodeDetailDrawer 六个 tab 的懒挂载', () => {
  it('默认只挂内容 tab，其余 tab 不挂载', () => {
    setup()

    expect(screen.getByTestId('workspace-tab')).toBeInTheDocument()
    expect(screen.queryByTestId('versions-tab')).toBeNull()
    expect(screen.queryByTestId('choices-tab')).toBeNull()
    expect(screen.queryByTestId('audit-tab')).toBeNull()
    expect(screen.queryByTestId('test-tab')).toBeNull()
  })

  it('切到版本历史后内容卸载、版本组件按 episodeId 挂载', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole('tab', { name: '版本历史' }))
    expect(screen.queryByTestId('workspace-tab')).toBeNull()
    expect(screen.getByTestId('versions-tab')).toHaveAttribute(
      'data-episode',
      'ep1',
    )
  })

  it('四个带请求的 tab 按需挂载并带上本集参数', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole('tab', { name: '影响面' }))
    expect(screen.getByText('今日在播')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: '选项命中' }))
    expect(screen.getByTestId('choices-tab')).toHaveAttribute(
      'data-episode',
      'ep1',
    )
    expect(screen.queryByText('今日在播')).toBeNull()

    await user.click(screen.getByRole('tab', { name: '本集审计' }))
    expect(screen.getByTestId('audit-tab')).toHaveAttribute(
      'data-episode',
      'ep1',
    )

    await user.click(screen.getByRole('tab', { name: '样机下发' }))
    const testTab = screen.getByTestId('test-tab')
    expect(testTab).toHaveAttribute('data-episode', 'ep1')
    expect(testTab).toHaveAttribute('data-character', 'elly')
    expect(testTab).toHaveAttribute('data-authoring', 'true')
    expect(testTab).toHaveAttribute('data-enabled', 'true')
  })

  it('换一集时 tab 自动回到「内容」，不会把上一集的审计页当成新集', async () => {
    const user = userEvent.setup()
    const { rerender } = setup()

    await user.click(screen.getByRole('tab', { name: '本集审计' }))
    expect(screen.getByTestId('audit-tab')).toBeInTheDocument()

    mockEpisode.mockReturnValue({
      data: detail({
        summary: { ...detail().summary, id: 'ep2', businessKey: 'elly/1/2' },
      }),
      isLoading: false,
      error: null,
    })
    rerender(<EpisodeDetailDrawer episodeId="ep2" onClose={vi.fn()} />)

    expect(screen.queryByTestId('audit-tab')).toBeNull()
    expect(screen.getByTestId('workspace-tab')).toBeInTheDocument()
  })
})

describe('EpisodeDetailDrawer 关闭前的未保存确认', () => {
  it('没有未保存改动时直接关闭', () => {
    const { onClose } = setup()

    clickDrawerClose()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('有未保存改动时先弹确认，「留在这一页」不关闭也不丢改动', async () => {
    const user = userEvent.setup()
    const { onClose } = setup()

    await user.click(screen.getByRole('button', { name: '制造改动' }))
    expect(screen.getByTestId('workspace-tab')).toHaveAttribute(
      'data-dirty',
      'true',
    )

    clickDrawerClose()
    expect(await screen.findByText('有未保存的改动')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()

    await user.click(await screen.findByRole('button', { name: /留在这一页/ }))
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByTestId('workspace-tab')).toHaveAttribute(
      'data-dirty',
      'true',
    )
  })

  it('确认「丢弃改动并关闭」后清掉本地改动并关闭抽屉', async () => {
    const user = userEvent.setup()
    const { onClose } = setup()

    await user.click(screen.getByRole('button', { name: '制造改动' }))
    clickDrawerClose()
    await user.click(
      await screen.findByRole('button', { name: /丢弃改动并关闭/ }),
    )

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('关闭确认弹窗里明确写出「没落库的东西不存在」的后果', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole('button', { name: '制造改动' }))
    clickDrawerClose()

    expect(
      await screen.findByText(/审计里也不会有任何痕迹/),
    ).toBeInTheDocument()
  })
})
