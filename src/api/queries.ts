import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchActivationFunnel,
  fetchContentAdventure,
  fetchContentAdventureChoices,
  fetchContentLearning,
  fetchContentParentReport,
  fetchCurrentMemories,
  deleteDeviceChildProfile,
  fetchDeviceChildProfile,
  fetchDurationDistribution,
  fetchEngagementSummary,
  fetchFeatureAdoption,
  fetchFleetChurnRisk,
  fetchFleetDeviceDetail,
  fetchFleetDevices,
  fetchFleetFirmwareDistribution,
  fetchFleetPresenceTrend,
  fetchFleetSummary,
  fetchHourlyHeatmap,
  fetchIntentSummary,
  fetchIntentTrend,
  fetchInterruptionRate,
  fetchLlmCallsByTurn,
  fetchLlmRecentFailures,
  fetchLlmSlowCalls,
  fetchLlmCostDaily,
  fetchLlmSummary,
  fetchLlmTrend,
  fetchMemoriesOverview,
  fetchMemoryDevices,
  fetchMemoryHistory,
  fetchMessageDetail,
  fetchMessageModes,
  fetchMessages,
  fetchModeUsage,
  fetchNetworkUsage,
  fetchOverview,
  fetchOverviewTrend,
  fetchQualityConversation,
  fetchReportFeedbacks,
  fetchParentReports,
  fetchPhoneBrands,
  fetchRetentionCohorts,
  fetchRetentionCurve,
  fetchReviewQueue,
  fetchSafetySummary,
  fetchSafetyTrend,
  fetchUserFeedbacks,
  fetchUsersDemographics,
  fetchUsersSummary,
} from './analytics'
import type {
  MessagesQuery,
  OverviewTrendParams,
  ReportFeedbackQuery,
  ReviewQueueQuery,
  UserFeedbackQuery,
} from './analytics'
import type { CohortBasis, Granularity } from '../types/analytics'
import {
  applyImport,
  checkContent,
  createEpisode,
  discardEpisode,
  discardEpisodeDraft,
  exportBundle,
  fetchAudit,
  fetchCapabilities,
  fetchCharacterTestDevices,
  fetchDeviceTestAssignment,
  fetchEpisode,
  fetchEpisodeImpact,
  fetchEpisodeChoiceStats,
  fetchEpisodes,
  fetchRecoveryHealth,
  fetchVersion,
  fetchVersionDiff,
  fetchVersions,
  assignTestStory,
  clearTestStory,
  convertScript,
  fetchNextEpisodeNumber,
  previewImport,
  publishEpisode,
  resetRecoveryBreaker,
  restoreEpisode,
  retireEpisode,
  revertEpisode,
  runRecoverySweep,
  saveDraft,
  simulateEpisode,
} from './adventureAdmin'
import type {
  AdventureBundle,
  AdventureCharacterKey,
  AuditQuery,
  CreateEpisodeRequest,
  EpisodeContent,
  EpisodeIdentity,
  EpisodeListQuery,
  ExportSelector,
  ImportApplyRequest,
  LintRequest,
  RevertRequest,
  SaveDraftRequest,
  ScriptConvertRequest,
} from '../types/adventureAdmin'

/**
 * TanStack Query hooks 层：页面只与这里交互，不直接调 analytics.ts /
 * adventureAdmin.ts。
 * queryKey 规范：['analytics', 资源, 参数]——参数对象由 TanStack 稳定哈希，
 * 同 key 自动缓存/去重，key 变化自动作废旧请求（替代原手写 cancelled 防护）。
 * 全局配置见 main.tsx（staleTime 5min / retry 1 / 关闭 focus 重拉）。
 */

// ---- 总览 ----

export function useOverview(date: string) {
  return useQuery({
    queryKey: ['analytics', 'overview', date],
    queryFn: () => fetchOverview(date),
  })
}

export function useOverviewTrend(params: OverviewTrendParams) {
  return useQuery({
    queryKey: ['analytics', 'overviewTrend', params],
    queryFn: () => fetchOverviewTrend(params),
  })
}

// ---- 留存与激活 ----

export function useRetentionCohorts(params: {
  startDate: string
  endDate: string
  granularity?: 'day' | 'week'
  basis?: CohortBasis
}) {
  return useQuery({
    queryKey: ['analytics', 'retentionCohorts', params],
    queryFn: () => fetchRetentionCohorts(params),
  })
}

export function useRetentionCurve(params?: {
  cohortStartDate?: string
  cohortEndDate?: string
}) {
  return useQuery({
    queryKey: ['analytics', 'retentionCurve', params ?? null],
    queryFn: () => fetchRetentionCurve(params),
  })
}

export function useActivationFunnel(params: {
  startDate: string
  endDate: string
}) {
  return useQuery({
    queryKey: ['analytics', 'activationFunnel', params],
    queryFn: () => fetchActivationFunnel(params),
  })
}

// ---- 用户反馈 ----

export function useReportFeedbacks(query: ReportFeedbackQuery) {
  return useQuery({
    queryKey: ['analytics', 'reportFeedbacks', query],
    queryFn: () => fetchReportFeedbacks(query),
    placeholderData: (prev) => prev,
  })
}

export function useUserFeedbacks(query: UserFeedbackQuery) {
  return useQuery({
    queryKey: ['analytics', 'userFeedbacks', query],
    queryFn: () => fetchUserFeedbacks(query),
    placeholderData: (prev) => prev,
  })
}

/** 单设备日报列表（用户详情页）；deviceId 为空串时不发起 */
export function useParentReports(query: {
  deviceId: string
  page?: number
  pageSize?: number
}) {
  return useQuery({
    queryKey: ['analytics', 'parentReports', query],
    queryFn: () => fetchParentReports(query),
    enabled: query.deviceId !== '',
    placeholderData: (prev) => prev,
  })
}

// ---- 使用行为 ----

export function useEngagementSummary(params: {
  startDate: string
  endDate: string
}) {
  return useQuery({
    queryKey: ['analytics', 'engagementSummary', params],
    queryFn: () => fetchEngagementSummary(params),
  })
}

export function useDurationDistribution(date: string) {
  return useQuery({
    queryKey: ['analytics', 'durationDistribution', date],
    queryFn: () => fetchDurationDistribution(date),
  })
}

export function useHourlyHeatmap(params: {
  startDate: string
  endDate: string
}) {
  return useQuery({
    queryKey: ['analytics', 'hourlyHeatmap', params],
    queryFn: () => fetchHourlyHeatmap(params),
  })
}

export function useModeUsage(params: { startDate: string; endDate: string }) {
  return useQuery({
    queryKey: ['analytics', 'modeUsage', params],
    queryFn: () => fetchModeUsage(params),
  })
}

export function useNetworkUsage(params: {
  startDate: string
  endDate: string
}) {
  return useQuery({
    queryKey: ['analytics', 'networkUsage', params],
    queryFn: () => fetchNetworkUsage(params),
  })
}

export function useFeatureAdoption(date: string) {
  return useQuery({
    queryKey: ['analytics', 'featureAdoption', date],
    queryFn: () => fetchFeatureAdoption(date),
  })
}

// ---- 用户画像 ----

export function useUsersSummary(params?: {
  startDate?: string
  endDate?: string
}) {
  return useQuery({
    queryKey: ['analytics', 'usersSummary', params ?? null],
    queryFn: () => fetchUsersSummary(params),
  })
}

export function useUsersDemographics() {
  return useQuery({
    queryKey: ['analytics', 'usersDemographics'],
    queryFn: fetchUsersDemographics,
  })
}

export function usePhoneBrands() {
  return useQuery({
    queryKey: ['analytics', 'phoneBrands'],
    queryFn: fetchPhoneBrands,
  })
}

// ---- 内容与质量 ----

export function useContentAdventure(params: {
  startDate: string
  endDate: string
}) {
  return useQuery({
    queryKey: ['analytics', 'contentAdventure', params],
    queryFn: () => fetchContentAdventure(params),
  })
}

export function useContentAdventureChoices(params: {
  startDate?: string
  endDate?: string
}) {
  return useQuery({
    queryKey: ['analytics', 'contentAdventureChoices', params],
    queryFn: () => fetchContentAdventureChoices(params),
  })
}

export function useContentLearning(params: {
  startDate: string
  endDate: string
}) {
  return useQuery({
    queryKey: ['analytics', 'contentLearning', params],
    queryFn: () => fetchContentLearning(params),
  })
}

export function useContentParentReport(params: {
  startDate: string
  endDate: string
}) {
  return useQuery({
    queryKey: ['analytics', 'contentParentReport', params],
    queryFn: () => fetchContentParentReport(params),
  })
}

export function useQualityConversation(params: {
  startDate: string
  endDate: string
  granularity?: Granularity
}) {
  return useQuery({
    queryKey: ['analytics', 'qualityConversation', params],
    queryFn: () => fetchQualityConversation(params),
  })
}

// ---- 消息明细 ----

export function useMessages(query: MessagesQuery, enabled = true) {
  return useQuery({
    queryKey: ['analytics', 'messages', query],
    queryFn: () => fetchMessages(query),
    placeholderData: (prev) => prev,
    enabled,
  })
}

export function useMessageDetail(id: string | null) {
  return useQuery({
    queryKey: ['analytics', 'messageDetail', id],
    queryFn: () => fetchMessageDetail(id!),
    enabled: id !== null,
  })
}

// ---- 模型监控 ----

export function useLlmSummary(params: {
  startDate?: string
  endDate?: string
}) {
  return useQuery({
    queryKey: ['analytics', 'llmSummary', params],
    queryFn: () => fetchLlmSummary(params),
  })
}

export function useLlmTrend(params: {
  startDate?: string
  endDate?: string
  granularity?: Granularity
  scene?: string
}) {
  return useQuery({
    queryKey: ['analytics', 'llmTrend', params],
    queryFn: () => fetchLlmTrend(params),
  })
}

export function useLlmRecentFailures(params: {
  page?: number
  pageSize?: number
  scene?: string
}) {
  return useQuery({
    queryKey: ['analytics', 'llmRecentFailures', params],
    queryFn: () => fetchLlmRecentFailures(params),
    placeholderData: (prev) => prev,
  })
}

// ---- 记忆档案 ----

export function useMemoriesOverview() {
  return useQuery({
    queryKey: ['analytics', 'memoriesOverview'],
    queryFn: fetchMemoriesOverview,
  })
}

export function useMemoryDevices(params: {
  keyword?: string
  page?: number
  pageSize?: number
}) {
  return useQuery({
    queryKey: ['analytics', 'memoryDevices', params],
    queryFn: () => fetchMemoryDevices(params),
    placeholderData: (prev) => prev,
  })
}

export function useCurrentMemories(deviceId: string) {
  return useQuery({
    queryKey: ['analytics', 'currentMemories', deviceId],
    queryFn: () => fetchCurrentMemories(deviceId),
  })
}

export function useMemoryHistory(deviceId: string, key: string | null) {
  return useQuery({
    queryKey: ['analytics', 'memoryHistory', deviceId, key],
    queryFn: () => fetchMemoryHistory(deviceId, key!),
    enabled: key !== null,
  })
}

// ---- 消息辅助统计 ----

export function useMessageModes(params?: {
  startDate?: string
  endDate?: string
}) {
  return useQuery({
    queryKey: ['analytics', 'messageModes', params ?? null],
    queryFn: () => fetchMessageModes(params),
  })
}

export function useInterruptionRate(params?: {
  startDate?: string
  endDate?: string
}) {
  return useQuery({
    queryKey: ['analytics', 'interruptionRate', params ?? null],
    queryFn: () => fetchInterruptionRate(params),
  })
}

// ---- 模型监控（补充） ----

export function useLlmCallsByTurn(turnId: string | null) {
  return useQuery({
    queryKey: ['analytics', 'llmCallsByTurn', turnId],
    queryFn: () => fetchLlmCallsByTurn(turnId!),
    enabled: turnId !== null,
  })
}

export function useLlmSlowCalls(params: {
  startDate: string
  endDate: string
  scene?: string
  limit?: number
}) {
  return useQuery({
    queryKey: ['analytics', 'llmSlowCalls', params],
    queryFn: () => fetchLlmSlowCalls(params),
  })
}

export function useLlmCost(params: {
  startDate: string
  endDate: string
}) {
  return useQuery({
    queryKey: ['analytics', 'llmCost', params],
    queryFn: () => fetchLlmCostDaily(params),
  })
}

// ---- 判定质量监控（decisions） ----
// 分母 0 时后端返回 rate=null（不是 0），组件层一律渲染「—」。

export function useSafetySummary(params: {
  startDate: string
  endDate: string
}) {
  return useQuery({
    queryKey: ['analytics', 'safetySummary', params],
    queryFn: () => fetchSafetySummary(params),
  })
}

export function useSafetyTrend(params: {
  startDate: string
  endDate: string
  granularity?: Granularity
}) {
  return useQuery({
    queryKey: ['analytics', 'safetyTrend', params],
    queryFn: () => fetchSafetyTrend(params),
  })
}

export function useIntentSummary(params: {
  startDate: string
  endDate: string
}) {
  return useQuery({
    queryKey: ['analytics', 'intentSummary', params],
    queryFn: () => fetchIntentSummary(params),
  })
}

export function useIntentTrend(params: {
  startDate: string
  endDate: string
  granularity?: Granularity
}) {
  return useQuery({
    queryKey: ['analytics', 'intentTrend', params],
    queryFn: () => fetchIntentTrend(params),
  })
}

/** 人工复核队列（本期只读；reviewLabel 写接口留待二期） */
export function useReviewQueue(query: ReviewQueueQuery) {
  return useQuery({
    queryKey: ['analytics', 'reviewQueue', query],
    queryFn: () => fetchReviewQueue(query),
    placeholderData: (prev) => prev,
  })
}

// ---- 设备舰队 ----

export function useFleetSummary(date: string) {
  return useQuery({
    queryKey: ['analytics', 'fleetSummary', date],
    queryFn: () => fetchFleetSummary(date),
  })
}

export function useFleetPresenceTrend(params: {
  startDate: string
  endDate: string
}) {
  return useQuery({
    queryKey: ['analytics', 'fleetPresenceTrend', params],
    queryFn: () => fetchFleetPresenceTrend(params),
  })
}

export function useFleetFirmwareDistribution() {
  return useQuery({
    queryKey: ['analytics', 'fleetFirmwareDistribution'],
    queryFn: fetchFleetFirmwareDistribution,
  })
}

export function useFleetChurnRisk(days: number) {
  return useQuery({
    queryKey: ['analytics', 'fleetChurnRisk', days],
    queryFn: () => fetchFleetChurnRisk(days),
  })
}

export function useFleetDevices(params: {
  keyword?: string
  page?: number
  pageSize?: number
}) {
  return useQuery({
    queryKey: ['analytics', 'fleetDevices', params],
    queryFn: () => fetchFleetDevices(params),
    placeholderData: (prev) => prev,
  })
}

export function useFleetDeviceDetail(deviceId: string | null, days: number) {
  return useQuery({
    queryKey: ['analytics', 'fleetDeviceDetail', deviceId, days],
    queryFn: () => fetchFleetDeviceDetail(deviceId!, days),
    enabled: deviceId !== null,
  })
}

export function useDeviceChildProfile(deviceId: string | null) {
  return useQuery({
    queryKey: ['analytics', 'deviceChildProfile', deviceId],
    queryFn: () => fetchDeviceChildProfile(deviceId!),
    enabled: deviceId !== null,
  })
}

/**
 * 清空孩子档案（仅 superadmin 能过服务端闸口；普通 admin 会吃 403 → 提示失败）。
 * 成功后作废该设备的档案缓存，section 自动回到「未设置」空态。
 */
export function useDeleteDeviceChildProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (deviceId: string) => deleteDeviceChildProfile(deviceId),
    onSuccess: (_data, deviceId) => {
      void queryClient.invalidateQueries({
        queryKey: ['analytics', 'deviceChildProfile', deviceId],
      })
    },
  })
}

// ---- 冒险内容管理（Adventure Studio）----
//
// queryKey 沿用 ['analytics', 资源, 参数] 规范，资源统一挂在 'adventure' 之下：
// 任何一次写操作成功后都能用 ADVENTURE_QUERY_ROOT 一次性作废整组缓存。
// 这里刻意不做逐 key 精确作废——内容变更的影响面横跨列表/详情/版本/审计/自愈，
// 精确作废反而容易漏掉一处，出现「明明改了、界面还显示旧的」这种最难查的假象。
// 管理台是低频操作，多刷几个请求换「界面永远等于库里真相」非常划算。

export const ADVENTURE_QUERY_ROOT = ['analytics', 'adventure'] as const

/** 自愈面板需要接近实时，其余读接口沿用全局 staleTime 5min */
const RECOVERY_REFETCH_INTERVAL_MS = 30_000

export function useAdventureCapabilities(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...ADVENTURE_QUERY_ROOT, 'capabilities'],
    queryFn: fetchCapabilities,
    // 枚举与阈值来自服务端配置，一个会话内不会变；也不该因为一次写操作就去重拉
    staleTime: Infinity,
    gcTime: Infinity,
    enabled: options?.enabled ?? true,
  })
}

/**
 * 能不能写。capabilities 还没回来时一律按 false 处理（与服务端 fail-safe 同向）：
 * 宁可让按钮短暂禁用，也不能让 prod 的管理员看见一个点了才 403 的「发布」。
 */
export function useAdventureAuthoring(): boolean {
  const { data } = useAdventureCapabilities()
  return data?.authoring === true
}

export function useAdventureEpisodes(query: EpisodeListQuery) {
  return useQuery({
    queryKey: [...ADVENTURE_QUERY_ROOT, 'episodes', query],
    queryFn: () => fetchEpisodes(query),
    placeholderData: (prev) => prev,
  })
}

export function useAdventureEpisode(episodeId: string | null) {
  return useQuery({
    queryKey: [...ADVENTURE_QUERY_ROOT, 'episode', episodeId],
    queryFn: () => fetchEpisode(episodeId!),
    enabled: episodeId !== null,
  })
}

export function useAdventureVersions(episodeId: string | null) {
  return useQuery({
    queryKey: [...ADVENTURE_QUERY_ROOT, 'versions', episodeId],
    queryFn: () => fetchVersions(episodeId!),
    enabled: episodeId !== null,
  })
}

export function useAdventureVersion(
  episodeId: string | null,
  versionId: string | null,
) {
  return useQuery({
    queryKey: [...ADVENTURE_QUERY_ROOT, 'version', episodeId, versionId],
    queryFn: () => fetchVersion(episodeId!, versionId!),
    enabled: episodeId !== null && versionId !== null,
  })
}

export function useAdventureVersionDiff(
  episodeId: string | null,
  left: string | null,
  right: string | null,
) {
  return useQuery({
    queryKey: [...ADVENTURE_QUERY_ROOT, 'diff', episodeId, left, right],
    queryFn: () => fetchVersionDiff(episodeId!, left!, right!),
    enabled: episodeId !== null && left !== null && right !== null,
  })
}

export function useAdventureImpact(episodeId: string | null) {
  return useQuery({
    queryKey: [...ADVENTURE_QUERY_ROOT, 'impact', episodeId],
    queryFn: () => fetchEpisodeImpact(episodeId!),
    enabled: episodeId !== null,
  })
}

export function useEpisodeChoiceStats(
  episodeId: string | null,
  params?: { startDate?: string; endDate?: string },
) {
  return useQuery({
    queryKey: [
      ...ADVENTURE_QUERY_ROOT,
      'choiceStats',
      episodeId,
      params ?? null,
    ],
    queryFn: () => fetchEpisodeChoiceStats(episodeId!, params ?? {}),
    enabled: episodeId !== null,
  })
}

export function useAdventureAudit(query: AuditQuery) {
  return useQuery({
    queryKey: [...ADVENTURE_QUERY_ROOT, 'audit', query],
    queryFn: () => fetchAudit(query),
    placeholderData: (prev) => prev,
  })
}

export function useAdventureRecovery() {
  return useQuery({
    queryKey: [...ADVENTURE_QUERY_ROOT, 'recovery'],
    queryFn: fetchRecoveryHealth,
    refetchInterval: RECOVERY_REFETCH_INTERVAL_MS,
  })
}

/**
 * 校验与试播都是「拿当前编辑器内容问一次服务端」，不适合做缓存查询
 * （内容每敲一个字就变，queryKey 会无限膨胀）。这里做成 mutation：
 * 由人显式触发（「校验」按钮、点「发布」时的发布前检查），结果留在组件自己的
 * state 里。**打字过程中一次都不发**——边写边弹错会打断写作，而草稿本来就允许
 * 不合规（服务端只拦身份级错误与会被规范化丢掉的段落），真正的闸口在发布。
 * 它们不写库，所以成功后**不作废**任何缓存。
 */
export function useAdventureLint() {
  return useMutation({
    mutationFn: (req: LintRequest) => checkContent(req),
  })
}

/**
 * 「按发布标准」校验**服务端那一份**内容。
 *
 * getEpisode 返回的 lint 是按草稿标准算的（forPublish=false），只覆盖存草稿的门槛；
 * 发布与回滚走的是 forPublish=true，会多出一条 PREDECESSOR_NOT_PUBLISHED
 * （第 N 集不能先于 1..N-1 发布）。编辑器必须看到真正的发布门槛，
 * 否则会出现「界面说没问题、点发布才被拒」。
 *
 * 内容来自服务端而不是键盘，所以适合做缓存查询；键里带乐观锁双令牌，
 * 别人存过一次这份校验就必须重算。它只在抽屉打开与令牌变化时各打一次，
 * 不在打字链路上，所以不违背「写作过程中不校验」。
 * 正在编辑那一份的校验由人点「校验」触发，走 useAdventureLint。
 */
export function useAdventurePublishLint(
  episodeId: string | null,
  content: EpisodeContent | null,
  tokens: { baseVersionId: string | null; baseDraftUpdatedAt: string | null },
  identity: EpisodeIdentity | null,
) {
  return useQuery({
    queryKey: [
      ...ADVENTURE_QUERY_ROOT,
      'publish-lint',
      episodeId,
      tokens.baseVersionId,
      tokens.baseDraftUpdatedAt,
    ],
    queryFn: () =>
      checkContent({
        episodeId: episodeId!,
        // 身份必须跟 forPublish 一起带上：服务端只在请求带 identity 时才读顶层的
        // forPublish（adventure-admin.controller.ts 的 lint 处理器）。只给 episodeId
        // 时它改用库里的身份，而那份身份不带 forPublish —— 这次校验会**静默退回
        // 草稿标准**：禁用词只是提醒，界面会说「没有阻断项，可以发布」，
        // 然后被服务端 400 挡回来，正是这个 hook 的注释里要避免的那件事。
        // identity 里不能再嵌 forPublish：LintDto 对 identity 开了
        // forbidNonWhitelisted，嵌了直接 400。
        identity: identity ?? undefined,
        content: content!,
        forPublish: true,
      }),
    enabled: episodeId !== null && content !== null,
  })
}

export function useAdventureSimulate() {
  return useMutation({
    mutationFn: ({
      identity,
      content,
    }: {
      identity: EpisodeIdentity
      content: EpisodeContent
    }) => simulateEpisode(identity, content),
  })
}

/**
 * 写操作的公共外壳。所有变更（含 export，它会落一条审计）成功后一律作废整组
 * adventure 缓存，理由见本节开头。失败不在这里处理：领域错误码（409 DRAFT_CONFLICT
 * 之类）需要各自的 UI 语境，由调用方在 onError / catch 里按 error.domainCode 分支。
 */
function useAdventureWrite<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...ADVENTURE_QUERY_ROOT] })
    },
  })
}

export function useCreateAdventureEpisode() {
  return useAdventureWrite((req: CreateEpisodeRequest) => createEpisode(req))
}

export function useSaveAdventureDraft() {
  return useAdventureWrite(
    ({ episodeId, ...req }: { episodeId: string } & SaveDraftRequest) =>
      saveDraft(episodeId, req),
  )
}

export function usePublishAdventureEpisode() {
  return useAdventureWrite(
    ({ episodeId, reason }: { episodeId: string; reason: string }) =>
      publishEpisode(episodeId, reason),
  )
}

export function useRevertAdventureEpisode() {
  return useAdventureWrite(
    ({ episodeId, ...req }: { episodeId: string } & RevertRequest) =>
      revertEpisode(episodeId, req),
  )
}

export function useRetireAdventureEpisode() {
  return useAdventureWrite(
    ({
      episodeId,
      reason,
      confirmText,
    }: {
      episodeId: string
      reason: string
      confirmText: string
    }) => retireEpisode(episodeId, { reason, confirmText }),
  )
}

export function useRestoreAdventureEpisode() {
  return useAdventureWrite(
    ({ episodeId, reason }: { episodeId: string; reason: string }) =>
      restoreEpisode(episodeId, reason),
  )
}

export function useDiscardAdventureDraft() {
  return useAdventureWrite(
    ({ episodeId, reason }: { episodeId: string; reason: string }) =>
      discardEpisodeDraft(episodeId, reason),
  )
}

export function useDiscardAdventureEpisode() {
  return useAdventureWrite(
    ({
      episodeId,
      reason,
      confirmText,
    }: {
      episodeId: string
      reason: string
      confirmText: string
    }) => discardEpisode(episodeId, { reason, confirmText }),
  )
}

export function useAdventureExport() {
  return useAdventureWrite((selector: ExportSelector) => exportBundle(selector))
}

/** dry-run，不写库也不审计，因此走普通 mutation、不作废缓存 */
export function useAdventureImportPreview() {
  return useMutation({
    mutationFn: (bundle: AdventureBundle) => previewImport(bundle),
  })
}

export function useAdventureImport() {
  return useAdventureWrite((req: ImportApplyRequest) => applyImport(req))
}

/** docx 转换是「拿当前上传内容问一次服务端」的只读计算，不写库，走普通 mutation、不作废缓存 */
export function useAdventureScriptConvert() {
  return useMutation({
    mutationFn: (req: ScriptConvertRequest) => convertScript(req),
  })
}

/** 手动新建时取某 IP 下一集的自增集号（含已下架/已作废的集） */
export function useAdventureNextEpisodeNumber(
  characterKey: AdventureCharacterKey | null,
) {
  return useQuery({
    queryKey: [...ADVENTURE_QUERY_ROOT, 'next-number', characterKey],
    queryFn: () => fetchNextEpisodeNumber(characterKey!),
    enabled: characterKey !== null,
  })
}

export function useAdventureRecoverySweep() {
  return useAdventureWrite((reason: string) => runRecoverySweep(reason))
}

export function useAdventureRecoveryReset() {
  return useAdventureWrite((reason: string) => resetRecoveryBreaker(reason))
}

/** 读设备当前下发（按需触发：deviceId 为空时不发请求） */
export function useDeviceTestAssignment(deviceId: string | null) {
  return useQuery({
    queryKey: [...ADVENTURE_QUERY_ROOT, 'device-test-assignment', deviceId],
    queryFn: () => fetchDeviceTestAssignment(deviceId!),
    enabled: deviceId !== null && deviceId.trim().length > 0,
  })
}

/** 按 IP 读当前所有被下发的样机；characterKey 为空或环境未启用时不发请求 */
export function useCharacterTestDevices(
  characterKey: string | null,
  enabled = true,
) {
  return useQuery({
    queryKey: [
      ...ADVENTURE_QUERY_ROOT,
      'character-test-devices',
      characterKey,
    ],
    queryFn: () => fetchCharacterTestDevices(characterKey!),
    enabled: enabled && characterKey !== null,
  })
}

export function useAssignTestStory() {
  return useAdventureWrite(
    ({
      episodeId,
      deviceId,
      reason,
    }: {
      episodeId: string
      deviceId: string
      reason: string
    }) => assignTestStory(episodeId, { deviceId, reason }),
  )
}

export function useClearTestStory() {
  return useAdventureWrite(
    ({
      episodeId,
      deviceId,
      reason,
    }: {
      episodeId: string
      deviceId: string
      reason: string
    }) => clearTestStory(episodeId, { deviceId, reason }),
  )
}
