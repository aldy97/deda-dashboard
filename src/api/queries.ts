import { useQuery } from '@tanstack/react-query'
import {
  fetchActivationFunnel,
  fetchContentAdventure,
  fetchContentLearning,
  fetchContentParentReport,
  fetchCurrentMemories,
  fetchDurationDistribution,
  fetchEngagementSummary,
  fetchFeatureAdoption,
  fetchHourlyHeatmap,
  fetchInterruptionRate,
  fetchLlmCallsByTurn,
  fetchLlmRecentFailures,
  fetchLlmSlowCalls,
  fetchLlmCostDaily,
  fetchLlmSummary,
  fetchLlmTrend,
  fetchLlmTurnHandoff,
  fetchMemoriesOverview,
  fetchMemoryDevices,
  fetchMemoryHistory,
  fetchMessageDetail,
  fetchMessageModes,
  fetchMessages,
  fetchModeUsage,
  fetchOverview,
  fetchOverviewTrend,
  fetchQualityConversation,
  fetchReportFeedbacks,
  fetchParentReports,
  fetchRetentionCohorts,
  fetchRetentionCurve,
  fetchUserFeedbacks,
  fetchUsersDemographics,
  fetchUsersSummary,
} from './analytics'
import type {
  MessagesQuery,
  OverviewTrendParams,
  ReportFeedbackQuery,
  UserFeedbackQuery,
} from './analytics'
import type { CohortBasis, Granularity } from '../types/analytics'

/**
 * TanStack Query hooks 层：页面只与这里交互，不直接调 analytics.ts。
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

export function useLlmTurnHandoff(params: {
  startDate: string
  endDate: string
  gapThresholdMs?: number
}) {
  return useQuery({
    queryKey: ['analytics', 'llmTurnHandoff', params],
    queryFn: () => fetchLlmTurnHandoff(params),
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
