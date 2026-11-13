/**
 * 与 deda-server `docs/analytics-api.md` 的「冒险内容管理（Adventure Studio）」章节逐项对齐。
 *
 * 与 types/analytics.ts 的两点刻意差异：
 * 1. 这里**不全是 GET**——内容管理台是写密集型的（存草稿 / 发布 / 回滚 / 下架 / 导入），
 *    analytics.ts 头部那句「所有接口均为 GET」的契约约定不适用于本节；
 * 2. 服务端时间字段是 Date，经 JSON 序列化后一律是 ISO 8601 字符串，故这里全部写 string。
 *
 * 枚举值（season / characterKey / interactionType / 各类阈值）一律**不在前端硬编码**，
 * 由 GET capabilities 下发，前端只保留展示用的中文标签映射（见 pages/AdventureStudio/labels.ts）。
 */

// ---- 基础枚举 ----

export type AdventureCharacterKey = 'elly' | 'polly'

export type AdventureInteractionType =
  | 'open_question'
  | 'two_choice'
  | 'repeat_after_me'
  | 'reward'

export type SegmentKind = 'narration' | 'interaction'

/** authoring 才允许写；缺省 / 拼错一律按 readonly 处理（服务端 fail-safe） */
export type ContentAdminProfile = 'authoring' | 'readonly'

export type VersionStatus = 'draft' | 'published' | 'superseded' | 'discarded'

/** 编辑器该加载哪一份内容：草稿优先，其次当前发布版，最后是空壳 */
export type ContentSource = 'draft' | 'published' | 'empty'

export type ImportAction = 'add' | 'replace' | 'already_up_to_date' | 'reject'

/** 审计表的 action 是自由字符串列，这里是当前服务端会写入的全集（筛选项据此生成） */
export const AUDIT_ACTIONS = [
  'create',
  'create_draft',
  'update_draft',
  'publish',
  'revert',
  'retire',
  'restore',
  'discard_draft',
  'discard',
  'export',
  'import',
  'import_noop',
  'self_check_failed',
  'recovery_sweep',
  'recovery_breaker_reset',
] as const

export type AuditAction = string

// ---- 内容形状 ----

export interface TwoChoiceOption {
  key: string
  text: string
  reply: string
}

/** 按 interactionType 取用：two_choice 用 choices，repeat_after_me 用 praise */
export interface SegmentOptions {
  choices?: TwoChoiceOption[] | null
  praise?: string | null
}

export interface EpisodeSegment {
  /** 必须严格 0..n-1 连续，引擎用 order >= segments.length 判完集 */
  order: number
  kind: SegmentKind
  text: string
  interactionType?: AdventureInteractionType | null
  options?: SegmentOptions | null
  fallbackText?: string | null
  exitText?: string | null
  rewardStar?: boolean
}

export interface EpisodeContent {
  title: string
  recap?: string | null
  segments: EpisodeSegment[]
}

export interface EpisodeIdentity {
  characterKey: AdventureCharacterKey
  season: number
  episodeNumber: number
}

// ---- 能力清单 ----

export interface LintThresholds {
  maxInteractionTextChars: number
  maxNarrationTextChars: number
  maxTitleChars: number
  maxStarsPerEpisode: number
  minChoiceKeyChars: number
  minChoiceTextChars: number
  forbiddenWords: string[]
}

export interface SimulationThresholds {
  maxAwaitPoints: number
  maxSessionSeconds: number
}

export interface CapabilitiesResponse {
  season: number
  characterKeys: AdventureCharacterKey[]
  interactionTypes: AdventureInteractionType[]
  replyWaitingInteractionTypes: AdventureInteractionType[]
  segmentKinds: SegmentKind[]
  lintThresholds: LintThresholds
  simulationThresholds: SimulationThresholds
  profile: ContentAdminProfile
  authoring: boolean
}

// ---- 校验与试播 ----

export interface LintIssue {
  severity: 'error' | 'warning'
  /** 机器可读，前端按 code 定位表单字段；message 是给人看的中文 */
  code: string
  message: string
  businessKey: string
  segmentOrder?: number
  /** 形如 segments[2].options.choices[0].text */
  path?: string
}

export interface LintReport {
  /** 无 error 即可发布；warning 不影响 ok */
  ok: boolean
  issues: LintIssue[]
  errors: LintIssue[]
  warnings: LintIssue[]
}

export interface SimulatedBeat {
  says: string[]
  /** 停在哪个交互点等回答；不等回答则为 null */
  stopsAtOrder: number | null
  waitsForReply: boolean
  interactionType: AdventureInteractionType | null
  starsAwarded: number
  choices: TwoChoiceOption[] | null
  praise: string | null
  outcome: 'await_reply' | 'episode_complete'
}

export interface SimulationResult {
  businessKey: string
  recap: string | null
  beats: SimulatedBeat[]
  totalSpokenChars: number
  estimatedSeconds: number
  awaitsReplyCount: number
  totalStars: number
  problems: LintIssue[]
}

// ---- 故事集读侧 ----

export interface EpisodeSummary {
  id: string
  characterKey: string
  season: number
  episodeNumber: number
  /** {characterKey}/{season}/{episodeNumber}，也是破坏性操作 confirmText 的比对目标 */
  businessKey: string
  title: string
  recap: string | null
  published: boolean
  retiredAt: string | null
  currentVersionId: string | null
  currentVersion: number | null
  publishedAt: string | null
  hasDraft: boolean
  draftVersionId: string | null
  draftVersion: number | null
  draftUpdatedAt: string | null
  draftUpdatedBy: string | null
  createdAt: string
  updatedAt: string
}

export interface EpisodeListResponse {
  items: EpisodeSummary[]
  total: number
}

/** 一次 retire / 发布会影响多少孩子。破坏性确认弹窗必须先展示这些数字。 */
export interface EpisodeImpact {
  /** 今日已分配且仍在播：retire 不会打断它们 */
  devicesPlayingToday: number
  /** 跨天陈旧的在播设备：retire 会收走，下次开机换一集 */
  devicesStaleCrossDay: number
  /** 仍锁在旧版本快照上的在播设备：说明历史发布确实造成了并行版本 */
  devicesPinnedToOlderVersions: number
  totalDevicesEverStarted: number
  publishedVersionCount: number
}

export interface EpisodeDetail {
  summary: EpisodeSummary
  content: EpisodeContent
  contentSource: ContentSource
  /** 乐观锁基线，存草稿时必须原样带回 */
  baseVersionId: string | null
  lint: LintReport
  impact: EpisodeImpact
}

export interface VersionSummary {
  id: string
  version: number
  status: VersionStatus
  contentHash: string | null
  changeNote: string | null
  createdBy: string
  createdByName: string
  publishedAt: string | null
  publishedBy: string | null
  supersededById: string | null
  createdAt: string
  updatedAt: string
  title: string
  segmentCount: number
  /** 是否为 episode.currentVersionId 指向的那一版 */
  isCurrent: boolean
}

export interface VersionDetail {
  meta: VersionSummary
  content: EpisodeContent
}

// ---- bundle 与差异 ----

/** bundle 里的段落是白名单补全后的完整形状，没有可选字段 */
export interface BundleSegment {
  order: number
  kind: SegmentKind
  text: string
  interactionType: AdventureInteractionType | null
  options: SegmentOptions | null
  fallbackText: string | null
  exitText: string | null
  rewardStar: boolean
}

export interface BundleEpisode {
  characterKey: AdventureCharacterKey
  season: number
  episodeNumber: number
  title: string
  recap: string | null
  segments: BundleSegment[]
}

export interface AdventureBundle {
  bundleSchemaVersion: number
  /** 仅供人看，不参与哈希 */
  exportedAt: string
  sourceProfile: string
  episodes: BundleEpisode[]
}

export interface SegmentDiff {
  order: number
  change: 'added' | 'removed' | 'modified'
  field?: string
  before?: unknown
  after?: unknown
}

export interface EpisodeDiff {
  businessKey: string
  change: 'added' | 'replaced' | 'identical'
  titleChanged: boolean
  recapChanged: boolean
  segmentDiffs: SegmentDiff[]
}

export interface VersionDiffSide {
  versionId: string
  version: number
  status: VersionStatus
  businessKey: string
  episode: BundleEpisode
}

export interface VersionDiffResult {
  left: VersionDiffSide
  right: VersionDiffSide
  titleChanged: boolean
  recapChanged: boolean
  added: SegmentDiff[]
  removed: SegmentDiff[]
  changed: SegmentDiff[]
  segmentDiffs: SegmentDiff[]
}

// ---- 审计 ----

export interface AuditItem {
  id: string
  action: AuditAction
  /** episode / episode_version / bundle / recovery */
  entityType: string
  episodeId: string | null
  episodeVersionId: string | null
  businessKey: string
  actorUsername: string
  actorDisplayName: string
  profile: ContentAdminProfile
  reason: string | null
  /** 自由结构；recovery 动作里存的是巡检摘要 */
  detail: unknown
  sourceBundleHash: string | null
  createdAt: string
}

export interface AuditListResponse {
  items: AuditItem[]
  total: number
}

// ---- 写侧返回 ----

export interface CreateEpisodeResult {
  episodeId: string
  versionId: string
  version: number
  businessKey: string
  contentHash: string
  lint: LintReport
}

export interface SaveDraftResult extends CreateEpisodeResult {
  created: boolean
}

export interface PublishResult {
  episodeId: string
  versionId: string
  version: number
  businessKey: string
  contentHash: string
  segmentCount: number
  lint: LintReport
  impact: EpisodeImpact
  /** null = 自检本身失败；[] = 无漂移 */
  selfCheckDrift: string[] | null
}

export interface RevertResult {
  episodeId: string
  versionId: string
  newVersion: number
  businessKey: string
  revertedToVersionId: string
  revertedToVersion: number
  /** 为 true 时 UI 必须提醒创作者「你的草稿还在」 */
  draftStillPending: boolean
  lint: LintReport
  impact: EpisodeImpact
  selfCheckDrift: string[] | null
}

export interface RetireResult {
  episodeId: string
  businessKey: string
  retiredAt: string
  impact: EpisodeImpact
  staleDailyCount: number
  abandonedProgressCount: number
  message: string
}

export interface RestoreResult {
  episodeId: string
  businessKey: string
  abandonedProgressNotRestored: number
  message: string
}

export interface DiscardDraftResult {
  episodeId: string
  businessKey: string
  discardedVersionId: string
  version: number
}

export interface DiscardEpisodeResult {
  episodeId: string
  businessKey: string
  discardedDraftCount: number
  message: string
}

// ---- staging → prod 搬运 ----

export interface ExportSelector {
  episodeIds?: string[]
  characterKey?: AdventureCharacterKey
  includeRetired?: boolean
}

export interface ExportSkipped {
  businessKey: string
  reason: string
}

export interface ExportResult {
  bundle: AdventureBundle
  bundleHash: string
  confirmToken: string
  episodeCount: number
  skipped: ExportSkipped[]
}

export interface ImportEpisodePlan {
  businessKey: string
  action: ImportAction
  incomingHash: string
  existingHash: string | null
  episodeId?: string
  reason?: string
  diff?: EpisodeDiff
}

export interface ImportPlan {
  /** 无 reject 才允许提交 */
  ok: boolean
  bundleHash: string
  items: ImportEpisodePlan[]
  adds: number
  replaces: number
  upToDate: number
  rejects: number
}

export interface ImportPreview {
  ok: boolean
  bundleHash: string
  confirmToken: string
  plan: ImportPlan
  parseErrors: string[]
  parseWarnings: string[]
  message: string
}

export interface ImportWrittenItem {
  businessKey: string
  action: 'add' | 'replace'
  episodeId: string
  versionId: string
  version: number
}

export interface ImportApplyResult {
  bundleHash: string
  confirmToken: string
  plan: ImportPlan
  written: ImportWrittenItem[]
  skipped: string[]
  message: string
}

// ---- 自愈与兜底（recovery）----

export interface BreakerState {
  enabled: boolean
  tripped: boolean
  failureCount: number
  /** Redis 不可用：计数失真，此时刻意报告「未熔断」 */
  degraded: boolean
  trippedAt: string | null
  windowMs: number
  threshold: number
  recentReasons: string[]
  error: string | null
}

export interface RecoveryConfig {
  enabled: boolean
  sweepIntervalMs: number
  staleAwaitMs: number
  staleAwaitAction: 'off' | 'alert' | 'exit'
  breakerWindowMs: number
  breakerThreshold: number
  breakerTrippedTtlSeconds: number
}

export type RecoveryCode =
  | 'STALE_AWAITING_REPLY'
  | 'AWAITING_NON_INTERACTION'
  | 'VERSION_ROW_MISSING'
  | 'VERSION_PAYLOAD_UNUSABLE'
  | 'SEGMENT_ORDER_OVERFLOW'
  | 'DAILY_PROGRESS_STATE_CONFLICT'
  | 'RETIRED_STALE_DAILY'
  | 'SEGMENT_TABLE_DRIFT'
  | 'DAILY_WITHOUT_PLAYABLE_PROGRESS'

export interface RepairRecord {
  code: RecoveryCode
  deviceId: string
  episodeId: string
  dailyRecordId: string | null
  progressId: string | null
  target: 'progress' | 'daily'
  from: string
  to: string
  detail: string
}

export interface AlertRecord {
  code: RecoveryCode
  deviceId: string | null
  episodeId: string
  progressId?: string | null
  dailyRecordId?: string | null
  detail: string
}

export interface SweepReport {
  startedAt: string
  finishedAt: string
  durationMs: number
  /** kill switch 关闭时为 true，此时不扫库、不修任何东西 */
  skipped: boolean
  reason: string | null
  scanned: { progresses: number; dailyRecords: number; episodes: number }
  repairs: RepairRecord[]
  alerts: AlertRecord[]
  errors: string[]
}

export interface EngineFailureRecord {
  deviceId: string
  phase: 'start_today' | 'handle_reply' | 'check_timeout'
  reason: string
  recovered: boolean
  at: string
}

export interface RecoveryHealthSnapshot {
  breaker: BreakerState
  config: RecoveryConfig
  /** 最近 20 份，新在前 */
  sweeps: SweepReport[]
  /** 最近 50 条 */
  engineFailures: EngineFailureRecord[]
}

export interface RecoverySweepResult {
  report: SweepReport
  /** false = 动作已生效但审计没写进去，UI 必须显式提示「这次没留痕」 */
  audited: boolean
}

export interface RecoveryResetResult {
  ok: boolean
  audited: boolean
}

// ---- 请求参数 ----

export interface EpisodeListQuery {
  characterKey?: AdventureCharacterKey
  published?: boolean
  includeRetired?: boolean
  search?: string
  page?: number
  /** 缺省 50，最大 200 */
  pageSize?: number
}

export interface AuditQuery {
  episodeId?: string
  actorUsername?: string
  action?: string
  /** ISO 字符串，含端点 */
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

export interface LintRequest {
  episodeId?: string | null
  identity?: (EpisodeIdentity & { forPublish?: boolean }) | null
  content: EpisodeContent
  forPublish?: boolean
}

export interface SaveDraftRequest {
  content: EpisodeContent
  reason: string
  /** 乐观锁基线；不传 = 明确不参与并发保护 */
  baseVersionId?: string | null
  /** 明知有人在改也要覆盖（UI 上是单独的红色按钮） */
  force?: boolean
}

export interface CreateEpisodeRequest {
  identity: EpisodeIdentity
  content: EpisodeContent
  reason: string
}

export interface ReasonRequest {
  reason: string
}

export interface ConfirmRequest extends ReasonRequest {
  /** 必须原样等于业务键 */
  confirmText: string
}

export interface RevertRequest extends ConfirmRequest {
  targetVersionId: string
}

export interface ImportApplyRequest extends ConfirmRequest {
  bundle: AdventureBundle
  /** 预览时拿到的 bundleHash，防「预览的是 A、提交的是 B」 */
  expectedBundleHash?: string
}

// ---- 领域错误码 ----

/**
 * 线上错误信封：`code` 永远是 HTTP 状态码，领域码在 **`data.code`**。
 * 前端一律按领域码分支，不要匹配中文 message（文案会改，码不会）。
 */
export const DOMAIN_CODES = [
  'REASON_REQUIRED',
  'REASON_TOO_LONG',
  'CONFIRM_TEXT_MISMATCH',
  'CONTENT_REJECTED',
  'SEGMENT_WOULD_BE_DROPPED',
  'PUBLISH_BLOCKED',
  'NO_DRAFT',
  'EPISODE_RETIRED',
  'DRAFT_IS_ONLY_CONTENT',
  'VERSION_NOT_REVERTABLE',
  'TARGET_VERSION_REQUIRED',
  'NOT_PUBLISHED',
  'NOT_RETIRED',
  'EPISODE_WAS_PUBLISHED',
  'NOTHING_TO_EXPORT',
  'BUNDLE_REQUIRED',
  'BUNDLE_INVALID',
  'IMPORT_PLAN_REJECTED',
  'BUSINESS_KEY_TAKEN',
  'DRAFT_CONFLICT',
  'BUNDLE_HASH_MISMATCH',
  'ALREADY_RETIRED',
] as const

export type DomainCode = (typeof DOMAIN_CODES)[number]

/** 乐观锁失败时 `data.currentDraft` 的形状，可直接拿去提示「谁在你之前改过」 */
export interface DraftConflictDetail {
  id: string
  version: number
  updatedBy: string | null
  updatedAt: string | null
}
