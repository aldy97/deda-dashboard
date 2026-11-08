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
  ModeUsageResponse,
  OverviewResponse,
  OverviewTrendResponse,
  QualityConversationResponse,
  ReportFeedbackListResponse,
  RetentionCohortsResponse,
  RetentionCurveResponse,
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

// fleet 组接口为二期（依赖 device_presence_daily 落库），契约未定义，勿提前调用。
// /analytics/quality/llm-usage 一期返回 501，二期上线。
