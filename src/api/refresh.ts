import { useCallback } from 'react'
import { useIsFetching, useQueryClient } from '@tanstack/react-query'

/**
 * 每个页面的 queryKey 第二元素集合，供「页面级全局刷新」使用。
 *
 * queryKey 约定是 ['analytics', '<entity>', ...]（见 queries.ts），
 * 这里按「精确第二元素」匹配而不是 startsWith——避免把 llmCallsByTurn
 * （属于 Messages 页的 turn chain）误刷进 Llm 页，或把 memoryHistory /
 * currentMemories（属于记忆档案的详情页）误刷进列表页。
 */
export const PAGE_QUERY_KEYS = {
  fleet: [
    'fleetSummary',
    'fleetPresenceTrend',
    'fleetFirmwareDistribution',
    'fleetChurnRisk',
    'fleetDevices',
    'fleetDeviceDetail',
  ],
  memories: ['memoriesOverview', 'memoryDevices'],
  llm: [
    'llmSummary',
    'llmTrend',
    'llmRecentFailures',
    'llmSlowCalls',
    'llmTurnHandoff',
    'llmCost',
    'safetySummary',
    'safetyTrend',
    'reviewQueue',
    'intentSummary',
    'intentTrend',
  ],
} as const

export type PageQueryKey = keyof typeof PAGE_QUERY_KEYS

function matchesPage(queryKey: unknown, page: PageQueryKey): boolean {
  return (
    Array.isArray(queryKey) &&
    queryKey[0] === 'analytics' &&
    (PAGE_QUERY_KEYS[page] as readonly string[]).includes(
      queryKey[1] as string,
    )
  )
}

/**
 * 页面级全局刷新：`refresh` 按本页面的 queryKey 前缀刷新整组数据，
 * `isRefreshing` 反映是否仍有本页面的请求在飞（供 RefreshButton 的 loading）。
 *
 * 用 type:'all' 而非默认的 active：Llm 这类多 tab 页面，切走 tab 后其
 * query 变成 inactive 但仍留在 cache 里，active 口径会漏刷，切回来看到旧数据。
 */
export function usePageRefresh(page: PageQueryKey) {
  const queryClient = useQueryClient()
  const refresh = useCallback(() => {
    void queryClient.refetchQueries({
      predicate: (query) => matchesPage(query.queryKey, page),
      type: 'all',
    })
  }, [queryClient, page])

  const isRefreshing =
    useIsFetching({
      predicate: (query) => matchesPage(query.queryKey, page),
    }) > 0

  return { refresh, isRefreshing }
}
