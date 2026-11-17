import { useCallback, useMemo, useState } from 'react'
import type { ApiError } from '../../api/client'
import { useAdventureLint, useAdventurePublishLint } from '../../api/queries'
import type {
  EpisodeContent,
  EpisodeDetail,
  EpisodeIdentity,
  LintReport,
} from '../../types/adventureAdmin'

/**
 * 单集内容的编辑状态 + 手动校验。
 *
 * 为什么是一个 hook 而不是写在 EpisodeWorkspace 里：抽屉只挂载当前 tab，
 * 切到「版本历史」再切回来会卸载编辑器组件，正在写的整集内容会凭空消失。
 * 状态必须由抽屉层持有，编辑器只是它的一个视图。
 *
 * 四处刻意的取舍：
 *
 * 1. **本地改动挂在「指纹」上，不用 useEffect 同步。** 指纹是
 *    `episodeId|contentSource|baseVersionId`——换一集、或这一集出现了新的草稿行，
 *    本地改动自动失效。刻意**不把 baseDraftUpdatedAt 放进指纹**：别人往同一行草稿里
 *    存过一次时，指纹不变、我写到一半的内容还在，下一次保存会撞上 409 由我来决定
 *    加载还是覆盖。若把时间令牌放进指纹，同事的一次保存就会静默清空我屏幕上的稿子。
 *
 * 2. **打字不触发校验，只有人点「校验」或点「发布」才发请求。** 边写边弹错会打断
 *    写作，而草稿本来就允许不合规（服务端只拦身份级错误与畸形段落），
 *    真正的儿童安全闸口在发布那一步。所以这里没有防抖、没有定时器。
 *
 * 3. **校验结果过期不消失，改成打标记。** 出结果之后又改了字，旧结论留在屏幕上
 *    并标「已过期」：让人知道刚才那几条问题在哪、也知道自己还没重新校验。
 *    若像以前那样直接返回 null，面板会凭空消失，看起来像「问题都好了」。
 *
 * 4. **保存成功后采用服务端返回的新令牌（adoptSavedDraft）。** 草稿是可变行，
 *    服务端用 id + updatedAt 双令牌做乐观锁；不带回新令牌就会被自己刚存的那一次
 *    顶成 409（自己锁死自己）。
 */

/** 当前展示的校验结论是按哪个标准算出来的，界面上必须写清楚。
 *  `local` = 人点「校验」/「发布」触发的那一次（发布标准）。 */
export type LintBasis = 'local' | 'publish' | 'draft' | 'none'

export interface EpisodeContentState {
  /** 编辑器该显示的那一份：有本地改动就是改动后的，否则是服务端那一份 */
  content: EpisodeContent | null
  /** 有未保存的本地改动 */
  dirty: boolean
  lint: LintReport | null
  lintBasis: LintBasis
  lintPending: boolean
  lintError: ApiError | null
  /** 手动校验出结果之后内容又被改过：结论仍在，但已经对不上现在这一份 */
  lintStale: boolean
  identity: EpisodeIdentity | null
  /** 乐观锁基线（双令牌），保存时原样带回 */
  baseVersionId: string | null
  baseDraftUpdatedAt: string | null
  change: (next: EpisodeContent) => void
  /** 按发布标准校验当前内容一次。打字不调它，只有人点按钮才调 */
  runLintNow: () => void
  /** 丢弃本地改动，回到服务端那一份（「加载对方版本」也走这里） */
  clearLocal: () => void
  /** 保存成功后：采用新令牌并清掉本地副本 */
  adoptSavedDraft: (token: string | null) => void
}

export function useEpisodeContent(
  episodeId: string | null,
  detail: EpisodeDetail | null,
): EpisodeContentState {
  const fingerprint = detail
    ? `${episodeId}|${detail.contentSource}|${detail.baseVersionId}`
    : null

  const [edited, setEdited] = useState<{
    fp: string
    content: EpisodeContent
  } | null>(null)
  const [savedToken, setSavedToken] = useState<{
    fp: string
    token: string | null
  } | null>(null)
  const [localLint, setLocalLint] = useState<{
    fp: string
    sig: string
    report: LintReport
  } | null>(null)

  // mutate 在 TanStack Query 里引用稳定，放进 useCallback 依赖不会导致每轮重建
  const { mutate: runLint, error: lintErrorRaw, isPending: lintInFlight } =
    useAdventureLint()

  const serverContent = detail?.content ?? null
  const active = edited !== null && edited.fp === fingerprint ? edited : null
  const content = active ? active.content : serverContent
  const dirty = active !== null

  const baseVersionId = detail?.baseVersionId ?? null
  const baseDraftUpdatedAt =
    savedToken !== null && savedToken.fp === fingerprint
      ? savedToken.token
      : (detail?.baseDraftUpdatedAt ?? null)

  // 身份三元组从服务端下发的 summary 里取，不用客户端自己拼：lint 与试播都要它，
  // 而服务端只在请求带 identity 时才会读 forPublish（见 queries.ts 里的说明）。
  // useMemo 只依赖三个原始值——身份是不可变的，没必要跟着 detail 的对象引用变，
  // 否则 runLintNow 每轮渲染都重建，等于把「稳定的回调」这条约定废掉。
  const characterKey = detail?.summary
    .characterKey as EpisodeIdentity['characterKey'] | undefined
  const season = detail?.summary.season
  const episodeNumber = detail?.summary.episodeNumber
  const identity = useMemo<EpisodeIdentity | null>(
    () =>
      characterKey === undefined ||
      season === undefined ||
      episodeNumber === undefined
        ? null
        : { characterKey, season, episodeNumber },
    [characterKey, season, episodeNumber],
  )

  // 服务端那一份内容按「发布标准」校验（getEpisode 带回来的 lint 只是草稿标准）。
  // 它是一个缓存查询，键里带乐观锁双令牌：只在抽屉打开与令牌变化时各打一次，
  // 不在打字链路上，所以不违背「写作过程中不校验」。
  const publishLint = useAdventurePublishLint(
    episodeId,
    serverContent,
    { baseVersionId, baseDraftUpdatedAt },
    identity,
  )

  const signature = content ? JSON.stringify(content) : ''
  // 手动校验的结果按指纹归属，但**不按签名失效**：改过字之后结论留着，只打过期标记
  const manual =
    localLint !== null && localLint.fp === fingerprint ? localLint : null
  const manualReport = manual?.report ?? null
  const lintStale = manual !== null && manual.sig !== signature

  const lint: LintReport | null = dirty
    ? manualReport
    : (manualReport ?? publishLint.data ?? detail?.lint ?? null)
  const lintBasis: LintBasis = dirty
    ? manualReport
      ? 'local'
      : 'none'
    : manualReport
      ? 'local'
      : publishLint.data
        ? 'publish'
        : detail?.lint
          ? 'draft'
          : 'none'

  const change = useCallback(
    (next: EpisodeContent) => {
      if (fingerprint === null || episodeId === null) return
      setEdited({ fp: fingerprint, content: next })
    },
    [fingerprint, episodeId],
  )

  const runLintNow = useCallback(() => {
    if (fingerprint === null || episodeId === null || content === null) return
    const sig = JSON.stringify(content)
    runLint(
      {
        episodeId,
        // 必须带上 identity，顶层的 forPublish 才会被服务端读到；
        // 但 identity 里不能嵌 forPublish（LintDto 会 400）
        identity: identity ?? undefined,
        content,
        forPublish: true,
      },
      {
        onSuccess: (report) => setLocalLint({ fp: fingerprint, sig, report }),
      },
    )
  }, [fingerprint, episodeId, content, identity, runLint])

  const clearLocal = useCallback(() => {
    setEdited(null)
    setLocalLint(null)
  }, [])

  const adoptSavedDraft = useCallback(
    (token: string | null) => {
      if (fingerprint !== null) setSavedToken({ fp: fingerprint, token })
      clearLocal()
    },
    [fingerprint, clearLocal],
  )

  return {
    content,
    dirty,
    lint,
    lintBasis,
    // 发布标准查询只在首次加载时算「校验中」：用 isFetching 会让窗口重获焦点时的
    // 后台刷新把「确认发布」按钮闪成禁用态
    lintPending: lintInFlight || (!dirty && publishLint.isLoading),
    lintError: (lintErrorRaw as ApiError | null) ?? null,
    lintStale,
    identity,
    baseVersionId,
    baseDraftUpdatedAt,
    change,
    runLintNow,
    clearLocal,
    adoptSavedDraft,
  }
}
