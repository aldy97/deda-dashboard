import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useEpisodeContent } from './useEpisodeContent'
import { useAdventureLint, useAdventurePublishLint } from '../../api/queries'
import type { EpisodeContent, EpisodeDetail, LintReport } from '../../types/adventureAdmin'

vi.mock('../../api/queries', () => ({
  useAdventureLint: vi.fn(),
  useAdventurePublishLint: vi.fn(),
}))

const mockLint = useAdventureLint as unknown as ReturnType<typeof vi.fn>
const mockPublishLint = useAdventurePublishLint as unknown as ReturnType<typeof vi.fn>

function issue(code: string, message: string) {
  return { severity: 'error' as const, code, message, businessKey: 'elly/1/1' }
}

const serverReport: LintReport = {
  ok: true,
  issues: [],
  errors: [],
  warnings: [],
}

const draftReport: LintReport = {
  ok: false,
  issues: [issue('NO_SEGMENTS', '一集没有任何段落')],
  errors: [issue('NO_SEGMENTS', '一集没有任何段落')],
  warnings: [],
}

const manualReport: LintReport = {
  ok: true,
  issues: [],
  errors: [],
  warnings: [{ severity: 'warning', code: 'TEXT_LONG', message: '旁白偏长', businessKey: 'elly/1/1' }],
}

const serverContent: EpisodeContent = {
  title: '服务端标题',
  recap: null,
  segments: [{ order: 0, kind: 'narration', text: '服务端旁白' }],
}

function detail(overrides: Partial<EpisodeDetail> = {}): EpisodeDetail {
  return {
    summary: {
      id: 'ep1',
      characterKey: 'elly',
      season: 1,
      episodeNumber: 1,
      businessKey: 'elly/1/1',
      title: '服务端标题',
      recap: null,
      published: true,
      retiredAt: null,
      currentVersionId: 'v1',
      currentVersion: 1,
      publishedAt: '2026-11-20T10:00:00.000Z',
      hasDraft: true,
      draftVersionId: 'd1',
      draftVersion: 1,
      draftUpdatedAt: '2026-11-20T10:00:00.000Z',
      draftUpdatedBy: 'alice',
      createdAt: '2026-11-20T10:00:00.000Z',
      updatedAt: '2026-11-20T10:00:00.000Z',
    },
    content: serverContent,
    contentSource: 'draft',
    baseVersionId: 'v1',
    baseDraftUpdatedAt: '2026-11-20T10:00:00.000Z',
    lint: draftReport,
    impact: {
      devicesPlayingToday: 1,
      devicesStaleCrossDay: 0,
      devicesPinnedToOlderVersions: 0,
      totalDevicesEverStarted: 1,
      publishedVersionCount: 1,
    },
    ...overrides,
  }
}

function lintHook(overrides: Record<string, unknown> = {}) {
  return {
    mutate: vi.fn(),
    error: null,
    isPending: false,
    ...overrides,
  }
}

function publishHook(overrides: Record<string, unknown> = {}) {
  return { data: undefined, isLoading: false, ...overrides }
}

interface SetupOptions {
  episodeId?: string | null
  detail?: EpisodeDetail | null
  lint?: ReturnType<typeof lintHook>
  publishLint?: ReturnType<typeof publishHook>
}

function setup(options: SetupOptions = {}) {
  const lint = options.lint ?? lintHook()
  const publishLint = options.publishLint ?? publishHook()
  mockLint.mockReturnValue(lint)
  mockPublishLint.mockReturnValue(publishLint)

  const initialProps = {
    episodeId: options.episodeId === undefined ? 'ep1' : options.episodeId,
    detail: options.detail === undefined ? detail() : options.detail,
  }
  const hook = renderHook(
    ({ episodeId, detail: value }) => useEpisodeContent(episodeId, value),
    { initialProps },
  )
  return { ...hook, lint, publishLint }
}

describe('useEpisodeContent', () => {
  it('没有详情时是空状态：没有内容、不可校验、change 是空操作', () => {
    const { result, lint } = setup({ detail: null })

    expect(result.current.content).toBeNull()
    expect(result.current.dirty).toBe(false)
    expect(result.current.lint).toBeNull()
    expect(result.current.lintBasis).toBe('none')
    expect(result.current.identity).toBeNull()
    expect(result.current.baseVersionId).toBeNull()
    expect(result.current.baseDraftUpdatedAt).toBeNull()

    act(() => result.current.change(serverContent))
    act(() => result.current.runLintNow())

    expect(result.current.dirty).toBe(false)
    expect(lint.mutate).not.toHaveBeenCalled()
  })

  it('有发布标准结论时优先展示它，并标明口径是 publish', () => {
    const { result, publishLint } = setup({
      publishLint: publishHook({ data: serverReport }),
    })

    expect(result.current.content).toEqual(serverContent)
    expect(result.current.lint).toBe(serverReport)
    expect(result.current.lintBasis).toBe('publish')
    expect(publishLint).toBeTruthy()
  })

  it('发布标准还没回来时退回详情里的草稿标准结论', () => {
    const { result } = setup()
    expect(result.current.lint).toBe(draftReport)
    expect(result.current.lintBasis).toBe('draft')
  })

  it('草稿标准也没有时口径是 none', () => {
    const { result } = setup({
      detail: detail({ lint: null as unknown as LintReport }),
    })
    expect(result.current.lint).toBeNull()
    expect(result.current.lintBasis).toBe('none')
  })

  it('改了内容就是脏的，展示本地副本且没有手动校验时口径 none', () => {
    const { result } = setup({ publishLint: publishHook({ data: serverReport }) })
    const edited: EpisodeContent = { ...serverContent, title: '我改的标题' }

    act(() => result.current.change(edited))

    expect(result.current.content).toEqual(edited)
    expect(result.current.dirty).toBe(true)
    expect(result.current.lintBasis).toBe('none')
  })

  it('手动校验带 identity + forPublish，并把报告落在当前内容上', () => {
    const { result, lint } = setup({ publishLint: publishHook({ data: serverReport }) })

    act(() => result.current.runLintNow())

    expect(lint.mutate).toHaveBeenCalledTimes(1)
    const [payload, handlers] = lint.mutate.mock.calls[0] as [
      Record<string, unknown>,
      { onSuccess: (report: LintReport) => void },
    ]
    expect(payload.episodeId).toBe('ep1')
    expect(payload.identity).toEqual({ characterKey: 'elly', season: 1, episodeNumber: 1 })
    expect(payload.content).toEqual(serverContent)
    expect(payload.forPublish).toBe(true)

    act(() => handlers.onSuccess(manualReport))

    expect(result.current.lint).toBe(manualReport)
    expect(result.current.lintBasis).toBe('local')
    expect(result.current.lintStale).toBe(false)
  })

  it('出结果后又改字：旧结论留着但标已过期，口径仍是 local', () => {
    const { result, lint } = setup()

    act(() => result.current.runLintNow())
    const handlers = lint.mutate.mock.calls[0][1] as { onSuccess: (r: LintReport) => void }
    act(() => handlers.onSuccess(manualReport))
    act(() => result.current.change({ ...serverContent, title: '又改了' }))

    expect(result.current.lint).toBe(manualReport)
    expect(result.current.lintBasis).toBe('local')
    expect(result.current.lintStale).toBe(true)
  })

  it('手动结论属于旧的一集时，换一集后不串台', () => {
    const { result, rerender, lint } = setup()

    act(() => result.current.runLintNow())
    const handlers = lint.mutate.mock.calls[0][1] as { onSuccess: (r: LintReport) => void }
    act(() => handlers.onSuccess(manualReport))

    rerender({
      episodeId: 'ep2',
      detail: detail({
        summary: { ...detail().summary, id: 'ep2', episodeNumber: 2, businessKey: 'elly/1/2' },
      }),
    })

    expect(result.current.lint).toBe(draftReport)
    expect(result.current.lintBasis).toBe('draft')
    expect(result.current.lintStale).toBe(false)
    expect(result.current.content).toBe(serverContent)
  })

  it('切集后本地改动自动失效，脏标记消失', () => {
    const { result, rerender } = setup()

    act(() => result.current.change({ ...serverContent, title: '第一集草稿' }))
    expect(result.current.dirty).toBe(true)

    rerender({
      episodeId: 'ep2',
      detail: detail({
        summary: { ...detail().summary, id: 'ep2', episodeNumber: 2, businessKey: 'elly/1/2' },
        content: { ...serverContent, title: '第二集服务端' },
      }),
    })

    expect(result.current.dirty).toBe(false)
    expect(result.current.content?.title).toBe('第二集服务端')
  })

  it('保存成功后采用服务端新令牌并清空本地改动', () => {
    const { result } = setup()

    act(() => result.current.change({ ...serverContent, title: '我改的' }))
    expect(result.current.baseDraftUpdatedAt).toBe('2026-11-20T10:00:00.000Z')

    act(() => result.current.adoptSavedDraft('2026-11-21T09:00:00.000Z'))

    expect(result.current.dirty).toBe(false)
    expect(result.current.baseDraftUpdatedAt).toBe('2026-11-21T09:00:00.000Z')
  })

  it('采用 null 令牌表示「现在没有草稿行」', () => {
    const { result } = setup()

    act(() => result.current.adoptSavedDraft(null))

    expect(result.current.baseDraftUpdatedAt).toBeNull()
  })

  it('clearLocal 丢弃本地改动与手动结论，回到服务端那一份', () => {
    const { result, lint } = setup()

    act(() => result.current.change({ ...serverContent, title: '我改的' }))
    act(() => result.current.runLintNow())
    const handlers = lint.mutate.mock.calls[0][1] as { onSuccess: (r: LintReport) => void }
    act(() => handlers.onSuccess(manualReport))

    act(() => result.current.clearLocal())

    expect(result.current.dirty).toBe(false)
    expect(result.current.content).toEqual(serverContent)
    expect(result.current.lint).toBe(draftReport)
    expect(result.current.lintBasis).toBe('draft')
  })

  it('校验请求失败时把 ApiError 原样交出', () => {
    const apiError = {
      status: 409,
      domainCode: 'DRAFT_CONFLICT',
      message: '草稿被改过',
      detail: null,
    }
    const { result } = setup({ lint: lintHook({ error: apiError }) })
    expect(result.current.lintError).toBe(apiError)
  })

  it('校验中：手动请求在飞，或首次加载发布标准时都算「计算中」', () => {
    const first = setup({ lint: lintHook({ isPending: true }) })
    expect(first.result.current.lintPending).toBe(true)
    first.unmount()

    const second = setup({ publishLint: publishHook({ isLoading: true }) })
    expect(second.result.current.lintPending).toBe(true)
  })

  it('已经有本地改动时，发布标准的后台刷新不再算「计算中」', () => {
    const { result } = setup({ publishLint: publishHook({ isLoading: true }) })
    act(() => result.current.change({ ...serverContent, title: '我改的' }))
    expect(result.current.lintPending).toBe(false)
  })

  it('身份三元组不完整时不造一个假 identity', () => {
    const broken = detail()
    const { result } = setup({
      detail: {
        ...broken,
        summary: { ...broken.summary, season: undefined as unknown as number },
      },
    })
    expect(result.current.identity).toBeNull()
  })

  it('把服务端内容与双令牌原样传给发布标准查询', () => {
    const publishLint = publishHook()
    setup({ publishLint })

    const args = mockPublishLint.mock.calls[0]
    expect(args[0]).toBe('ep1')
    expect(args[1]).toEqual(serverContent)
    expect(args[2]).toEqual({
      baseVersionId: 'v1',
      baseDraftUpdatedAt: '2026-11-20T10:00:00.000Z',
    })
    expect(args[3]).toEqual({ characterKey: 'elly', season: 1, episodeNumber: 1 })
  })
})
