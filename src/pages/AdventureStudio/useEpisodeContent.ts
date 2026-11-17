import { useCallback, useEffect, useRef, useState } from 'react'
import type { ApiError } from '../../api/client'
import { useAdventureLint, useAdventurePublishLint } from '../../api/queries'
import type {
  EpisodeContent,
  EpisodeDetail,
  EpisodeIdentity,
  LintReport,
} from '../../types/adventureAdmin'

/**
 * 单集内容的编辑状态 + 边打字边校验。
 *
 * 为什么是一个 hook 而不是写在 EpisodeWorkspace 里：抽屉只挂载当前 tab，
 * 切到「版本历史」再切回来会卸载编辑器组件，正在写的整集内容会凭空消失。
 * 状态必须由抽屉层持有，编辑器只是它的一个视图。
 *
 * 三处刻意的取舍：
 *
 * 1. **本地改动挂在「指纹」上，不用 useEffect 同步。** 指纹是
 *    `episodeId|contentSource|baseVersionId`——换一集、或这一集出现了新的草稿行，
 *    本地改动自动失效。刻意**不把 baseDraftUpdatedAt 放进指纹**：别人往同一行草稿里
 *    存过一次时，指纹不变、我写到一半的内容还在，下一次保存会撞上 409 由我来决定
 *    加载还是覆盖。若把时间令牌放进指纹，同事的一次保存就会静默清空我屏幕上的稿子。
 *
 * 2. **防抖用 ref + setTimeout，从 change 事件里调度，不放进 effect。**
 *    校验请求由「人改了一个字」触发，不是由「渲染发生」触发；effect 里 setState
 *    会多一轮渲染，也容易被 oxlint 的 react/set-state-in-effect 判成派生状态滥用。
 *
 * 3. **保存成功后采用服务端返回的新令牌（adoptSavedDraft）。** 草稿是可变行，
 *    服务端用 id + updatedAt 双令牌做乐观锁；不带回新令牌就会被自己刚存的那一次
 *    顶成 409（自己锁死自己）。
 */

/** 边打字边校验的防抖：太短会把每个字符都发成一次请求，太长会让人以为校验没在跑 */
const LINT_DEBOUNCE_MS = 700

/** 当前展示的校验结论是按哪个标准算出来的，界面上必须写清楚 */
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
  identity: EpisodeIdentity | null
  /** 乐观锁基线（双令牌），保存时原样带回 */
  baseVersionId: string | null
  baseDraftUpdatedAt: string | null
  change: (next: EpisodeContent) => void
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
  const [lintScheduled, setLintScheduled] = useState(false)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // mutate 在 TanStack Query 里引用稳定，放进 useCallback 依赖不会导致每轮重建
  const { mutate: runLint, error: lintErrorRaw, isPending: lintInFlight } =
    useAdventureLint()

  const serverContent = detail?.content ?? null
  const active =
    edited !== null && edited.fp === fingerprint ? edited : null
  const content = active ? active.content : serverContent
  const dirty = active !== null

  const baseVersionId = detail?.baseVersionId ?? null
  const baseDraftUpdatedAt =
    savedToken !== null && savedToken.fp === fingerprint
      ? savedToken.token
      : (detail?.baseDraftUpdatedAt ?? null)

  // 服务端那一份内容按「发布标准」校验（getEpisode 带回来的 lint 只是草稿标准）
  const publishLint = useAdventurePublishLint(episodeId, serverContent, {
    baseVersionId,
    baseDraftUpdatedAt,
  })

  const signature = content ? JSON.stringify(content) : ''
  const localReport =
    localLint !== null &&
    localLint.fp === fingerprint &&
    localLint.sig === signature
      ? localLint.report
      : null

  const lint: LintReport | null = dirty
    ? localReport
    : (publishLint.data ?? localReport ?? detail?.lint ?? null)
  const lintBasis: LintBasis = dirty
    ? localReport
      ? 'local'
      : 'none'
    : publishLint.data
      ? 'publish'
      : detail?.lint
        ? 'draft'
        : 'none'

  const scheduleLint = useCallback(
    (next: EpisodeContent, fp: string, sig: string, id: string) => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
      setLintScheduled(true)
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        setLintScheduled(false)
        runLint(
          { episodeId: id, content: next, forPublish: true },
          {
            onSuccess: (report) => setLocalLint({ fp, sig, report }),
          },
        )
      }, LINT_DEBOUNCE_MS)
    },
    [runLint],
  )

  const change = useCallback(
    (next: EpisodeContent) => {
      if (fingerprint === null || episodeId === null) return
      setEdited({ fp: fingerprint, content: next })
      scheduleLint(next, fingerprint, JSON.stringify(next), episodeId)
    },
    [fingerprint, episodeId, scheduleLint],
  )

  const clearLocal = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setEdited(null)
    setLocalLint(null)
    setLintScheduled(false)
  }, [])

  const adoptSavedDraft = useCallback(
    (token: string | null) => {
      if (fingerprint !== null) setSavedToken({ fp: fingerprint, token })
      clearLocal()
    },
    [fingerprint, clearLocal],
  )

  // 只做卸载清理，不在 effect 里 setState：定时器属于「人改了一个字」这条链，不属于渲染
  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
    },
    [],
  )

  const identity: EpisodeIdentity | null = detail
    ? {
        characterKey: detail.summary
          .characterKey as EpisodeIdentity['characterKey'],
        season: detail.summary.season,
        episodeNumber: detail.summary.episodeNumber,
      }
    : null

  return {
    content,
    dirty,
    lint,
    lintBasis,
    lintPending: lintScheduled || lintInFlight,
    lintError: (lintErrorRaw as ApiError | null) ?? null,
    identity,
    baseVersionId,
    baseDraftUpdatedAt,
    change,
    clearLocal,
    adoptSavedDraft,
  }
}
