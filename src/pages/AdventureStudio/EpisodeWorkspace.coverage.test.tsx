import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import EpisodeWorkspace from './EpisodeWorkspace'
import {
  useAdventureScriptConvert,
  useAdventureSimulate,
  useDiscardAdventureDraft,
  useDiscardAdventureEpisode,
  usePublishAdventureEpisode,
  useRestoreAdventureEpisode,
  useRetireAdventureEpisode,
  useSaveAdventureDraft,
} from '../../api/queries'
import type { ApiError } from '../../api/client'
import type {
  CapabilitiesResponse,
  EpisodeContent,
  EpisodeDetail,
  LintReport,
} from '../../types/adventureAdmin'
import type { EpisodeContentState } from './useEpisodeContent'

vi.mock('../../api/queries', () => ({
  useSaveAdventureDraft: vi.fn(),
  usePublishAdventureEpisode: vi.fn(),
  useDiscardAdventureDraft: vi.fn(),
  useRetireAdventureEpisode: vi.fn(),
  useRestoreAdventureEpisode: vi.fn(),
  useDiscardAdventureEpisode: vi.fn(),
  useAdventureScriptConvert: vi.fn(),
  useAdventureSimulate: vi.fn(),
}))

const mockSave = useSaveAdventureDraft as unknown as ReturnType<typeof vi.fn>
const mockPublish = usePublishAdventureEpisode as unknown as ReturnType<typeof vi.fn>
const mockDiscardDraft = useDiscardAdventureDraft as unknown as ReturnType<typeof vi.fn>
const mockRetire = useRetireAdventureEpisode as unknown as ReturnType<typeof vi.fn>
const mockRestore = useRestoreAdventureEpisode as unknown as ReturnType<typeof vi.fn>
const mockDiscard = useDiscardAdventureEpisode as unknown as ReturnType<typeof vi.fn>
const mockConvert = useAdventureScriptConvert as unknown as ReturnType<typeof vi.fn>
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
  simulationThresholds: { maxAwaitPoints: 12, maxSessionSeconds: 900 },
  fixedExitText: '不想玩了。',
  profile: 'authoring',
  authoring: true,
  testStoryEnabled: false,
}

const content: EpisodeContent = {
  title: '听风原野第一天',
  recap: null,
  segments: [{ order: 0, kind: 'narration', text: '森林的清晨很安静。' }],
}

function apiError(
  message: string,
  overrides: Partial<ApiError> = {},
): ApiError {
  return Object.assign(new Error(message), overrides)
}

function lintReport(overrides: Partial<LintReport> = {}): LintReport {
  return { ok: true, issues: [], errors: [], warnings: [], ...overrides }
}

const publishedLint: LintReport = lintReport()

const blockedLint: LintReport = lintReport({
  ok: false,
  issues: [
    {
      severity: 'error',
      code: 'TEXT_TOO_LONG',
      message: '旁白超长',
      businessKey: 'elly/1/1',
      segmentOrder: 0,
    },
  ],
  errors: [
    {
      severity: 'error',
      code: 'TEXT_TOO_LONG',
      message: '旁白超长',
      businessKey: 'elly/1/1',
      segmentOrder: 0,
    },
  ],
})

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
      createdAt: '2026-11-20T09:00:00.000Z',
      updatedAt: '2026-11-21T10:00:00.000Z',
    },
    content,
    contentSource: 'draft',
    baseVersionId: 'v2',
    baseDraftUpdatedAt: '2026-11-21T10:00:00.000Z',
    lint: publishedLint,
    impact: {
      devicesPlayingToday: 3,
      devicesStaleCrossDay: 2,
      devicesPinnedToOlderVersions: 1,
      totalDevicesEverStarted: 7,
      publishedVersionCount: 2,
    },
    ...overrides,
  }
}

function contentState(overrides: Partial<EpisodeContentState> = {}): EpisodeContentState {
  return {
    content,
    dirty: false,
    lint: publishedLint,
    lintBasis: 'publish',
    lintPending: false,
    lintError: null,
    lintStale: false,
    identity: { characterKey: 'elly', season: 1, episodeNumber: 1 },
    baseVersionId: 'v2',
    baseDraftUpdatedAt: '2026-11-21T10:00:00.000Z',
    change: vi.fn(),
    runLintNow: vi.fn(),
    clearLocal: vi.fn(),
    adoptSavedDraft: vi.fn(),
    ...overrides,
  }
}

function mutation(overrides: Record<string, unknown> = {}) {
  return {
    mutate: vi.fn(),
    isPending: false,
    error: null,
    reset: vi.fn(),
    data: undefined,
    ...overrides,
  }
}

function idleMutation(overrides: Record<string, unknown> = {}) {
  return { mutate: vi.fn(), isPending: false, error: null, reset: vi.fn(), ...overrides }
}

interface SetupOptions {
  episodeDetail?: EpisodeDetail
  state?: EpisodeContentState
  authoring?: boolean
}

function setup(options: SetupOptions = {}) {
  const state = options.state ?? contentState()
  const onReload = vi.fn()
  render(
    <EpisodeWorkspace
      episodeId="ep1"
      detail={options.episodeDetail ?? detail()}
      capabilities={capabilities}
      authoring={options.authoring ?? true}
      state={state}
      onReload={onReload}
    />,
  )
  return { state, onReload }
}

async function chooseReason(text: string) {
  fireEvent.change(
    screen.getByPlaceholderText(
      '半年后别人（包括你自己）只能靠这条审计看懂当时为什么这么改',
    ),
    { target: { value: text } },
  )
}

async function selectDocx(name = 'script.docx') {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(input, {
    target: {
      files: [
        new File(['hello'], name, {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }),
      ],
    },
  })
}

const convertedContent: EpisodeContent = {
  title: '从 docx 来的标题',
  recap: '回顾',
  segments: [{ order: 0, kind: 'narration', text: 'docx 第一段' }],
}

beforeEach(() => {
  mockSave.mockReturnValue(mutation())
  mockPublish.mockReturnValue(mutation())
  mockDiscardDraft.mockReturnValue(mutation())
  mockRetire.mockReturnValue(mutation())
  mockRestore.mockReturnValue(mutation())
  mockDiscard.mockReturnValue(mutation())
  mockConvert.mockReturnValue(idleMutation())
  mockSimulate.mockReturnValue(idleMutation())
})

describe('EpisodeWorkspace · 只读与基础渲染', () => {
  it('只读环境：说明改不了但校验与试播照常可用，写按钮全部消失', () => {
    setup({ authoring: false })

    expect(screen.getByText('本环境是只读环境，内容不能在这里修改')).toBeTruthy()
    expect(screen.getByRole('button', { name: /校\s*验/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /存草稿/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^发\s*布$/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /从 docx 填充/ })).toBeNull()
    expect(screen.getByPlaceholderText('家长端与看板列表里看到的名字')).toBeDisabled()
  })

  it('点「校验」触发一次手动校验，校验中按钮转圈', () => {
    const { state } = setup()
    fireEvent.click(screen.getByRole('button', { name: /校\s*验/ }))
    expect(state.runLintNow).toHaveBeenCalledTimes(1)
  })

  it('校验请求在飞时按钮显示加载态', () => {
    setup({ state: contentState({ lintPending: true }) })
    expect(screen.getByRole('button', { name: /校\s*验/ }).className).toContain(
      'ant-btn-loading',
    )
  })

  it('内容还没到手时「校验」与「存草稿」都禁用', () => {
    setup({ state: contentState({ content: null }) })
    expect(screen.getByRole('button', { name: /校\s*验/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /存草稿/ })).toBeDisabled()
  })

  it('脏状态与过期状态各挂一个金色标签', () => {
    setup({ state: contentState({ dirty: true, lintStale: true }) })
    expect(screen.getByText('有未保存的改动')).toBeTruthy()
    expect(screen.getByText('校验结果已过期')).toBeTruthy()
  })

  it('校验报告面板按口径换标题，草稿标准换一句提醒说明', () => {
    setup({
      state: contentState({
        lintBasis: 'draft',
        lint: lintReport({
          warnings: [
            {
              severity: 'warning',
              code: 'FORBIDDEN_WORD',
              message: '含禁用词',
              businessKey: 'elly/1/1',
            },
          ],
        }),
      }),
    })
    expect(
      screen.getByText('校验结果（草稿标准 · 发布标准的结果正在计算）'),
    ).toBeTruthy()
    expect(
      screen.getByText(/存草稿不阻断；其中一部分在发布标准下会变成阻断项/),
    ).toBeTruthy()
  })

  it('校验请求失败时明确写出「不等于内容没问题」', () => {
    const lintError = apiError('校验服务挂了', {
      status: 500,
      domainCode: 'LINT_UNAVAILABLE',
    })
    setup({ state: contentState({ lintError }) })

    expect(screen.getByText('校验请求失败')).toBeTruthy()
    expect(
      screen.getByText(/校验服务挂了（LINT_UNAVAILABLE）。这\*\*不等于\*\*/),
    ).toBeTruthy()
  })

  it('试播按钮打开试播弹窗，内容与身份齐备时挂上模拟器', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /试\s*播/ }))
    expect(screen.getByText('试播：按引擎规则走一遍（不写库、不审计）')).toBeTruthy()
    expect(screen.getByRole('button', { name: /试播整集/ })).toBeTruthy()
  })

  it('试播弹窗可以关掉', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /试\s*播/ }))
    const close = document.querySelector('.ant-modal-close')
    expect(close).toBeTruthy()
    fireEvent.click(close as HTMLElement)
  })

  it('没有校验结果时口径 none，校验失败没有领域码时不拼括号', () => {
    setup({
      state: contentState({
        lint: null,
        lintBasis: 'none',
        lintError: apiError('请求超时'),
      }),
    })

    expect(screen.getByText(/请求超时。这\*\*不等于\*\*/)).toBeTruthy()
  })
})

describe('EpisodeWorkspace · 存草稿', () => {
  it('理由不够 8 个字时提交按钮禁用，填够后带双令牌提交并采用新令牌', async () => {
    const saveResult = {
      episodeId: 'ep1',
      versionId: 'd4',
      version: 4,
      businessKey: 'elly/1/1',
      contentHash: 'abcdef1234567890ff',
      lint: publishedLint,
      created: true,
      draftUpdatedAt: '2026-11-22T08:00:00.000Z',
    }
    const save = mutation({
      mutate: vi.fn((_payload, options: { onSuccess: (r: typeof saveResult) => void }) => {
        options.onSuccess(saveResult)
      }),
    })
    mockSave.mockReturnValue(save)
    const { state } = setup()

    fireEvent.click(screen.getByRole('button', { name: /存草稿/ }))
    const dialog = screen.getByRole('dialog')
    const ok = within(dialog).getByRole('button', { name: /存\s*草稿/ })
    expect(ok).toBeDisabled()

    await chooseReason('补充这一段旁白的来历')
    expect(ok).not.toBeDisabled()
    fireEvent.click(ok)

    expect(save.mutate).toHaveBeenCalledTimes(1)
    const payload = save.mutate.mock.calls[0][0] as Record<string, unknown>
    expect(payload).toEqual({
      episodeId: 'ep1',
      content,
      reason: '补充这一段旁白的来历',
      baseVersionId: 'v2',
      baseDraftUpdatedAt: '2026-11-21T10:00:00.000Z',
      force: false,
    })
    expect(state.adoptSavedDraft).toHaveBeenCalledWith('2026-11-22T08:00:00.000Z')
    expect(
      screen.getByText(
        /草稿已保存：v4（新建草稿行）· 内容哈希 abcdef123456…/,
      ),
    ).toBeTruthy()
  })

  it('原地更新草稿时提示措辞不同', async () => {
    const save = mutation({
      mutate: vi.fn((_payload, options: { onSuccess: (r: unknown) => void }) => {
        options.onSuccess({
          episodeId: 'ep1',
          versionId: 'd3',
          version: 3,
          businessKey: 'elly/1/1',
          contentHash: 'short',
          lint: publishedLint,
          created: false,
          draftUpdatedAt: null,
        })
      }),
    })
    mockSave.mockReturnValue(save)
    const { state } = setup()

    fireEvent.click(screen.getByRole('button', { name: /存草稿/ }))
    await chooseReason('把这段旁白改短一点')
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /存\s*草稿/ }))

    expect(screen.getByText(/原地更新同一行草稿/)).toBeTruthy()
    expect(state.adoptSavedDraft).toHaveBeenCalledWith(null)
  })

  it('服务端拒绝存草稿时把 lint 报告摊在弹窗里', () => {
    const rejected = apiError('内容不合规', {
      status: 400,
      domainCode: 'CONTENT_REJECTED',
      detail: { lint: blockedLint },
    })
    mockSave.mockReturnValue(mutation({ error: rejected }))
    setup()

    fireEvent.click(screen.getByRole('button', { name: /存草稿/ }))
    const dialog = screen.getByRole('dialog')
    expect(screen.getByText('服务端拒绝这次存草稿的原因')).toBeTruthy()
    expect(within(dialog).getByText('旁白超长')).toBeTruthy()
    expect(within(dialog).getByText('服务端拒绝了这次操作')).toBeTruthy()
  })

  it('409 DRAFT_CONFLICT：不关弹窗，给出两条出路，覆盖时带 force', async () => {
    const conflictError = apiError('草稿被同事改过', {
      status: 409,
      domainCode: 'DRAFT_CONFLICT',
      detail: {
        currentDraft: {
          version: 3,
          updatedAt: '2026-11-22T08:00:00.000Z',
          updatedBy: 'bob',
          baseVersionId: 'v2',
          baseDraftUpdatedAt: '2026-11-22T08:00:00.000Z',
        },
      },
    })
    const save = mutation({ error: conflictError })
    mockSave.mockReturnValue(save)
    const { state } = setup()

    fireEvent.click(screen.getByRole('button', { name: /存草稿/ }))
    const dialog = screen.getByRole('dialog')
    expect(screen.getByText(/这一集的草稿已经被 bob 改过/)).toBeTruthy()

    fireEvent.click(
      within(dialog).getByRole('button', { name: '覆盖我的改动上去' }),
    )
    expect(save.mutate).toHaveBeenCalledTimes(1)
    expect((save.mutate.mock.calls[0][0] as Record<string, unknown>).force).toBe(true)

    fireEvent.click(
      within(dialog).getByRole('button', { name: /加载对方版本（丢弃我的改动）/ }),
    )
    expect(state.clearLocal).toHaveBeenCalled()
    expect(screen.getByText('已加载对方版本，你的本地改动被丢弃。')).toBeTruthy()
  })

  it('409 但细节里没有对方草稿时不渲染冲突块', () => {
    mockSave.mockReturnValue(
      mutation({
        error: apiError('冲突', { status: 409, domainCode: 'DRAFT_CONFLICT', detail: {} }),
      }),
    )
    setup()
    fireEvent.click(screen.getByRole('button', { name: /存草稿/ }))
    expect(screen.queryByText(/加载对方版本（丢弃我的改动）/)).toBeNull()
    expect(screen.getByText('服务端拒绝了这次操作')).toBeTruthy()
  })

  it('冲突里没写谁改的时用「另一位创作者」兜底', () => {
    mockSave.mockReturnValue(
      mutation({
        error: {
          status: 409,
          message: '冲突',
          domainCode: 'DRAFT_CONFLICT',
          detail: {
            currentDraft: {
              version: 3,
              updatedAt: '2026-11-22T08:00:00.000Z',
              updatedBy: null,
              baseVersionId: 'v2',
              baseDraftUpdatedAt: '2026-11-22T08:00:00.000Z',
            },
          },
        },
      }),
    )
    setup()
    fireEvent.click(screen.getByRole('button', { name: /存草稿/ }))
    expect(screen.getByText(/这一集的草稿已经被 另一位创作者 改过/)).toBeTruthy()
  })
})

describe('EpisodeWorkspace · 发布闸口', () => {
  it('有未保存改动时「发布」禁用并说明原因', () => {
    setup({ state: contentState({ dirty: true }) })
    const publish = screen.getByRole('button', { name: /^发\s*布$/ })
    expect(publish).toBeDisabled()
    expect(publish.getAttribute('title')).toBe(
      '有未保存的改动：先存草稿再发布，否则发出去的还是上一份',
    )
  })

  it('还没有草稿时「发布」禁用并提示先存草稿', () => {
    const noDraft = detail()
    setup({
      episodeDetail: {
        ...noDraft,
        summary: { ...noDraft.summary, hasDraft: false, draftVersion: null },
      },
    })
    const publish = screen.getByRole('button', { name: /^发\s*布$/ })
    expect(publish).toBeDisabled()
    expect(publish.getAttribute('title')).toBe('还没有草稿，先存一次草稿')
  })

  it('点发布时现算一次校验，并在弹窗里摊开发布前检查', () => {
    const { state } = setup()
    fireEvent.click(screen.getByRole('button', { name: /^发\s*布$/ }))

    expect(state.runLintNow).toHaveBeenCalledTimes(1)
    expect(screen.getByText('发布 elly/1/1')).toBeTruthy()
    expect(
      screen.getByText('发布前检查（发布标准 · 打开这个弹窗时现算）'),
    ).toBeTruthy()
  })

  it('校验还在算时 fail closed，并说明在等什么', () => {
    setup({ state: contentState({ lintPending: true }) })
    fireEvent.click(screen.getByRole('button', { name: /^发\s*布$/ }))

    expect(
      screen.getByText('这一步现在不能提交'),
    ).toBeTruthy()
    expect(
      screen.getByText('发布前检查正在计算，等它出结果（通常几秒）。'),
    ).toBeTruthy()
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('button', { name: /确认发布/ })).toBeDisabled()
  })

  it('校验请求失败时不放行，并带上领域码', () => {
    setup({
      state: contentState({
        lintError: apiError('校验服务挂了', { status: 500, domainCode: 'LINT_DOWN' }),
      }),
    })
    fireEvent.click(screen.getByRole('button', { name: /^发\s*布$/ }))

    expect(
      screen.getByText(/发布前检查这次请求失败了.*校验服务挂了（LINT_DOWN）。/),
    ).toBeTruthy()
  })

  it('结论过期时要求重算', () => {
    setup({ state: contentState({ lintStale: true }) })
    fireEvent.click(screen.getByRole('button', { name: /^发\s*布$/ }))
    expect(
      screen.getByText(/屏幕上的校验结果已经对不上当前内容了/),
    ).toBeTruthy()
  })

  it('只有草稿标准的结论时不放行', () => {
    setup({ state: contentState({ lintBasis: 'draft' }) })
    fireEvent.click(screen.getByRole('button', { name: /^发\s*布$/ }))
    expect(
      screen.getByText(/还没有按发布标准算出来的校验结果/),
    ).toBeTruthy()
  })

  it('还有阻断项时明确说服务端也会再拦一次', async () => {
    setup({ state: contentState({ lint: blockedLint }) })
    fireEvent.click(screen.getByRole('button', { name: /^发\s*布$/ }))

    expect(
      screen.getByText(/还有 1 个阻断项，全部修掉才能发布/),
    ).toBeTruthy()
    await chooseReason('这一集已经改好可以发布')
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: /确认发布/ })).toBeDisabled()
  })

  it('发布成功（无漂移）时展示版本与影响面', async () => {
    const publish = mutation({
      mutate: vi.fn((_payload, options: { onSuccess: (r: unknown) => void }) => {
        options.onSuccess({
          episodeId: 'ep1',
          versionId: 'v3',
          version: 3,
          businessKey: 'elly/1/1',
          contentHash: 'abc',
          segmentCount: 1,
          lint: publishedLint,
          impact: detail().impact,
          selfCheckDrift: [],
        })
      }),
    })
    mockPublish.mockReturnValue(publish)
    const { state } = setup()

    fireEvent.click(screen.getByRole('button', { name: /^发\s*布$/ }))
    await chooseReason('这一集可以发布给孩子听')
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /确认发布/ }))

    expect(state.clearLocal).toHaveBeenCalled()
    expect(
      screen.getByText(/已发布为 v3，成为当前版本.*影响 3 台今日在播设备/),
    ).toBeTruthy()
  })

  it('发布后自检发现漂移：只告警不回滚', async () => {
    mockPublish.mockReturnValue(
      mutation({
        mutate: vi.fn((_payload, options: { onSuccess: (r: unknown) => void }) => {
          options.onSuccess({
            episodeId: 'ep1',
            versionId: 'v3',
            version: 3,
            businessKey: 'elly/1/1',
            contentHash: 'abc',
            segmentCount: 1,
            lint: publishedLint,
            impact: detail().impact,
            selfCheckDrift: ['segments[0].text 与快照不一致', '缺第 2 段'],
          })
        }),
      }),
    )
    setup()

    fireEvent.click(screen.getByRole('button', { name: /^发\s*布$/ }))
    await chooseReason('这一集可以发布给孩子听')
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /确认发布/ }))

    expect(
      screen.getByText(/自检发现内容与库里的段落有漂移（只告警、不回滚）：segments\[0\].text 与快照不一致；缺第 2 段/),
    ).toBeTruthy()
  })

  it('自检本身失败时提示人工核对线上段落', async () => {
    mockPublish.mockReturnValue(
      mutation({
        mutate: vi.fn((_payload, options: { onSuccess: (r: unknown) => void }) => {
          options.onSuccess({
            episodeId: 'ep1',
            versionId: 'v3',
            version: 3,
            businessKey: 'elly/1/1',
            contentHash: 'abc',
            segmentCount: 1,
            lint: publishedLint,
            impact: detail().impact,
            selfCheckDrift: null,
          })
        }),
      }),
    )
    setup()

    fireEvent.click(screen.getByRole('button', { name: /^发\s*布$/ }))
    await chooseReason('这一集可以发布给孩子听')
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /确认发布/ }))

    expect(screen.getByText(/发布已提交，但发布后自检本身失败了/)).toBeTruthy()
  })
})

describe('EpisodeWorkspace · 影响面动作', () => {
  it('下架要原样手输业务键，成功后展示服务端说明与两个计数', async () => {
    const retire = mutation({
      mutate: vi.fn((_payload, options: { onSuccess: (r: unknown) => void }) => {
        options.onSuccess({
          episodeId: 'ep1',
          businessKey: 'elly/1/1',
          retiredAt: '2026-11-22T09:00:00.000Z',
          impact: detail().impact,
          staleDailyCount: 2,
          abandonedProgressCount: 5,
          message: '已下架，今日在播 3 台不受影响',
        })
      }),
    })
    mockRetire.mockReturnValue(retire)
    const { state } = setup()

    fireEvent.click(screen.getByRole('button', { name: /下\s*架/ }))
    const dialog = screen.getByRole('dialog')
    const ok = within(dialog).getByRole('button', { name: /确认下架/ })
    await chooseReason('内容需要整体回炉重做')
    expect(ok).toBeDisabled()

    fireEvent.change(within(dialog).getByPlaceholderText('elly/1/1'), {
      target: { value: 'elly/1/1' },
    })
    expect(ok).not.toBeDisabled()
    fireEvent.click(ok)

    expect(retire.mutate).toHaveBeenCalledWith(
      { episodeId: 'ep1', reason: '内容需要整体回炉重做', confirmText: 'elly/1/1' },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
    expect(state.clearLocal).toHaveBeenCalled()
    expect(
      screen.getByText(/已下架，今日在播 3 台不受影响（本次收走跨天挂起 2 台、标记 abandoned 进度 5 条）/),
    ).toBeTruthy()
  })

  it('已下架的集只给「恢复上架」，成功后提醒既有 abandoned 进度不会回来', async () => {
    const retiredDetail = detail()
    mockRestore.mockReturnValue(
      mutation({
        mutate: vi.fn((_payload, options: { onSuccess: (r: unknown) => void }) => {
          options.onSuccess({
            episodeId: 'ep1',
            businessKey: 'elly/1/1',
            abandonedProgressNotRestored: 4,
            message: '已恢复上架，重新参与分配',
          })
        }),
      }),
    )
    setup({
      episodeDetail: {
        ...retiredDetail,
        summary: { ...retiredDetail.summary, retiredAt: '2026-11-21T00:00:00.000Z' },
      },
    })

    expect(screen.queryByRole('button', { name: /^下\s*架$/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /恢复上架/ }))
    await chooseReason('当初下架的原因已经解决')
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /确认恢复上架/ }))

    expect(
      screen.getByText(/已恢复上架，重新参与分配（当初被收成 abandoned 的 4 条进度不会因此回来）/),
    ).toBeTruthy()
  })

  it('有草稿且已发布时才给「丢弃草稿」，成功后说明版本行仍在历史里', async () => {
    mockDiscardDraft.mockReturnValue(
      mutation({
        mutate: vi.fn((_payload, options: { onSuccess: (r: unknown) => void }) => {
          options.onSuccess({
            episodeId: 'ep1',
            businessKey: 'elly/1/1',
            discardedVersionId: 'd3',
            version: 3,
          })
        }),
      }),
    )
    setup()

    fireEvent.click(screen.getByRole('button', { name: /丢弃草稿/ }))
    await chooseReason('草稿方向不对重新写一份')
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /丢弃草稿/ }))

    expect(
      screen.getByText(/已丢弃草稿 v3，编辑器回到当前发布版。.*状态 discarded/),
    ).toBeTruthy()
  })

  it('未发布过的集才能「作废整集」，且业务键永久占用', async () => {
    const unpublished = detail()
    mockDiscard.mockReturnValue(
      mutation({
        mutate: vi.fn((_payload, options: { onSuccess: (r: unknown) => void }) => {
          options.onSuccess({
            episodeId: 'ep1',
            businessKey: 'elly/1/1',
            discardedDraftCount: 1,
            message: '已作废这一集',
          })
        }),
      }),
    )
    setup({
      episodeDetail: {
        ...unpublished,
        summary: { ...unpublished.summary, published: false, currentVersionId: null },
      },
    })

    expect(screen.queryByRole('button', { name: /丢弃草稿/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /作废整集/ }))
    const dialog = screen.getByRole('dialog')
    await chooseReason('这一集本来就是误建的')
    fireEvent.change(within(dialog).getByPlaceholderText('elly/1/1'), {
      target: { value: 'elly/1/1' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: /确认作废/ }))

    expect(
      screen.getByText(/已作废这一集（作废草稿 1 个；业务键 elly\/1\/1 已永久占用，不能再用于新建）/),
    ).toBeTruthy()
  })

  it('已发布的集不出现「作废整集」', () => {
    setup()
    expect(screen.queryByRole('button', { name: /作废整集/ })).toBeNull()
  })

  it('操作结果横幅可以手动关掉', async () => {
    mockDiscardDraft.mockReturnValue(
      mutation({
        mutate: vi.fn((_payload, options: { onSuccess: (r: unknown) => void }) => {
          options.onSuccess({
            episodeId: 'ep1',
            businessKey: 'elly/1/1',
            discardedVersionId: 'd3',
            version: 3,
          })
        }),
      }),
    )
    setup()

    fireEvent.click(screen.getByRole('button', { name: /丢弃草稿/ }))
    await chooseReason('草稿方向不对重新写一份')
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /丢弃草稿/ }))
    expect(screen.getByText(/已丢弃草稿 v3/)).toBeTruthy()

    fireEvent.click(document.querySelector('.ant-alert-close-icon') as HTMLElement)
    await waitFor(() => expect(screen.queryByText(/已丢弃草稿 v3/)).toBeNull())
  })

})

describe('EpisodeWorkspace · 重新加载与 docx 填充', () => {
  it('没有本地改动时按钮是「重新加载」，点击清本地并重拉详情', () => {
    const { state, onReload } = setup()
    fireEvent.click(screen.getByRole('button', { name: /重新加载/ }))
    expect(state.clearLocal).toHaveBeenCalled()
    expect(onReload).toHaveBeenCalled()
  })

  it('有本地改动时按钮变成「放弃改动并重新加载」', () => {
    setup({ state: contentState({ dirty: true }) })
    expect(screen.getByRole('button', { name: '放弃改动并重新加载' })).toBeTruthy()
  })

  it('编辑器是空的时候，docx 结果直接填进去', async () => {
    const convert = idleMutation({
      mutate: vi.fn((_payload, options: { onSuccess: (r: unknown) => void }) => {
        options.onSuccess({
          content: convertedContent,
          characterKey: 'elly',
          characterDetected: true,
          season: 1,
          episodeNumber: 1,
          sourceText: '正文',
          lint: publishedLint,
        })
      }),
    })
    mockConvert.mockReturnValue(convert)
    const state = contentState({
      content: { title: '', recap: null, segments: [] },
    })
    setup({ state })

    await selectDocx()
    await waitFor(() => expect(state.change).toHaveBeenCalledWith(convertedContent))
    expect(screen.queryByText('上传会覆盖当前内容')).toBeNull()
  })

  it('已有内容时 docx 结果要先确认覆盖，取消则一个字都不改', async () => {
    const convert = idleMutation({
      mutate: vi.fn((_payload, options: { onSuccess: (r: unknown) => void }) => {
        options.onSuccess({
          content: convertedContent,
          characterKey: 'elly',
          characterDetected: false,
          season: 1,
          episodeNumber: 1,
          sourceText: '正文',
          lint: publishedLint,
        })
      }),
    })
    mockConvert.mockReturnValue(convert)
    const { state } = setup()

    await selectDocx()
    await waitFor(() => expect(screen.getByText('上传会覆盖当前内容')).toBeTruthy())
    expect(state.change).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /取\s*消/ }))
    expect(state.change).not.toHaveBeenCalled()
  })

  it('确认「覆盖并填充」后整份替换标题与互动', async () => {
    mockConvert.mockReturnValue(
      idleMutation({
        mutate: vi.fn((_payload, options: { onSuccess: (r: unknown) => void }) => {
          options.onSuccess({
            content: convertedContent,
            characterKey: 'elly',
            characterDetected: true,
            season: 1,
            episodeNumber: 1,
            sourceText: '正文',
            lint: publishedLint,
          })
        }),
      }),
    )
    const { state } = setup()

    await selectDocx()
    await waitFor(() => expect(screen.getByText('上传会覆盖当前内容')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: /覆盖并填充/ }))

    expect(state.change).toHaveBeenCalledWith(convertedContent)
  })

  it('有未保存改动时上传同样走确认', async () => {
    mockConvert.mockReturnValue(
      idleMutation({
        mutate: vi.fn((_payload, options: { onSuccess: (r: unknown) => void }) => {
          options.onSuccess({
            content: convertedContent,
            characterKey: 'elly',
            characterDetected: true,
            season: 1,
            episodeNumber: 1,
            sourceText: '正文',
            lint: publishedLint,
          })
        }),
      }),
    )
    setup({ state: contentState({ dirty: true }) })

    await selectDocx()
    await waitFor(() => expect(screen.getByText('上传会覆盖当前内容')).toBeTruthy())
  })
})
