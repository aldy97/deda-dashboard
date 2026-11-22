import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import AdventureStudio from './index'
import { useAdventureAuthoring, useAdventureCapabilities } from '../../api/queries'

vi.mock('../../api/queries', () => ({
  useAdventureAuthoring: vi.fn(),
  useAdventureCapabilities: vi.fn(),
}))

vi.mock('./CapabilityBanner', () => ({
  default: () => <div data-testid="caps-banner" />,
}))

vi.mock('./EpisodeTable', () => ({
  default: (props: { onOpen: (id: string) => void; onCreate?: () => void }) => (
    <div data-testid="episode-table">
      <button onClick={() => props.onOpen('ep42')}>打开第一集</button>
      {props.onCreate && <button onClick={props.onCreate}>新建触发</button>}
    </div>
  ),
}))

vi.mock('./EpisodeDetailDrawer', () => ({
  default: (props: { episodeId: string | null; onClose: () => void }) => (
    <div data-testid="detail-drawer" data-episode={props.episodeId ?? ''}>
      <button onClick={props.onClose}>关闭详情</button>
    </div>
  ),
}))

vi.mock('./NewEpisodeDrawer', () => ({
  default: (props: {
    seed: unknown
    onClose: () => void
    onCreated: (id: string) => void
  }) => (
    <div data-testid="new-drawer" data-seed={String(props.seed)}>
      <button onClick={props.onClose}>关闭新建</button>
      <button onClick={() => props.onCreated('ep9')}>创建完成</button>
    </div>
  ),
}))

vi.mock('./ImportExport', () => ({
  default: () => <div data-testid="import-export" />,
}))

vi.mock('./AuditLog', () => ({
  default: () => <div data-testid="audit-log" />,
}))

vi.mock('./HealthPanel', () => ({
  default: () => <div data-testid="health-panel" />,
}))

const mockAuthoring = useAdventureAuthoring as unknown as ReturnType<typeof vi.fn>
const mockCaps = useAdventureCapabilities as unknown as ReturnType<typeof vi.fn>

const capabilities = {
  season: 1,
  characterKeys: ['elly'],
  interactionTypes: ['open_question'],
  replyWaitingInteractionTypes: ['open_question'],
  segmentKinds: ['narration'],
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
  testStoryEnabled: false,
}

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.search}</div>
}

function setup(options?: {
  entry?: string
  authoring?: boolean
  caps?: Record<string, unknown>
}) {
  mockAuthoring.mockReturnValue(options?.authoring ?? true)
  mockCaps.mockReturnValue(
    options?.caps ?? { data: capabilities, isPending: false, error: null },
  )
  return render(
    <MemoryRouter initialEntries={[options?.entry ?? '/adventure']}>
      <LocationProbe />
      <AdventureStudio />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockAuthoring.mockReset()
  mockCaps.mockReset()
})

describe('冒险内容工作台：四个 tab 的挂载与切换', () => {
  it('默认落在「故事集」，只挂载当前 tab，URL 不写多余参数', () => {
    setup()

    expect(screen.getByRole('tab', { name: '故事集' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '跨环境搬运' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '审计流水' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '自愈与兜底' })).toBeInTheDocument()

    expect(screen.getByTestId('episode-table')).toBeInTheDocument()
    expect(screen.getByTestId('caps-banner')).toBeInTheDocument()
    expect(screen.queryByTestId('import-export')).toBeNull()
    expect(screen.queryByTestId('audit-log')).toBeNull()
    expect(screen.queryByTestId('health-panel')).toBeNull()
    expect(screen.getByTestId('location').textContent).toBe('')
  })

  it('点「跨环境搬运」换内容并写入 ?tab=transfer', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole('tab', { name: '跨环境搬运' }))

    expect(screen.getByTestId('import-export')).toBeInTheDocument()
    expect(screen.queryByTestId('episode-table')).toBeNull()
    expect(screen.getByTestId('location').textContent).toBe('?tab=transfer')
  })

  it('点「审计流水」与「自愈与兜底」分别挂载对应面板', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole('tab', { name: '审计流水' }))
    expect(screen.getByTestId('audit-log')).toBeInTheDocument()
    expect(screen.getByTestId('location').textContent).toBe('?tab=audit')

    await user.click(screen.getByRole('tab', { name: '自愈与兜底' }))
    expect(screen.getByTestId('health-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('audit-log')).toBeNull()
    expect(screen.getByTestId('location').textContent).toBe('?tab=recovery')
  })

  it('从链接带 ?tab=audit 进入时直接还原审计页', () => {
    setup({ entry: '/adventure?tab=audit' })

    expect(screen.getByTestId('audit-log')).toBeInTheDocument()
    expect(screen.queryByTestId('episode-table')).toBeNull()
  })

  it('非法 tab 值回落「故事集」，不白屏也不写回 URL', () => {
    setup({ entry: '/adventure?tab=legacy' })

    expect(screen.getByTestId('episode-table')).toBeInTheDocument()
    expect(screen.getByTestId('location').textContent).toBe('?tab=legacy')
  })
})

describe('冒险内容工作台：详情抽屉', () => {
  it('列表打开某集时把 episodeId 写进 URL，抽屉拿到该 id', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole('button', { name: '打开第一集' }))

    expect(screen.getByTestId('detail-drawer')).toHaveAttribute(
      'data-episode',
      'ep42',
    )
    expect(screen.getByTestId('location').textContent).toBe('?episodeId=ep42')
  })

  it('从 ?episodeId= 进入时直接打开对应详情', () => {
    setup({ entry: '/adventure?tab=episodes&episodeId=ep7' })

    expect(screen.getByTestId('detail-drawer')).toHaveAttribute(
      'data-episode',
      'ep7',
    )
  })

  it('关闭抽屉清掉 episodeId，tab 保留', async () => {
    const user = userEvent.setup()
    setup({ entry: '/adventure?tab=episodes&episodeId=ep7' })

    await user.click(screen.getByRole('button', { name: '关闭详情' }))

    expect(screen.getByTestId('detail-drawer')).toHaveAttribute(
      'data-episode',
      '',
    )
    expect(screen.getByTestId('location').textContent).toBe('?tab=episodes')
  })
})

describe('冒险内容工作台：新建故事集', () => {
  it('authoring 环境点「新建」挂载新建抽屉，关闭后卸载', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole('button', { name: '新建触发' }))
    expect(screen.getByTestId('new-drawer')).toHaveAttribute('data-seed', 'null')

    await user.click(screen.getByRole('button', { name: '关闭新建' }))
    expect(screen.queryByTestId('new-drawer')).toBeNull()
  })

  it('只读环境不传 onCreate，界面没有新建入口', () => {
    setup({ authoring: false })

    expect(
      screen.queryByRole('button', { name: '新建触发' }),
    ).toBeNull()
  })

  it('能力清单还没回来时不挂新建抽屉（拿不到季号与 IP 枚举）', async () => {
    const user = userEvent.setup()
    setup({ caps: { data: null, isPending: true, error: null } })

    await user.click(screen.getByRole('button', { name: '新建触发' }))
    expect(screen.queryByTestId('new-drawer')).toBeNull()
  })

  it('创建成功后关抽屉并直接打开新集的详情', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole('button', { name: '新建触发' }))
    await user.click(screen.getByRole('button', { name: '创建完成' }))

    expect(screen.queryByTestId('new-drawer')).toBeNull()
    expect(screen.getByTestId('detail-drawer')).toHaveAttribute(
      'data-episode',
      'ep9',
    )
    expect(screen.getByTestId('location').textContent).toBe('?episodeId=ep9')
  })
})
