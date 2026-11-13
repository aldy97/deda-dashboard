import { useQuery } from '@tanstack/react-query'
import { apiClient } from './client'
import type { AnalyticsMeta } from '../types/analytics'

/**
 * GET /analytics/meta：环境标识 + prompt 写策略。
 *
 * 单独成文件、不并进 analytics.ts：它回答的是「我现在连的是哪个环境、
 * 这个环境允许写吗」，服务左上角环境标签与发布闸口，不是某张报表的数据源。
 *
 * 契约见 deda-server docs/analytics-api.md →「Prompt 管理」。
 */
export async function fetchAnalyticsMeta(): Promise<AnalyticsMeta> {
  const resp = await apiClient.get('/analytics/meta')
  return resp.data as AnalyticsMeta
}

/** 环境标签与发布闸口共用同一个 key，保证整站读到同一份结论 */
export const META_QUERY_KEY = ['analytics', 'meta'] as const

/**
 * staleTime 设为 Infinity：nodeEnv 与写开关在一次会话内不会变，
 * 而「环境标签说测试、发布按钮按生产校验」这种自相矛盾比数据陈旧危险得多。
 * 登出走 window.location 整页跳转，缓存自然重置，不需要手动失效。
 */
export function useAnalyticsMeta() {
  return useQuery({
    queryKey: META_QUERY_KEY,
    queryFn: fetchAnalyticsMeta,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
}
