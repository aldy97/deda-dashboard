import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { apiClient } from './client'
import {
  CHANGE_NOTE_MAX_CHARS,
  PROMPT_CATALOG_KEY,
  PROMPT_CONTENT_MAX_CHARS,
  classifyPromptWriteError,
  fetchPromptCatalog,
  fetchPromptDetail,
  fetchPromptVersions,
  promptWriteFailureHint,
  publishPrompt,
  resetPromptToDefault,
  rollbackPrompt,
  savePromptDraft,
  usePromptCatalog,
  usePromptDetail,
  usePromptVersions,
  usePublishPrompt,
} from './prompts'
import type { PromptCatalogItem, PromptDetail } from '../types/analytics'

/**
 * 契约守卫 + 写操作缓存一致性。
 * URL / method / body 必须与 deda-server docs/analytics-api.md「Prompt 管理」逐项对齐；
 * mutation 成功后必须同时失效 detail / versions / catalog 三处缓存，
 * 少一处就会出现「弹窗说发布成功、列表还标着草稿」。
 */
vi.mock('./client', () => ({
  apiClient: { get: vi.fn(), patch: vi.fn(), post: vi.fn() },
}))

const mockGet = apiClient.get as unknown as ReturnType<typeof vi.fn>
const mockPatch = apiClient.patch as unknown as ReturnType<typeof vi.fn>
const mockPost = apiClient.post as unknown as ReturnType<typeof vi.fn>

const KEY = 'persona_elly'

const CATALOG_ITEM: PromptCatalogItem = {
  key: KEY,
  category: 'persona',
  scene: 'chat_main',
  name: '小象 Elly 人设',
  description: '主链路角色人设。',
  variables: [],
  maxChars: PROMPT_CONTENT_MAX_CHARS,
  defaultContent: '默认人设',
  effectiveContent: '默认人设',
  source: 'default',
  publishedRevision: null,
  draftRevision: null,
  publishedAt: null,
  publishedBy: null,
  deviatesFromDefault: false,
}

const DETAIL: PromptDetail = {
  ...CATALOG_ITEM,
  draftContent: null,
  draftChangeNote: null,
  publishedContent: null,
  discardedDraftRevision: null,
}

function respondGet(data: unknown) {
  mockGet.mockResolvedValue({ data })
}

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        retry: false,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

describe('prompts 读接口', () => {
  it('catalog 走 GET /analytics/prompts 并返回数组', async () => {
    respondGet([CATALOG_ITEM])

    await expect(fetchPromptCatalog()).resolves.toEqual([CATALOG_ITEM])
    expect(mockGet).toHaveBeenCalledWith('/analytics/prompts')
  })

  it('detail / versions 把 key 拼进路径', async () => {
    respondGet(DETAIL)
    await fetchPromptDetail(KEY)
    expect(mockGet).toHaveBeenLastCalledWith(`/analytics/prompts/${KEY}`)

    respondGet([])
    await expect(fetchPromptVersions(KEY)).resolves.toEqual([])
    expect(mockGet).toHaveBeenLastCalledWith(
      `/analytics/prompts/${KEY}/versions`,
    )
  })

  it('常量与服务端 DTO 上限一致（超长会在服务端 400，前端得先拦）', () => {
    expect(PROMPT_CONTENT_MAX_CHARS).toBe(20_000)
    expect(CHANGE_NOTE_MAX_CHARS).toBe(500)
  })
})

describe('prompts 写接口', () => {
  it('保存草稿走 PATCH :key/draft，expectedRevision 原样透传', async () => {
    mockPatch.mockResolvedValue({ data: DETAIL })
    const payload = { content: '新人设', expectedRevision: 0, changeNote: '首改' }

    await expect(savePromptDraft(KEY, payload)).resolves.toEqual(DETAIL)
    expect(mockPatch).toHaveBeenCalledWith(
      `/analytics/prompts/${KEY}/draft`,
      payload,
    )
  })

  it.each([
    ['publish', publishPrompt, { revision: 3, changeNote: '上线', confirmCode: 'DEDA2025' }],
    ['rollback', rollbackPrompt, { targetRevision: 1, changeNote: '回滚', confirmCode: 'DEDA2025' }],
    ['reset-to-default', resetPromptToDefault, { changeNote: '恢复默认', confirmCode: 'DEDA2025' }],
  ] as const)('%s 走 POST :key/%s 并回传 PromptDetail', async (_name, fn, payload) => {
    mockPost.mockResolvedValue({ data: DETAIL })

    await expect(
      (fn as (k: string, p: never) => Promise<PromptDetail>)(
        KEY,
        payload as never,
      ),
    ).resolves.toEqual(DETAIL)
    expect(mockPost).toHaveBeenCalledWith(
      `/analytics/prompts/${KEY}/${_name}`,
      payload,
    )
  })
})

describe('写操作错误归因', () => {
  const err = (status: number | undefined, message: string) => {
    const e = new Error(message) as Error & { status?: number }
    e.status = status
    return e
  }

  it.each([
    [err(400, '确认码不正确，操作已取消'), 'confirm-code'],
    [err(400, '正文不能为空'), 'validation'],
    [err(403, 'PROMPT_WRITE_ENABLED=false'), 'read-only'],
    [err(404, '未知的 prompt key'), 'not-found'],
    [err(409, '草稿已被他人更新'), 'conflict'],
    [err(500, 'boom'), 'unknown'],
    [err(undefined, 'Network Error'), 'unknown'],
  ] as const)('status=%s → %s', (e, expected) => {
    expect(classifyPromptWriteError(e)).toBe(expected)
  })

  it('非 Error 入参不炸，归为 unknown', () => {
    expect(classifyPromptWriteError(null)).toBe('unknown')
    expect(classifyPromptWriteError('字符串错误')).toBe('unknown')
  })

  it('确认码错误给「重新手动输入」的指引，不透出服务端原文', () => {
    const e = err(400, '确认码不正确，操作已取消')
    expect(promptWriteFailureHint('confirm-code', e)).toContain('重新手动输入')
  })

  it.each(['conflict', 'not-found', 'validation', 'unknown'] as const)(
    '%s 保留服务端 message，方便定位',
    (failure) => {
      const e = err(409, '草稿已被他人更新（当前 r2，你的编辑基于 r1）')
      expect(promptWriteFailureHint(failure, e)).toContain('草稿已被他人更新')
    },
  )

  it('read-only 指明是运维开关，而不是让管理员以为是自己权限不够', () => {
    expect(promptWriteFailureHint('read-only', err(403, 'x'))).toContain(
      'PROMPT_WRITE_ENABLED',
    )
  })

  it('非 Error 入参也能给出提示，不抛异常', () => {
    expect(promptWriteFailureHint('unknown', '纯字符串错误')).toContain(
      '纯字符串错误',
    )
  })

  it('unknown 且无 message 时给兜底文案，不渲染空字符串', () => {
    expect(promptWriteFailureHint('unknown', new Error(''))).toBe(
      '操作失败，请重试',
    )
  })
})

describe('prompts hooks', () => {
  it('key 为 null 时 detail / versions 都不发请求', () => {
    respondGet([])
    const wrapper = createWrapper()
    renderHook(() => usePromptDetail(null), { wrapper })
    renderHook(() => usePromptVersions(null), { wrapper })

    expect(mockGet).not.toHaveBeenCalled()
  })

  it('同一 key 的 catalog 只发一次请求（queryKey 去重）', async () => {
    respondGet([CATALOG_ITEM])
    const wrapper = createWrapper()

    const a = renderHook(() => usePromptCatalog(), { wrapper })
    await waitFor(() => expect(a.result.current.isSuccess).toBe(true))
    const b = renderHook(() => usePromptCatalog(), { wrapper })
    await waitFor(() => expect(b.result.current.isSuccess).toBe(true))

    expect(PROMPT_CATALOG_KEY).toEqual(['analytics', 'promptCatalog'])
    expect(mockGet).toHaveBeenCalledTimes(1)
  })

  it('发布成功后 detail / versions / catalog 三处缓存全部重取', async () => {
    const wrapper = createWrapper()
    const calls: string[] = []
    mockGet.mockImplementation((url: string) => {
      calls.push(url)
      const data = url.endsWith('/versions')
        ? []
        : url.endsWith(`/prompts/${KEY}`)
          ? DETAIL
          : [CATALOG_ITEM]
      return Promise.resolve({ data })
    })
    mockPost.mockResolvedValue({ data: { ...DETAIL, publishedRevision: 1 } })

    const { result } = renderHook(
      () => ({
        catalog: usePromptCatalog(),
        detail: usePromptDetail(KEY),
        versions: usePromptVersions(KEY),
        publish: usePublishPrompt(KEY),
      }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.detail.isSuccess).toBe(true))
    await waitFor(() => expect(result.current.versions.isSuccess).toBe(true))
    const firstRound = calls.length
    expect(firstRound).toBe(3)

    result.current.publish.mutate({
      revision: 1,
      changeNote: '上线',
      confirmCode: 'DEDA2025',
    })
    await waitFor(() => expect(result.current.publish.isSuccess).toBe(true))
    await waitFor(() => expect(calls.length).toBe(firstRound + 3))

    expect(mockPost).toHaveBeenCalledWith(`/analytics/prompts/${KEY}/publish`, {
      revision: 1,
      changeNote: '上线',
      confirmCode: 'DEDA2025',
    })
  })
})
