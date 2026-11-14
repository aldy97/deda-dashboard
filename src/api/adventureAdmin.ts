import { apiClient } from './client'
import type {
  AdventureBundle,
  AuditListResponse,
  AuditQuery,
  CapabilitiesResponse,
  CreateEpisodeRequest,
  CreateEpisodeResult,
  DiscardDraftResult,
  DiscardEpisodeResult,
  EpisodeDetail,
  EpisodeIdentity,
  EpisodeListQuery,
  EpisodeListResponse,
  EpisodeContent,
  EpisodeImpact,
  ExportResult,
  ExportSelector,
  ImportApplyRequest,
  ImportApplyResult,
  ImportPreview,
  LintReport,
  LintRequest,
  PublishResult,
  RecoveryHealthSnapshot,
  RecoveryResetResult,
  RecoverySweepResult,
  RestoreResult,
  RetireResult,
  RevertRequest,
  RevertResult,
  SaveDraftRequest,
  SaveDraftResult,
  SimulationResult,
  VersionDetail,
  VersionDiffResult,
  VersionSummary,
} from '../types/adventureAdmin'

/**
 * 冒险内容管理台（Adventure Studio）接口层。
 * 契约唯一真相：deda-server `docs/analytics-api.md` 的「冒险内容管理（Adventure Studio）」章节。
 *
 * 与 analytics.ts 分开成文件而不是并进去，是因为那边的头部约定「所有接口均为 GET」
 * 在这里不成立：本节大量为 POST（存草稿 / 发布 / 回滚 / 下架 / 导入），
 * lint / simulate / import-preview 三个 POST 更是**明确不写库**的只读计算。
 *
 * 路由挂在 /analytics 前缀下是刻意的：vite proxy 与 nginx 已整段转发 /analytics，
 * 新增能力不需要改任何部署配置。
 */

const BASE = '/analytics/adventure-admin'

// ---- 能力清单 ----

/** 枚举、阈值、能不能写，全部由服务端说了算，前端不硬编码 */
export async function fetchCapabilities(): Promise<CapabilitiesResponse> {
  const resp = await apiClient.get(`${BASE}/capabilities`)
  return resp.data as CapabilitiesResponse
}

// ---- 读接口 ----

export async function fetchEpisodes(
  query: EpisodeListQuery,
): Promise<EpisodeListResponse> {
  const resp = await apiClient.get(`${BASE}/episodes`, { params: query })
  return resp.data as EpisodeListResponse
}

/** 返回的 baseVersionId 是乐观锁基线，存草稿时必须原样带回 */
export async function fetchEpisode(episodeId: string): Promise<EpisodeDetail> {
  const resp = await apiClient.get(`${BASE}/episodes/${episodeId}`)
  return resp.data as EpisodeDetail
}

export async function fetchVersions(
  episodeId: string,
): Promise<VersionSummary[]> {
  const resp = await apiClient.get(`${BASE}/episodes/${episodeId}/versions`)
  return resp.data as VersionSummary[]
}

export async function fetchVersion(
  episodeId: string,
  versionId: string,
): Promise<VersionDetail> {
  const resp = await apiClient.get(
    `${BASE}/episodes/${episodeId}/versions/${versionId}`,
  )
  return resp.data as VersionDetail
}

export async function fetchVersionDiff(
  episodeId: string,
  left: string,
  right: string,
): Promise<VersionDiffResult> {
  const resp = await apiClient.get(`${BASE}/episodes/${episodeId}/diff`, {
    params: { left, right },
  })
  return resp.data as VersionDiffResult
}

/** 破坏性确认弹窗里的那些数字：今天在播 / 跨天挂起 / 锁在旧版本的设备数 */
export async function fetchEpisodeImpact(
  episodeId: string,
): Promise<EpisodeImpact> {
  const resp = await apiClient.get(`${BASE}/episodes/${episodeId}/impact`)
  return resp.data as EpisodeImpact
}

export async function fetchAudit(
  query: AuditQuery,
): Promise<AuditListResponse> {
  const resp = await apiClient.get(`${BASE}/audit`, { params: query })
  return resp.data as AuditListResponse
}

// ---- 校验与试播（POST，但不写库，只读环境同样可用）----

export async function checkContent(req: LintRequest): Promise<LintReport> {
  const resp = await apiClient.post(`${BASE}/lint`, req)
  return resp.data as LintReport
}

export async function simulateEpisode(
  identity: EpisodeIdentity,
  content: EpisodeContent,
): Promise<SimulationResult> {
  const resp = await apiClient.post(`${BASE}/simulate`, { identity, content })
  return resp.data as SimulationResult
}

// ---- 写接口（authoring 环境 + adventure-content scope 才可用）----

/** 只落草稿，不发布。业务键一旦占用即永久占用 */
export async function createEpisode(
  req: CreateEpisodeRequest,
): Promise<CreateEpisodeResult> {
  const resp = await apiClient.post(`${BASE}/episodes`, req)
  return resp.data as CreateEpisodeResult
}

export async function saveDraft(
  episodeId: string,
  req: SaveDraftRequest,
): Promise<SaveDraftResult> {
  const resp = await apiClient.post(`${BASE}/episodes/${episodeId}/draft`, req)
  return resp.data as SaveDraftResult
}

export async function publishEpisode(
  episodeId: string,
  reason: string,
): Promise<PublishResult> {
  const resp = await apiClient.post(`${BASE}/episodes/${episodeId}/publish`, {
    reason,
  })
  return resp.data as PublishResult
}

/** 快速回滚 = 把目标快照复制成一个新版本再发布，历史一行都不改 */
export async function revertEpisode(
  episodeId: string,
  req: RevertRequest,
): Promise<RevertResult> {
  const resp = await apiClient.post(`${BASE}/episodes/${episodeId}/revert`, req)
  return resp.data as RevertResult
}

/** 墓碑而非删除。当日在播的孩子完全不动 */
export async function retireEpisode(
  episodeId: string,
  req: { reason: string; confirmText: string },
): Promise<RetireResult> {
  const resp = await apiClient.post(`${BASE}/episodes/${episodeId}/retire`, req)
  return resp.data as RetireResult
}

export async function restoreEpisode(
  episodeId: string,
  reason: string,
): Promise<RestoreResult> {
  const resp = await apiClient.post(`${BASE}/episodes/${episodeId}/restore`, {
    reason,
  })
  return resp.data as RestoreResult
}

export async function discardEpisodeDraft(
  episodeId: string,
  reason: string,
): Promise<DiscardDraftResult> {
  const resp = await apiClient.post(
    `${BASE}/episodes/${episodeId}/discard-draft`,
    { reason },
  )
  return resp.data as DiscardDraftResult
}

/** 只能作废从未发布过的集；发布过的请走 retire */
export async function discardEpisode(
  episodeId: string,
  req: { reason: string; confirmText: string },
): Promise<DiscardEpisodeResult> {
  const resp = await apiClient.post(`${BASE}/episodes/${episodeId}/discard`, req)
  return resp.data as DiscardEpisodeResult
}

// ---- staging → prod 搬运 ----

/** 只导当前已发布快照，草稿不进 bundle。会留一条 export 审计，故只读环境不可用 */
export async function exportBundle(
  selector: ExportSelector,
): Promise<ExportResult> {
  const resp = await apiClient.post(`${BASE}/export`, selector)
  return resp.data as ExportResult
}

/** dry-run：不写库、不审计，返回 diff 计划与确认码 */
export async function previewImport(
  bundle: AdventureBundle,
): Promise<ImportPreview> {
  const resp = await apiClient.post(`${BASE}/import/preview`, { bundle })
  return resp.data as ImportPreview
}

/** 只落草稿，永不自动发布；任一项被 reject 则整批不写 */
export async function applyImport(
  req: ImportApplyRequest,
): Promise<ImportApplyResult> {
  const resp = await apiClient.post(`${BASE}/import`, req)
  return resp.data as ImportApplyResult
}

// ---- 自愈与兜底（recovery）----

export async function fetchRecoveryHealth(): Promise<RecoveryHealthSnapshot> {
  const resp = await apiClient.get(`${BASE}/recovery`)
  return resp.data as RecoveryHealthSnapshot
}

/** audited=false 表示动作已生效但审计没写进去，UI 必须显式提示「这次没留痕」 */
export async function runRecoverySweep(
  reason: string,
): Promise<RecoverySweepResult> {
  const resp = await apiClient.post(`${BASE}/recovery/sweep`, { reason })
  return resp.data as RecoverySweepResult
}

/** 授权回滚：解除降级只由人决定，系统绝不自动回滚 */
export async function resetRecoveryBreaker(
  reason: string,
): Promise<RecoveryResetResult> {
  const resp = await apiClient.post(`${BASE}/recovery/reset`, { reason })
  return resp.data as RecoveryResetResult
}
