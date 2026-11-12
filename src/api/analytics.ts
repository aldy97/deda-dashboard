import { apiClient } from './client'
import type {
  ActivationFunnelResponse,
  AdminLoginResponse,
  AdminProfile,
  CohortBasis,
  ContentAdventureResponse,
  ContentLearningResponse,
  ContentParentReportResponse,
  DurationDistributionResponse,
  EngagementSummaryResponse,
  FeatureAdoptionResponse,
  Granularity,
  HourlyHeatmapResponse,
  IntentSummaryResponse,
  IntentTrendResponse,
  InterruptionRateResponse,
  LlmRecentFailuresResponse,
  LlmSlowCallsResponse,
  LlmSummaryResponse,
  LlmTurnChainResponse,
  LlmTurnHandoffResponse,
  LlmTrendResponse,
  LlmCostResponse,
  MemoriesOverviewResponse,
  CurrentMemoriesResponse,
  MemoryDevicesResponse,
  MemoryHistoryResponse,
  MessageDetailResponse,
  MessageListResponse,
  MessageModesResponse,
  MessageSort,
  ModeUsageResponse,
  OverviewResponse,
  OverviewTrendResponse,
  ParentReportListResponse,
  QualityConversationResponse,
  ReportFeedbackListResponse,
  RetentionCohortsResponse,
  RetentionCurveResponse,
  ReviewQueueResponse,
  ReviewQueueSort,
  SafetySummaryResponse,
  SafetyTrendResponse,
  UserFeedbackListResponse,
  UsersDemographicsResponse,
  UsersSummaryResponse,
} from '../types/analytics'

/**
 * 接口层与 deda-server `docs/analytics-api.md` 逐项对齐。
 * 契约约定：所有接口均为 GET，日期 YYYY-MM-DD 闭区间（Asia/Shanghai）。
 * 接口变更只能跟随后端契约文档，不得自行发明字段。
 */

// ---- 鉴权 ----

/** 管理员登录（契约约定 GET，凭据走 query；部署侧保证 access log 不记 query） */
export async function adminLogin(
  username: string,
  password: string,
): Promise<AdminLoginResponse> {
  const resp = await apiClient.get('/analytics/auth/login', {
    params: { username, password },
  })
  return resp.data as AdminLoginResponse
}

export async function fetchAdminProfile(): Promise<AdminProfile> {
  const resp = await apiClient.get('/analytics/auth/profile')
  return resp.data as AdminProfile
}

// ---- 总览 ----

/** date 缺省 = 昨天（T-1 完整自然日） */
export async function fetchOverview(date?: string): Promise<OverviewResponse> {
  const resp = await apiClient.get('/analytics/overview', {
    params: date ? { date } : {},
  })
  return resp.data as OverviewResponse
}

export interface OverviewTrendParams {
  startDate: string
  endDate: string
  granularity?: Granularity
  /** 逗号分隔多选：dau,avgDuration,poweredOn,newActivated,newUsers；缺省全量 */
  metrics?: string
  /** 设备型号过滤：elly / polly */
  characterKey?: string
}

export async function fetchOverviewTrend(
  params: OverviewTrendParams,
): Promise<OverviewTrendResponse> {
  const resp = await apiClient.get('/analytics/overview/trend', { params })
  return resp.data as OverviewTrendResponse
}

// ---- 留存与激活 ----

export async function fetchRetentionCohorts(params: {
  startDate: string
  endDate: string
  granularity?: 'day' | 'week'
  basis?: CohortBasis
}): Promise<RetentionCohortsResponse> {
  const resp = await apiClient.get('/analytics/retention/cohorts', { params })
  return resp.data as RetentionCohortsResponse
}

export async function fetchRetentionCurve(params?: {
  cohortStartDate?: string
  cohortEndDate?: string
}): Promise<RetentionCurveResponse> {
  const resp = await apiClient.get('/analytics/retention/curve', { params })
  return resp.data as RetentionCurveResponse
}

export async function fetchActivationFunnel(params: {
  startDate: string
  endDate: string
}): Promise<ActivationFunnelResponse> {
  const resp = await apiClient.get('/analytics/activation/funnel', { params })
  return resp.data as ActivationFunnelResponse
}

// ---- 用户反馈 ----

/** 日期区间按 reportDate 过滤；summary 不受 isUseful 影响 */
export interface ReportFeedbackQuery {
  startDate?: string
  endDate?: string
  isUseful?: boolean
  /** 业务设备 ID（非数据库 UUID）：单设备过滤，查不到设备返回空页 */
  deviceId?: string
  page?: number
  /** 1-100，默认 20 */
  pageSize?: number
}

export async function fetchReportFeedbacks(
  params: ReportFeedbackQuery,
): Promise<ReportFeedbackListResponse> {
  const resp = await apiClient.get('/analytics/feedback/parent-reports', {
    params,
  })
  return resp.data as ReportFeedbackListResponse
}

/** 日期区间按 createdAt 过滤 */
export interface UserFeedbackQuery {
  startDate?: string
  endDate?: string
  /** true = 仅看留了联系方式的反馈 */
  hasContact?: boolean
  /** 业务设备 ID：经绑定关系反查该设备全部绑定账号的反馈 */
  deviceId?: string
  page?: number
  pageSize?: number
}

export async function fetchUserFeedbacks(
  params: UserFeedbackQuery,
): Promise<UserFeedbackListResponse> {
  const resp = await apiClient.get('/analytics/feedback/user-feedbacks', {
    params,
  })
  return resp.data as UserFeedbackListResponse
}

// ---- 家长日报（单设备） ----

/** 单设备日报列表：deviceId 必填（业务设备 ID）；设备不存在 404 */
export async function fetchParentReports(params: {
  deviceId: string
  page?: number
  pageSize?: number
}): Promise<ParentReportListResponse> {
  const resp = await apiClient.get('/analytics/parent-reports', { params })
  return resp.data as ParentReportListResponse
}

// ---- 使用行为 ----

export async function fetchEngagementSummary(params: {
  startDate: string
  endDate: string
}): Promise<EngagementSummaryResponse> {
  const resp = await apiClient.get('/analytics/engagement/summary', { params })
  return resp.data as EngagementSummaryResponse
}

/** date 缺省 = 昨天 */
export async function fetchDurationDistribution(
  date?: string,
): Promise<DurationDistributionResponse> {
  const resp = await apiClient.get('/analytics/engagement/duration-distribution', {
    params: date ? { date } : {},
  })
  return resp.data as DurationDistributionResponse
}

export async function fetchHourlyHeatmap(params: {
  startDate: string
  endDate: string
}): Promise<HourlyHeatmapResponse> {
  const resp = await apiClient.get('/analytics/engagement/hourly-heatmap', {
    params,
  })
  return resp.data as HourlyHeatmapResponse
}

export async function fetchModeUsage(params: {
  startDate: string
  endDate: string
}): Promise<ModeUsageResponse> {
  const resp = await apiClient.get('/analytics/engagement/mode-usage', {
    params,
  })
  return resp.data as ModeUsageResponse
}

export async function fetchFeatureAdoption(
  date?: string,
): Promise<FeatureAdoptionResponse> {
  const resp = await apiClient.get('/analytics/engagement/feature-adoption', {
    params: date ? { date } : {},
  })
  return resp.data as FeatureAdoptionResponse
}

// ---- 用户画像 ----

/** startDate 与 endDate 同时提供时响应才含 newUsersInRange */
export async function fetchUsersSummary(params?: {
  startDate?: string
  endDate?: string
}): Promise<UsersSummaryResponse> {
  const resp = await apiClient.get('/analytics/users/summary', { params })
  return resp.data as UsersSummaryResponse
}

export async function fetchUsersDemographics(): Promise<UsersDemographicsResponse> {
  const resp = await apiClient.get('/analytics/users/demographics')
  return resp.data as UsersDemographicsResponse
}

// ---- 内容与质量 ----

export async function fetchContentAdventure(params: {
  startDate: string
  endDate: string
}): Promise<ContentAdventureResponse> {
  const resp = await apiClient.get('/analytics/content/adventure', { params })
  return resp.data as ContentAdventureResponse
}

export async function fetchContentLearning(params: {
  startDate: string
  endDate: string
}): Promise<ContentLearningResponse> {
  const resp = await apiClient.get('/analytics/content/learning', { params })
  return resp.data as ContentLearningResponse
}

export async function fetchContentParentReport(params: {
  startDate: string
  endDate: string
}): Promise<ContentParentReportResponse> {
  const resp = await apiClient.get('/analytics/content/parent-report', {
    params,
  })
  return resp.data as ContentParentReportResponse
}

export async function fetchQualityConversation(params: {
  startDate: string
  endDate: string
  granularity?: Granularity
}): Promise<QualityConversationResponse> {
  const resp = await apiClient.get('/analytics/quality/conversation', {
    params,
  })
  return resp.data as QualityConversationResponse
}

// ---- 消息明细 ----

/** 日期区间按 spokeAt 过滤；deviceId 为业务设备 ID */
export interface MessagesQuery {
  startDate?: string
  endDate?: string
  deviceId?: string
  role?: 'user' | 'assistant'
  status?: 'completed' | 'failed' | 'interrupted'
  mode?: string
  conversationModeKey?: string
  /** 精确匹配，用于查看同一轮问答 */
  turnId?: string
  conversationId?: string
  /** content 模糊匹配，≤ 50 字 */
  keyword?: string
  sort?: MessageSort
  page?: number
  /** 1-100，默认 20 */
  pageSize?: number
}

export async function fetchMessages(
  params: MessagesQuery,
): Promise<MessageListResponse> {
  const resp = await apiClient.get('/analytics/messages', { params })
  return resp.data as MessageListResponse
}

export async function fetchMessageDetail(
  id: string,
): Promise<MessageDetailResponse> {
  const resp = await apiClient.get(`/analytics/messages/${id}`)
  return resp.data as MessageDetailResponse
}

/** 对话模式选项源（过滤下拉用；日期区间可选，仅影响 messageCount 参考值） */
export async function fetchMessageModes(params?: {
  startDate?: string
  endDate?: string
}): Promise<MessageModesResponse> {
  const resp = await apiClient.get('/analytics/messages/modes', { params })
  return resp.data as MessageModesResponse
}

/** AI 回复打断率（推断口径，UI 须标注「疑似」） */
export async function fetchInterruptionRate(params?: {
  startDate?: string
  endDate?: string
}): Promise<InterruptionRateResponse> {
  const resp = await apiClient.get('/analytics/messages/interruption-rate', {
    params,
  })
  return resp.data as InterruptionRateResponse
}

// ---- 模型监控 ----

/** 契约见 docs/llm-monitoring-spec.md */
export async function fetchLlmSummary(params: {
  startDate?: string
  endDate?: string
}): Promise<LlmSummaryResponse> {
  const resp = await apiClient.get('/analytics/llm/summary', { params })
  return resp.data as LlmSummaryResponse
}

export async function fetchLlmTrend(params: {
  startDate?: string
  endDate?: string
  granularity?: Granularity
  /** 缺省 = 全部场景聚合 */
  scene?: string
}): Promise<LlmTrendResponse> {
  const resp = await apiClient.get('/analytics/llm/trend', { params })
  return resp.data as LlmTrendResponse
}

export async function fetchLlmRecentFailures(params: {
  page?: number
  /** 1-100，默认 20 */
  pageSize?: number
  scene?: string
}): Promise<LlmRecentFailuresResponse> {
  const resp = await apiClient.get('/analytics/llm/recent-failures', {
    params,
  })
  return resp.data as LlmRecentFailuresResponse
}

/** 单轮 LLM 调用链路（消息详情抽屉内对照用；无记录返回空 calls） */
export async function fetchLlmCallsByTurn(
  turnId: string,
): Promise<LlmTurnChainResponse> {
  const resp = await apiClient.get('/analytics/llm/by-turn', {
    params: { turnId },
  })
  return resp.data as LlmTurnChainResponse
}

/** 轮次衔接健康度（生成侧口径，UI 须标注） */
export async function fetchLlmTurnHandoff(params: {
  startDate: string
  endDate: string
  /** 空窗判定阈值 ms，缺省 0 */
  gapThresholdMs?: number
}): Promise<LlmTurnHandoffResponse> {
  const resp = await apiClient.get('/analytics/llm/turn-handoff', { params })
  return resp.data as LlmTurnHandoffResponse
}

/** 慢调用长尾（仅成功调用，latencyMs 倒序；limit ≤ 50，缺省 20） */
export async function fetchLlmSlowCalls(params: {
  startDate: string
  endDate: string
  scene?: string
  limit?: number
}): Promise<LlmSlowCallsResponse> {
  const resp = await apiClient.get('/analytics/llm/slow-calls', { params })
  return resp.data as LlmSlowCallsResponse
}

/** 费用日维度数据（GET /analytics/llm/cost-daily）；endDate 服务端钳到昨日 */
export async function fetchLlmCostDaily(params: {
  startDate: string
  endDate: string
}): Promise<LlmCostResponse> {
  const resp = await apiClient.get('/analytics/llm/cost-daily', { params })
  return resp.data as LlmCostResponse
}

// fleet 组接口为二期（依赖 device_presence_daily 落库），契约未定义，勿提前调用。
// /analytics/quality/llm-usage 一期返回 501，二期上线。

// ---- 判定质量监控（decisions） ----

/**
 * 契约见 deda-server docs/analytics-api.md「判定质量监控（decisions）」。
 * 与上面 /analytics/llm 的分工：那边是模型调用健康度，这边是模型判定可信度。
 * 全部接口日期为 YYYY-MM-DD 闭区间，服务端按 Asia/Shanghai 切日。
 */
export async function fetchSafetySummary(params: {
  startDate: string
  endDate: string
}): Promise<SafetySummaryResponse> {
  const resp = await apiClient.get('/analytics/decisions/safety-summary', {
    params,
  })
  return resp.data as SafetySummaryResponse
}

export async function fetchSafetyTrend(params: {
  startDate: string
  endDate: string
  granularity?: Granularity
}): Promise<SafetyTrendResponse> {
  const resp = await apiClient.get('/analytics/decisions/safety-trend', {
    params,
  })
  return resp.data as SafetyTrendResponse
}

export async function fetchIntentSummary(params: {
  startDate: string
  endDate: string
}): Promise<IntentSummaryResponse> {
  const resp = await apiClient.get('/analytics/decisions/intent-summary', {
    params,
  })
  return resp.data as IntentSummaryResponse
}

export async function fetchIntentTrend(params: {
  startDate: string
  endDate: string
  granularity?: Granularity
}): Promise<IntentTrendResponse> {
  const resp = await apiClient.get('/analytics/decisions/intent-trend', {
    params,
  })
  return resp.data as IntentTrendResponse
}

/**
 * 人工复核队列。服务端恒定附加 asrText IS NOT NULL（调用方无法绕过）：
 * 只有「拦了」或「判成非 safe 类别」的轮次才留原文，正常轮次不积累儿童语料。
 * category 走白名单，拼错 400 而非静默返回空；deviceId 是内部 UUID。
 */
export interface ReviewQueueQuery {
  startDate: string
  endDate: string
  /** 缺省 = 全部类别；取值 sexual/self_harm/violence/emotional_harm/safe */
  category?: string
  /** 内部设备 UUID，非业务 deviceId */
  deviceId?: string
  page?: number
  /** 1-100，默认 20 */
  pageSize?: number
  sort?: ReviewQueueSort
}

export async function fetchReviewQueue(
  params: ReviewQueueQuery,
): Promise<ReviewQueueResponse> {
  const resp = await apiClient.get('/analytics/decisions/review-queue', {
    params,
  })
  return resp.data as ReviewQueueResponse
}

// ---- 记忆档案 ----

export async function fetchMemoriesOverview(): Promise<MemoriesOverviewResponse> {
  const resp = await apiClient.get('/analytics/memories/overview')
  return resp.data as MemoriesOverviewResponse
}

export async function fetchMemoryDevices(params: {
  keyword?: string
  page?: number
  pageSize?: number
}): Promise<MemoryDevicesResponse> {
  const resp = await apiClient.get('/analytics/memories/devices', { params })
  return resp.data as MemoryDevicesResponse
}

export async function fetchCurrentMemories(
  deviceId: string,
): Promise<CurrentMemoriesResponse> {
  const resp = await apiClient.get('/analytics/memories/current', {
    params: { deviceId },
  })
  return resp.data as CurrentMemoriesResponse
}

export async function fetchMemoryHistory(
  deviceId: string,
  key: string,
): Promise<MemoryHistoryResponse> {
  const resp = await apiClient.get('/analytics/memories/history', {
    params: { deviceId, key },
  })
  return resp.data as MemoryHistoryResponse
}
