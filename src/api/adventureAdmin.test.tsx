import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { apiClient } from './client'
import {
  applyImport,
  exportBundle,
  fetchCharacterTestDevices,
  fetchEpisodeChoiceStats,
  retireEpisode,
  runRecoverySweep,
  saveDraft,
} from './adventureAdmin'
import {
  ADVENTURE_QUERY_ROOT,
  useAdventurePublishLint,
  useCharacterTestDevices,
  useEpisodeChoiceStats,
  useSaveAdventureDraft,
} from './queries'
import type {
  AdventureBundle,
  EpisodeChoiceStatsResponse,
  EpisodeContent,
  EpisodeIdentity,
} from '../types/adventureAdmin'

/**
 * 冒险内容管理台接口层的契约守卫：锁死 URL、payload 透传与缓存作废范围。
 * 沿用 decisions.test.tsx 的做法——apiClient 的响应拦截器会剥掉
 * { code, message, data } 信封，所以这里 mock 成已剥壳的形状。
 *
 * 重点守的是**乐观锁双令牌**：草稿是可变行（原地 update，id 与 version 都不变），
 * 只带 baseVersionId 检测不到「我加载之后同事往同一行里又存了一次」，
 * 那种情况会静默互相覆盖。任何一个令牌在前端被漏掉，服务端的保护就等于没有，
 * 而这类回归在界面上完全看不出来——保存照样成功，只是别人的稿子没了。
 */
vi.mock('./client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
  TOKEN_KEY: 'deda_dashboard_token',
}))

const mockPost = apiClient.post as unknown as ReturnType<typeof vi.fn>
const mockGet = apiClient.get as unknown as ReturnType<typeof vi.fn>

function respondWith(data: unknown) {
  mockPost.mockResolvedValue({ data })
}

function createWrapper() {
  // staleTime 与生产配置对齐：它是「同参数不重复发请求」这条断言成立的前提
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
  return {
    client,
    Wrapper: function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>
    },
  }
}

const content: EpisodeContent = { title: '第一集', recap: null, segments: [] }
const identity: EpisodeIdentity = {
  characterKey: 'elly',
  season: 1,
  episodeNumber: 1,
}

describe('adventure-admin 接口层', () => {
  it('saveDraft 把两个并发令牌原样透传，并把新令牌交回给调用方', async () => {
    respondWith({ version: 11, draftUpdatedAt: 'T2', created: false })

    const result = await saveDraft('e1', {
      content,
      reason: '改一下开场回顾',
      baseVersionId: 'v1',
      baseDraftUpdatedAt: 'T1',
    })

    expect(mockPost).toHaveBeenCalledWith(
      '/analytics/adventure-admin/episodes/e1/draft',
      {
        content,
        reason: '改一下开场回顾',
        baseVersionId: 'v1',
        baseDraftUpdatedAt: 'T1',
      },
    )
    // 编辑器必须改用返回的新令牌继续保存，否则会被自己刚写的那次顶成 409
    expect(result.draftUpdatedAt).toBe('T2')
  })

  it('saveDraft 的 force 覆盖也要显式传出去（红色按钮的唯一出口）', async () => {
    respondWith({ version: 12, draftUpdatedAt: 'T3', created: false })

    await saveDraft('e1', {
      content,
      reason: '明知有人在改也要覆盖',
      baseVersionId: 'v1',
      baseDraftUpdatedAt: 'T1',
      force: true,
    })

    expect(mockPost.mock.calls[0][1]).toMatchObject({ force: true })
  })

  it('useSaveAdventureDraft 把 episodeId 拆进 URL，成功后作废整组 adventure 缓存', async () => {
    respondWith({ version: 11, draftUpdatedAt: 'T2', created: false })
    const { client, Wrapper } = createWrapper()
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useSaveAdventureDraft(), { wrapper: Wrapper })

    await result.current.mutateAsync({
      episodeId: 'e1',
      content,
      reason: '改一下开场回顾',
      baseVersionId: 'v1',
      baseDraftUpdatedAt: 'T1',
    })

    expect(mockPost).toHaveBeenCalledWith(
      '/analytics/adventure-admin/episodes/e1/draft',
      {
        content,
        reason: '改一下开场回顾',
        baseVersionId: 'v1',
        baseDraftUpdatedAt: 'T1',
      },
    )
    // 列表、详情、版本、审计、自愈面板全都挂在这个根键下：写一次就得整组重算，
    // 否则界面会停在旧状态上（例如刚下架却还显示「下架」按钮）
    expect(invalidate).toHaveBeenCalledWith({ queryKey: [...ADVENTURE_QUERY_ROOT] })
  })

  it('发布标准校验走 forPublish=true 并带上 identity，且令牌变了必须重算', async () => {
    respondWith({ ok: true, issues: [], errors: [], warnings: [] })
    const { Wrapper } = createWrapper()
    const tokens = { baseVersionId: 'v1', baseDraftUpdatedAt: 'T1' }
    const { result, rerender } = renderHook(
      ({ baseDraftUpdatedAt }: { baseDraftUpdatedAt: string }) =>
        useAdventurePublishLint(
          'e1',
          content,
          { ...tokens, baseDraftUpdatedAt },
          identity,
        ),
      { wrapper: Wrapper, initialProps: { baseDraftUpdatedAt: 'T1' } },
    )

    await waitFor(() => expect(result.current.data).toBeTruthy())
    // identity 不是可选装饰：服务端只在请求带 identity 时才读顶层的 forPublish，
    // 少了它这次校验会静默退回草稿标准（禁用词只是提醒），界面就会说「可以发布」。
    // 但 identity 必须是纯净的三元组——往里嵌 forPublish 会被 LintDto 判 400。
    expect(mockPost).toHaveBeenCalledWith('/analytics/adventure-admin/lint', {
      episodeId: 'e1',
      identity,
      content,
      forPublish: true,
    })
    expect(mockPost).toHaveBeenCalledTimes(1)

    // 同事存过一次草稿 → 服务端那一份内容变了 → 这份「能不能发布」的结论必须重算
    rerender({ baseDraftUpdatedAt: 'T2' })
    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(2))
  })

  it('内容还没加载出来时不打校验请求', async () => {
    const { Wrapper } = createWrapper()
    const { result } = renderHook(
      () =>
        useAdventurePublishLint(
          null,
          null,
          {
            baseVersionId: null,
            baseDraftUpdatedAt: null,
          },
          null,
        ),
      { wrapper: Wrapper },
    )

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('retire 与 import 都必须带手输的确认文本，导入还要带预览时的 bundle 哈希', async () => {
    respondWith({ retiredAt: '2026-11-14T00:00:00.000Z' })
    await retireEpisode('e1', { reason: '这一集需要重做', confirmText: 'elly/1/1' })
    expect(mockPost).toHaveBeenCalledWith(
      '/analytics/adventure-admin/episodes/e1/retire',
      { reason: '这一集需要重做', confirmText: 'elly/1/1' },
    )

    mockPost.mockClear()
    const bundle = { bundleSchemaVersion: 1, episodes: [] } as unknown as AdventureBundle
    respondWith({ applied: 1, skipped: 0 })
    await applyImport({
      bundle,
      reason: 'staging 验证过，搬到 prod',
      confirmText: 'abc123def456',
      expectedBundleHash: 'h1',
    })
    expect(mockPost).toHaveBeenCalledWith('/analytics/adventure-admin/import', {
      bundle,
      reason: 'staging 验证过，搬到 prod',
      confirmText: 'abc123def456',
      // 防「预览的是 A、提交的是 B」
      expectedBundleHash: 'h1',
    })
  })

  it('导出按 selector 走 POST /export；自愈动作只透传理由', async () => {
    respondWith({ bundle: null, episodeCount: 1 })
    await exportBundle({ episodeIds: ['e1'], includeRetired: true })
    expect(mockPost).toHaveBeenCalledWith('/analytics/adventure-admin/export', {
      episodeIds: ['e1'],
      includeRetired: true,
    })

    mockPost.mockClear()
    respondWith({ report: null, audited: true })
    await runRecoverySweep('手动巡检一次')
    expect(mockPost).toHaveBeenCalledWith(
      '/analytics/adventure-admin/recovery/sweep',
      { reason: '手动巡检一次' },
    )
  })
})

/**
 * 选项命中统计的接口层守卫。
 * 这两个函数是 `apiClient.get` / `useQuery` 的一行包装，按 .kimi-code/AGENTS.md
 * 的 Adventure Studio 豁免口径本来可以不测；但 URL 里的 `choice-stats` 一旦写错
 * 是**静默 404**（面板只会显示空态，看不出是路径错了），而 `enabled` 门一旦被去掉
 * 就会在抽屉还没选中剧集时打出 `/episodes/null/choice-stats`。这两条都在界面上
 * 看不出来，所以补上守卫，不再依赖豁免。
 */
describe('选项命中统计接口层', () => {
  const choiceStats: EpisodeChoiceStatsResponse = {
    episodeId: 'ep-1',
    title: '第一集',
    contentNote: '选项文案取自当前发布版本，历史数据可能与当时文案不完全一致',
    totalInteractions: 0,
    matchedTotal: 0,
    segments: [],
  }

  it('fetchEpisodeChoiceStats 把 episodeId 拆进 URL，日期区间走 query params，响应原样返回', async () => {
    mockGet.mockClear()
    mockGet.mockResolvedValue({ data: choiceStats })

    const got = await fetchEpisodeChoiceStats('ep-1', {
      startDate: '2026-11-01',
      endDate: '2026-11-19',
    })

    expect(mockGet).toHaveBeenCalledWith(
      '/analytics/adventure-admin/episodes/ep-1/choice-stats',
      { params: { startDate: '2026-11-01', endDate: '2026-11-19' } },
    )
    expect(got).toEqual(choiceStats)
  })

  it('useEpisodeChoiceStats 没有 episodeId 时一次请求都不发（enabled 门）', () => {
    mockGet.mockClear()
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useEpisodeChoiceStats(null), {
      wrapper: Wrapper,
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('useEpisodeChoiceStats 的 queryKey 带上日期参数，缓存按 choiceStats 分组', async () => {
    mockGet.mockClear()
    mockGet.mockResolvedValue({ data: choiceStats })
    const { client, Wrapper } = createWrapper()
    const params = { startDate: '2026-11-01', endDate: '2026-11-19' }

    renderHook(() => useEpisodeChoiceStats('ep-1', params), {
      wrapper: Wrapper,
    })

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1))
    expect(
      client.getQueryData([
        ...ADVENTURE_QUERY_ROOT,
        'choiceStats',
        'ep-1',
        params,
      ]),
    ).toEqual(choiceStats)
  })

  it('fetchCharacterTestDevices 把 characterKey 放进 query params，响应原样返回', async () => {
    mockGet.mockClear()
    const response = {
      enabled: true,
      characterKey: 'elly',
      total: 0,
      devices: [],
    }
    mockGet.mockResolvedValue({ data: response })

    const got = await fetchCharacterTestDevices('elly')

    expect(mockGet).toHaveBeenCalledWith(
      '/analytics/adventure-admin/device-test/assignments',
      { params: { characterKey: 'elly' } },
    )
    expect(got).toEqual(response)
  })

  it('useCharacterTestDevices 没有 characterKey 时一次请求都不发（enabled 门）', () => {
    mockGet.mockClear()
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useCharacterTestDevices(null, true), {
      wrapper: Wrapper,
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('useCharacterTestDevices 有 characterKey 时按 characterKey 发请求，data 交给组件', async () => {
    mockGet.mockClear()
    const response = {
      enabled: true,
      characterKey: 'elly',
      total: 0,
      devices: [],
    }
    mockGet.mockResolvedValue({ data: response })
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useCharacterTestDevices('elly', true), {
      wrapper: Wrapper,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith(
      '/analytics/adventure-admin/device-test/assignments',
      { params: { characterKey: 'elly' } },
    )
    expect(result.current.data).toEqual(response)
  })
})
