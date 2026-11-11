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

/** 日报内容（ParentReport 四个观察字段 + 建议 + 生成状态） */
export interface ParentReportContent {
  reportDate: string
  /** pending / generating / completed / failed */
  generationStatus: string
  expressionObservation: string | null
  emotionObservation: string | null
  thinkingObservation: string | null
  suggestion: string | null
  /** ISO 8601，未完成生成为 null */
  generatedAt: string | null
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
  /** 该反馈对应的日报内容（同设备同 reportDate） */
  report: ParentReportContent
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

// ---- 家长日报（单设备，用户详情页用） ----
export interface ParentReportItem extends ParentReportContent {
  /** 生成所用模型名，未生成为 null */
  generatorModel: string | null
}

export interface ParentReportListResponse {
  total: number
  page: number
  pageSize: number
  device: {
    deviceId: string
    deviceCode: string | null
    characterKey: string
  }
  items: ParentReportItem[]
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

// ---- 消息明细 ----
export interface MessageDeviceBrief {
  /** 业务设备 ID（非数据库 UUID） */
  deviceId: string
  deviceCode: string | null
  characterKey: string
}

export interface MessageListItem {
  id: string
  /** 同一轮问答共享 ID（user/assistant 两条） */
  turnId: string
  /** 厂商侧对话唯一 ID，可空 */
  conversationId: string | null
  role: string
  content: string
  /** assistant: completed / failed / interrupted（被打断，服务端推断口径） */
  status: string
  mode: string | null
  conversationModeKey: string | null
  cefrLevel: string | null
  spokeAt: string
  createdAt: string
  device: MessageDeviceBrief
}

/** 对话模式选项源（GET /analytics/messages/modes） */
export interface MessageModesResponse {
  categories: Array<{
    key: string
    name: string
    /** 区间内该顶层模式的消息数（仅参考，0 也返回） */
    messageCount: number
    modes: Array<{ key: string; name: string; messageCount: number }>
  }>
}

/** AI 回复打断率（GET /analytics/messages/interruption-rate；推断口径，非设备真实事件） */
export interface InterruptionRateResponse {
  /** 分母：区间内 assistant 消息总数 */
  assistantTotal: number
  interrupted: number
  /** 分母 0 时 null */
  interruptionRate: number | null
  byMode: Array<{
    mode: string
    assistantTotal: number
    interrupted: number
    interruptionRate: number | null
  }>
}

export interface MessageListResponse {
  total: number
  page: number
  pageSize: number
  /** 列表项不含 rawPayload（体积大，走详情接口） */
  items: MessageListItem[]
}

/** 整行详情，rawPayload 原样返回 */
export interface MessageDetailResponse extends MessageListItem {
  rawPayload: unknown
}

/**
 * assistant 消息的 rawPayload 结构化形态（filler/answer 边界，后端 11-09 起写入）；
 * 更早的历史行没有该结构，UI 需降级展示 content 全文
 */
export interface AssistantRawPayload {
  filler?: string | null
  answer?: string | null
}

export function isAssistantRawPayload(
  raw: unknown,
): raw is AssistantRawPayload {
  return (
    typeof raw === 'object' &&
    raw !== null &&
    ('filler' in raw || 'answer' in raw)
  )
}

export type MessageSort = 'spokeAt_desc' | 'spokeAt_asc'

// ---- 模型监控 ----
/** 契约见 docs/llm-monitoring-spec.md */
export interface LlmSceneSummary {
  scene: string
  /** small / main */
  tier: string
  calls: number
  /** 分母 0 时 null */
  successRate: number | null
  p50LatencyMs: number | null
  p90LatencyMs: number | null
  /** 首包时间：仅流式场景（chat_main / filler）有值，否则 null */
  p50FirstTokenMs: number | null
  p90FirstTokenMs: number | null
  totalTokens: number
  failureBreakdown: Array<{ reason: string; count: number }>
}

export interface LlmSummaryResponse {
  scenes: LlmSceneSummary[]
}

export interface LlmTrendResponse {
  granularity: 'day' | 'week' | 'month'
  series: Array<{
    date: string
    calls: number
    successRate: number | null
    p50LatencyMs: number | null
    /** 首包均值，仅流式场景有值 */
    avgFirstTokenMs: number | null
    /** 首包分位数（percentile_cont），仅流式场景有样本 */
    p50FirstTokenMs: number | null
    p90FirstTokenMs: number | null
    totalTokens: number
  }>
}

/** 轮次衔接健康度（GET /analytics/llm/turn-handoff，生成侧口径） */
export interface LlmTurnHandoffResponse {
  /** 区间内有 chat_main 的轮数 */
  turnsWithChat: number
  /** filler + chat_main 双样本齐全的轮数 */
  turnsWithBoth: number
  /** 有 chat_main 但无 filler（静默降级缺失）的轮数 */
  turnsMissingFiller: number
  /** chat_main.firstTokenMs 为 null 的轮数 */
  turnsUnknown: number
  gapThresholdMs: number
  /** gapMs = chat_main 首包时刻 − filler 生成完成时刻；≤0 为覆盖良好 */
  gapP50Ms: number | null
  gapP90Ms: number | null
  /** 空窗轮数 / 双样本轮数；无样本时 null */
  gapRate: number | null
  /** gapMs 倒序前 10 */
  topGaps: Array<{ turnId: string; gapMs: number; createdAt: string }>
}

/** 慢调用长尾（GET /analytics/llm/slow-calls，仅成功调用） */
export interface LlmSlowCallItem {
  id: string
  scene: string
  tier: string
  model: string
  latencyMs: number | null
  firstTokenMs: number | null
  totalTokens: number | null
  turnId: string | null
  deviceId: string | null
  createdAt: string
}

export interface LlmSlowCallsResponse {
  items: LlmSlowCallItem[]
}

export interface LlmFailureItem {
  id: string
  scene: string
  tier: string
  model: string
  /** timeout / rate_limit / parse_error / upstream_error / empty_response */
  failureReason: string | null
  /** 失败细节紧凑串（如 "ECONNRESET: socket hang up"）；存量数据为 null */
  failureDetail?: string | null
  latencyMs: number | null
  /** 对话轮次 ID；后台任务/存量数据为 null */
  turnId: string | null
  deviceId: string | null
  createdAt: string
}

export interface LlmRecentFailuresResponse {
  total: number
  page: number
  pageSize: number
  items: LlmFailureItem[]
}

/** 单轮调用链路上的一次 LLM 调用（GET /analytics/llm/by-turn） */
export interface LlmTurnCall {
  id: string
  scene: string
  model: string
  /** small / main */
  tier: string
  success: boolean
  failureReason: string | null
  /** 失败细节紧凑串（如 "ECONNRESET: socket hang up"）；存量数据为 null */
  failureDetail?: string | null
  latencyMs: number | null
  /** 首包时间：仅流式场景有值 */
  firstTokenMs: number | null
  promptTokens: number | null
  completionTokens: number | null
  totalTokens: number | null
  createdAt: string
}

export interface LlmTurnChainResponse {
  turnId: string
  /** createdAt 升序（后端固定） */
  calls: LlmTurnCall[]
}

// ---- 记忆档案 ----
/** 全局汇总（GET /analytics/memories/overview） */
export interface MemoriesOverviewResponse {
  /** 分母：至少有 1 条消息的设备数 */
  deviceTotal: number
  /** 至少 1 条 active 记忆的设备数 */
  deviceWithMemories: number
  /** 0-1 小数 */
  deviceCoverage: number
  totalActiveMemories: number
  /** 全部版本行数（含 superseded/retracted） */
  totalVersions: number
  /** 固定 5 槽位，按 key 字典序 */
  slotCoverage: Array<{ key: string; deviceCount: number; coverage: number }>
}

export interface MemoryDeviceItem {
  deviceId: string
  deviceCode: string | null
  activeCount: number
  totalVersions: number
  lastChangeAt: string
}

export interface MemoryDevicesResponse {
  total: number
  page: number
  pageSize: number
  items: MemoryDeviceItem[]
}

export interface CurrentMemoryItem {
  key: string
  valueText: string
  version: number
  confidence: number
  injectionCount: number
  lastInjectedAt: string | null
  lastConfirmedAt: string
  validFrom: string
}

export interface CurrentMemoriesResponse {
  deviceId: string
  memories: CurrentMemoryItem[]
}

export type MemoryChangeType = 'initial' | 'supersede' | 'retract'
export type MemoryStatus = 'active' | 'superseded' | 'retracted'

export interface MemoryVersionItem {
  id: string
  version: number
  changeType: MemoryChangeType
  status: MemoryStatus
  /** 撤回墓碑为 null */
  valueText: string | null
  confidence: number
  sourceTurnId: string
  validFrom: string
  validTo: string | null
  createdAt: string
}

export interface MemoryHistoryResponse {
  deviceId: string
  key: string
  /** version 升序 */
  versions: MemoryVersionItem[]
}
