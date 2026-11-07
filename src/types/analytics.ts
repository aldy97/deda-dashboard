/**
 * 与 deda-server `docs/analytics-api.md` 逐项对齐的契约类型。
 * 全局约定：响应信封 { code, message, data }，code=0 成功；camelCase；ISO 8601；
 * 日期参数 YYYY-MM-DD、闭区间、Asia/Shanghai；所有接口均为 GET。
 * 口径：时长类字段为估算（每条 user 消息 × 0.5 分钟），UI 固定标注「估算口径」。
 */

// ---- 鉴权 ----
export interface AdminLoginResponse {
  token: string
  adminInfo: {
    username: string
    displayName: string
  }
}

export interface AdminProfile {
  username: string
  displayName: string
}

// ---- 总览 ----
export interface OverviewResponse {
  date: string
  totals: {
    devicesRegistered: number
    devicesActivated: number
    usersRegistered: number
    /** 分母：无出货数据时退化为已入库设备数 */
    activationRate: number | null
  }
  today: {
    dau: number
    dauDeltaPct: number | null
    /** estimated：每条 user 消息 × 0.5 分钟 */
    avgDurationSecondsPerActiveDevice: number
    avgTurnsPerActiveDevice: number
    /** 一期恒 null（二期 device_presence_daily 落库后接入） */
    devicesPoweredOn: number | null
    powerOnRate: number | null
    onlineNow: number | null
  }
  retention: {
    d1: number | null
    d7: number | null
    d30: number | null
  }
  funnel: {
    /** 一期恒 null */
    shipped: number | null
    activated: number
    firstConversation: number
    active7d: number
  }
}

export type Granularity = 'day' | 'week' | 'month'

/** metrics 过滤后未选字段不出现，故全部可选 */
export interface OverviewTrendPoint {
  date: string
  dau?: number
  avgDurationSeconds?: number
  devicesPoweredOn?: number | null
  newActivatedDevices?: number
  newUsers?: number
}

export interface OverviewTrendResponse {
  startDate: string
  endDate: string
  granularity: Granularity
  series: OverviewTrendPoint[]
}

// ---- 留存与激活 ----
export type CohortBasis = 'activation' | 'firstUse'

export interface RetentionCohortsResponse {
  basis: CohortBasis
  granularity: 'day' | 'week'
  cohorts: Array<{
    /** 如 2026-W41（ISO 周，周一起点）或 YYYY-MM-DD */
    cohort: string
    size: number
    retention: Array<{ n: number; rate: number }>
  }>
}

export interface RetentionCurveResponse {
  points: Array<{
    day: 1 | 3 | 7 | 14 | 30 | 60 | 90
    /** 无激活满 N 天的设备时为 null */
    rate: number | null
  }>
  cohortSize: number
}

export interface ActivationFunnelResponse {
  steps: Array<{
    key: 'shipped' | 'activated' | 'first_conversation' | 'active_d7' | 'active_d30'
    label: string
    /** shipped 一期恒 null */
    value: number | null
  }>
  conversionRates: Array<{ from: string; to: string; rate: number | null }>
}

// ---- 用户反馈 ----
export interface FeedbackUserBrief {
  nickname: string | null
  phone: string | null
}

export interface ReportFeedbackItem {
  id: string
  /** 报告日期 YYYY-MM-DD */
  reportDate: string
  isUseful: boolean
  /** = updatedAt：用户可改票，此为最新状态时间（ISO 8601） */
  feedbackAt: string
  user: FeedbackUserBrief
  device: {
    /** 业务设备 ID（非数据库 UUID） */
    deviceId: string
    deviceCode: string | null
    characterKey: string
  }
}

export interface ReportFeedbackListResponse {
  total: number
  page: number
  pageSize: number
  /** 区间内整体有用率统计，不受 isUseful 过滤影响；区间无反馈时 usefulRate 为 0 */
  summary: {
    usefulCount: number
    notUsefulCount: number
    usefulRate: number
  }
  items: ReportFeedbackItem[]
}

export interface UserFeedbackItem {
  id: string
  /** C 端限制 200 字 */
  content: string
  /** 用户主动留的联系手机号，可空 */
  contact: string | null
  createdAt: string
  /** 用户已注销时为 null（反馈保留） */
  user: FeedbackUserBrief | null
}

export interface UserFeedbackListResponse {
  total: number
  page: number
  pageSize: number
  items: UserFeedbackItem[]
}

// ---- 使用行为 ----
export interface EngagementSummaryResponse {
  activeDevices: number
  /** estimated */
  avgDurationSecondsPerDevice: number
  durationP50Seconds: number
  durationP90Seconds: number
  avgTurnsPerDevice: number
  turnsP50: number
  avgActiveDaysPerDevice: number
  totalTurns: number
}

export interface DurationDistributionResponse {
  date: string
  buckets: Array<{
    range: '0-5min' | '5-15min' | '15-30min' | '30-60min' | '60min+'
    devices: number
  }>
}

/** 7 行（周一=0）× 24 列活跃设备数 */
export interface HourlyHeatmapResponse {
  grid: number[][]
  maxValue: number
}

export interface ModeUsageResponse {
  series: Array<{
    date: string
    modes: Array<{
      mode: string
      conversationModeKey: string | null
      turns: number
      devices: number
    }>
  }>
}

export interface FeatureAdoptionItem {
  key: 'sleep_mode' | 'adventure' | 'habit_plan' | 'english'
  label: string
  /** 分母 = 已激活设备 */
  penetrationRate: number | null
  enabledDevices?: number
  activeDevices?: number
  completionRate?: number | null
  avgCompletionRate?: number | null
}

export interface FeatureAdoptionResponse {
  date: string
  features: FeatureAdoptionItem[]
}

// ---- 用户画像 ----
export interface UsersSummaryResponse {
  totalUsers: number
  /** startDate 与 endDate 同时提供才返回，否则 null */
  newUsersInRange: number | null
  usersWithBoundDevice: number
  avgDevicesPerUser: number
  multiChildFamilies: number
}

export interface UsersDemographicsResponse {
  ageDistribution: Array<{
    range: '0-3' | '3-6' | '6-9' | '9+' | 'unknown'
    devices: number
  }>
  genderSplit: { male: number; female: number; unset: number }
  characterKeySplit: Array<{ characterKey: string; devices: number }>
  bindingsPerDevice: Array<{ count: 1 | 2 | '3+'; devices: number }>
}

// ---- 内容与质量 ----
export interface ContentAdventureResponse {
  startedDevices: number
  completedEpisodes: number
  completionRate: number | null
  avgStarsPerEpisode: number | null
  topEpisodes: Array<{
    episodeId: string
    title: string
    completions: number
    avgStars: number | null
  }>
}

export interface ContentLearningResponse {
  totalNewWords: number
  avgNewWordsPerActiveDevice: number
  speakCountTotal: number
  habitPlansActive: number
  habitCompletionRate: number | null
}

export interface ContentParentReportResponse {
  generated: number
  failed: number
  successRate: number | null
  feedbackTotal: number
  usefulRate: number | null
}

export interface QualityConversationResponse {
  granularity: 'day' | 'week' | 'month'
  series: Array<{
    date: string
    /** role=user 消息数 */
    totalTurns: number
    /** assistant status=failed */
    failedTurns: number
    failureRate: number | null
    /** rawPayload 含 safetyCategory */
    safetyBlockedTurns: number
    safetyRate: number | null
  }>
}
