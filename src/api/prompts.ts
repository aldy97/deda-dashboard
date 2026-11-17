import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'
import type {
  PromptCatalogItem,
  PromptDetail,
  PromptVersionItem,
} from '../types/analytics'

/**
 * Prompt 管理接口层（admin view / edit / publish）。
 * 契约真相：deda-server `docs/analytics-api.md` →「Prompt 管理」，
 * 字段与 PromptAdminService 的返回体逐项对齐，不得自行发明。
 *
 * 为什么 api 函数与 react-query hooks 同处一文件、没有拆进 queries.ts：
 * 这是后台第一个含写操作的领域，mutation 与它要失效的 queryKey 必须写在
 * 一起才不会漏（漏了就是「发布成功但页面还显示旧正文」）；同时 AGENTS.md
 * 第 8 条的覆盖率口径按文件考核，把 100% 覆盖的新代码摊进 500 行的
 * queries.ts 只会让两边都看不清。
 */

export const PROMPT_CATALOG_KEY = ['analytics', 'promptCatalog'] as const
export const promptDetailKey = (key: string) =>
  ['analytics', 'promptDetail', key] as const
export const promptVersionsKey = (key: string) =>
  ['analytics', 'promptVersions', key] as const

/** 正文长度上限兜底值；接口返回 maxChars 时以接口为准 */
export const PROMPT_CONTENT_MAX_CHARS = 20_000
/** 改动说明长度上限，与服务端 CHANGE_NOTE_MAX_CHARS 一致 */
export const CHANGE_NOTE_MAX_CHARS = 500

// ---- 读 ----

/** 恒 17 项，服务端按 PROMPT_KEYS 顺序返回；空 DB 时全部 source=default */
export async function fetchPromptCatalog(): Promise<PromptCatalogItem[]> {
  const resp = await apiClient.get('/analytics/prompts')
  return resp.data as PromptCatalogItem[]
}

export async function fetchPromptDetail(key: string): Promise<PromptDetail> {
  const resp = await apiClient.get(`/analytics/prompts/${key}`)
  return resp.data as PromptDetail
}

/** 倒序；该 key 从未被编辑过 → 空数组（不是 404） */
export async function fetchPromptVersions(
  key: string,
): Promise<PromptVersionItem[]> {
  const resp = await apiClient.get(`/analytics/prompts/${key}/versions`)
  return resp.data as PromptVersionItem[]
}

// ---- 写 ----

export interface SaveDraftPayload {
  content: string
  /** 当前草稿号，无草稿时传 0；与服务端不一致 → 409 */
  expectedRevision: number
  changeNote?: string
}

export async function savePromptDraft(
  key: string,
  payload: SaveDraftPayload,
): Promise<PromptDetail> {
  const resp = await apiClient.patch(`/analytics/prompts/${key}/draft`, payload)
  return resp.data as PromptDetail
}

export interface PublishPayload {
  revision: number
  changeNote: string
  confirmCode: string
}

export async function publishPrompt(
  key: string,
  payload: PublishPayload,
): Promise<PromptDetail> {
  const resp = await apiClient.post(`/analytics/prompts/${key}/publish`, payload)
  return resp.data as PromptDetail
}

export interface RollbackPayload {
  targetRevision: number
  changeNote: string
  confirmCode: string
}

export async function rollbackPrompt(
  key: string,
  payload: RollbackPayload,
): Promise<PromptDetail> {
  const resp = await apiClient.post(
    `/analytics/prompts/${key}/rollback`,
    payload,
  )
  return resp.data as PromptDetail
}

export interface ResetToDefaultPayload {
  changeNote: string
  confirmCode: string
}

export async function resetPromptToDefault(
  key: string,
  payload: ResetToDefaultPayload,
): Promise<PromptDetail> {
  const resp = await apiClient.post(
    `/analytics/prompts/${key}/reset-to-default`,
    payload,
  )
  return resp.data as PromptDetail
}

// ---- 错误归因 ----

/**
 * 写操作失败归因。client.ts 的拦截器把信封里的 message 提到 Error.message、
 * 把 HTTP 状态挂在 status 上，这里据此分流 UI 提示。
 *
 * 确认码不正确是 **400**（不是 403）：403 会被拦截器当凭据失效处理，
 * 直接把管理员踢回登录页、丢掉编辑器里的草稿，详见服务端
 * PromptAdminService.assertConfirmCode 的注释。
 */
export type PromptWriteFailure =
  | 'confirm-code'
  | 'conflict'
  | 'read-only'
  | 'not-found'
  | 'validation'
  | 'unknown'

export function classifyPromptWriteError(err: unknown): PromptWriteFailure {
  const status = (err as { status?: number } | null)?.status
  const message = err instanceof Error ? err.message : ''
  if (status === 400) {
    return message.includes('确认码') ? 'confirm-code' : 'validation'
  }
  if (status === 403) return 'read-only'
  if (status === 404) return 'not-found'
  if (status === 409) return 'conflict'
  return 'unknown'
}

/** 归因之后给管理员看的话；unknown 直接透出服务端 message，不猜 */
export function promptWriteFailureHint(
  failure: PromptWriteFailure,
  err: unknown,
): string {
  const message = err instanceof Error ? err.message : String(err)
  switch (failure) {
    case 'confirm-code':
      return '确认码不正确，操作已取消。请对照弹窗提示重新手动输入。'
    case 'conflict':
      return `提交被拒绝：${message}。请关闭弹窗刷新详情后重试。`
    case 'read-only':
      return '当前环境的 prompt 写入已被运维开关关闭（PROMPT_WRITE_ENABLED=false），只能查看。'
    case 'not-found':
      return `目标不存在：${message}`
    case 'validation':
      return `参数校验失败：${message}`
    default:
      return message || '操作失败，请重试'
  }
}

// ---- hooks ----

export function usePromptCatalog() {
  return useQuery({
    queryKey: PROMPT_CATALOG_KEY,
    queryFn: fetchPromptCatalog,
  })
}

/** key 为 null 时不发请求（未选中任何 prompt） */
export function usePromptDetail(key: string | null) {
  return useQuery({
    queryKey: promptDetailKey(key ?? ''),
    queryFn: () => fetchPromptDetail(key as string),
    enabled: key !== null,
  })
}

export function usePromptVersions(key: string | null) {
  return useQuery({
    queryKey: promptVersionsKey(key ?? ''),
    queryFn: () => fetchPromptVersions(key as string),
    enabled: key !== null,
  })
}

/**
 * 写操作的统一后置动作：详情、版本历史、列表三处缓存全部作废。
 * 少失效一处就会出现「弹窗说发布成功、列表还标着草稿」的自相矛盾。
 */
function useInvalidatePrompt(key: string) {
  const queryClient = useQueryClient()
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: promptDetailKey(key) }),
      queryClient.invalidateQueries({ queryKey: promptVersionsKey(key) }),
      queryClient.invalidateQueries({ queryKey: PROMPT_CATALOG_KEY }),
    ])
  }
}

export function useSavePromptDraft(key: string) {
  const invalidate = useInvalidatePrompt(key)
  return useMutation({
    mutationFn: (payload: SaveDraftPayload) => savePromptDraft(key, payload),
    onSuccess: invalidate,
  })
}

export function usePublishPrompt(key: string) {
  const invalidate = useInvalidatePrompt(key)
  return useMutation({
    mutationFn: (payload: PublishPayload) => publishPrompt(key, payload),
    onSuccess: invalidate,
  })
}

export function useRollbackPrompt(key: string) {
  const invalidate = useInvalidatePrompt(key)
  return useMutation({
    mutationFn: (payload: RollbackPayload) => rollbackPrompt(key, payload),
    onSuccess: invalidate,
  })
}

export function useResetPromptToDefault(key: string) {
  const invalidate = useInvalidatePrompt(key)
  return useMutation({
    mutationFn: (payload: ResetToDefaultPayload) =>
      resetPromptToDefault(key, payload),
    onSuccess: invalidate,
  })
}
