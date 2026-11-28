import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { PAGE_QUERY_KEYS, usePageRefresh } from './refresh'

/**
 * 页面级全局刷新的契约：refresh 只命中本页面的 queryKey 前缀，且带 type:all
 * （把切走的 tab 留下的 inactive 缓存也一并刷掉，保证切回来也是新数据）。
 * queryKey 约定 ['analytics', '<entity>', ...]，第二元素精确匹配，不用 startsWith 以免误伤。
 */
function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

// 与 queries.ts 里真实 queryKey 的「页面归属」逐一核对，防止漏配或误配。
describe('PAGE_QUERY_KEYS', () => {
  it('fleet 覆盖舰队页全部 query 前缀', () => {
    expect(PAGE_QUERY_KEYS.fleet).toEqual([
      'fleetSummary',
      'fleetPresenceTrend',
      'fleetFirmwareDistribution',
      'fleetChurnRisk',
      'fleetDevices',
      'fleetDeviceDetail',
    ])
  })

  it('memories 覆盖记忆档案列表页 query 前缀', () => {
    expect(PAGE_QUERY_KEYS.memories).toEqual([
      'memoriesOverview',
      'memoryDevices',
    ])
  })

  it('llm 覆盖四个 tab 全部 query 前缀（不含 Messages 页的 llmCallsByTurn）', () => {
    expect(PAGE_QUERY_KEYS.llm).toEqual([
      'llmSummary',
      'llmTrend',
      'llmRecentFailures',
      'llmSlowCalls',
      'llmCost',
      'safetySummary',
      'safetyTrend',
      'reviewQueue',
      'intentSummary',
      'intentTrend',
    ])
  })
})

describe('usePageRefresh', () => {
  function refreshAndGrabPredicate(page: keyof typeof PAGE_QUERY_KEYS) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const spy = vi.spyOn(client, 'refetchQueries')
    const { result } = renderHook(() => usePageRefresh(page), {
      wrapper: createWrapper(client),
    })
    result.current.refresh()

    expect(spy).toHaveBeenCalledTimes(1)
    const filters = spy.mock.calls[0][0]!
    const predicate = filters.predicate!
    expect(filters.type).toBe('all')
    return predicate
  }

  it('fleet 页的 predicate 命中 fleet 前缀、不命中其它页', () => {
    const predicate = refreshAndGrabPredicate('fleet')

    expect(predicate({ queryKey: ['analytics', 'fleetSummary', 'd'] } as never)).toBe(true)
    expect(predicate({ queryKey: ['analytics', 'fleetDevices', {}] } as never)).toBe(true)
    expect(predicate({ queryKey: ['analytics', 'memoriesOverview'] } as never)).toBe(false)
    expect(predicate({ queryKey: ['analytics', 'llmSummary', {}] } as never)).toBe(false)
    // 非 analytics 前缀一律不命中
    expect(predicate({ queryKey: ['meta'] } as never)).toBe(false)
  })

  it('llm 页的 predicate 同时命中 llm / safety / intent 前缀', () => {
    const predicate = refreshAndGrabPredicate('llm')

    expect(predicate({ queryKey: ['analytics', 'llmSummary', {}] } as never)).toBe(true)
    expect(predicate({ queryKey: ['analytics', 'safetyTrend', {}] } as never)).toBe(true)
    expect(predicate({ queryKey: ['analytics', 'intentSummary', {}] } as never)).toBe(true)
    expect(predicate({ queryKey: ['analytics', 'reviewQueue', {}] } as never)).toBe(true)
    // Messages 页的 turn chain 不被 Llm 页误刷
    expect(predicate({ queryKey: ['analytics', 'llmCallsByTurn', 't'] } as never)).toBe(false)
    expect(predicate({ queryKey: ['analytics', 'fleetSummary', 'd'] } as never)).toBe(false)
  })
})

describe('usePageRefresh · users', () => {
  it('users 页 predicate 只命中家长/设备画像与手机品牌', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const spy = vi.spyOn(client, 'refetchQueries')
    const { result } = renderHook(() => usePageRefresh('users'), {
      wrapper: createWrapper(client),
    })
    result.current.refresh()

    const predicate = spy.mock.calls[0][0]!.predicate!
    expect(predicate({ queryKey: ['analytics', 'usersSummary', {}] } as never)).toBe(true)
    expect(
      predicate({ queryKey: ['analytics', 'parentDemographics'] } as never),
    ).toBe(true)
    expect(predicate({ queryKey: ['analytics', 'usersDemographics'] } as never)).toBe(
      true,
    )
    expect(predicate({ queryKey: ['analytics', 'phoneBrands'] } as never)).toBe(true)
    expect(predicate({ queryKey: ['analytics', 'fleetSummary'] } as never)).toBe(false)
  })
})

describe('usePageRefresh · content / feedback', () => {
  function predicateFor(page: keyof typeof PAGE_QUERY_KEYS) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const spy = vi.spyOn(client, 'refetchQueries')
    const { result } = renderHook(() => usePageRefresh(page), {
      wrapper: createWrapper(client),
    })
    result.current.refresh()
    return spy.mock.calls[0][0]!.predicate!
  }

  it('content 页命中四个内容查询，不误刷反馈查询', () => {
    const predicate = predicateFor('content')

    expect(predicate({ queryKey: ['analytics', 'contentAdventure', {}] } as never)).toBe(true)
    expect(
      predicate({ queryKey: ['analytics', 'contentAdventureChoices', {}] } as never),
    ).toBe(true)
    expect(predicate({ queryKey: ['analytics', 'contentLearning', {}] } as never)).toBe(
      true,
    )
    expect(predicate({ queryKey: ['analytics', 'qualityConversation', {}] } as never)).toBe(
      true,
    )
    expect(predicate({ queryKey: ['analytics', 'contentParentReport', {}] } as never)).toBe(
      false,
    )
  })

  it('feedback 页命中三个反馈查询，不误刷内容查询', () => {
    const predicate = predicateFor('feedback')

    expect(predicate({ queryKey: ['analytics', 'reportFeedbacks', {}] } as never)).toBe(
      true,
    )
    expect(predicate({ queryKey: ['analytics', 'userFeedbacks', {}] } as never)).toBe(
      true,
    )
    expect(predicate({ queryKey: ['analytics', 'contentParentReport', {}] } as never)).toBe(
      true,
    )
    expect(predicate({ queryKey: ['analytics', 'contentAdventure', {}] } as never)).toBe(
      false,
    )
  })
})

describe('usePageRefresh · parent', () => {
  it('parent 页只命中家长档案详情，不误刷用户画像聚合', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const spy = vi.spyOn(client, 'refetchQueries')
    const { result } = renderHook(() => usePageRefresh('parent'), {
      wrapper: createWrapper(client),
    })
    result.current.refresh()

    const predicate = spy.mock.calls[0][0]!.predicate!
    expect(
      predicate({ queryKey: ['analytics', 'parentDetail', 'u1'] } as never),
    ).toBe(true)
    // 白名单备注在家长档案页也要能被「刷新」带新
    expect(
      predicate({ queryKey: ['analytics', 'testDevices', 'all'] } as never),
    ).toBe(true)
    expect(predicate({ queryKey: ['analytics', 'usersSummary', {}] } as never)).toBe(
      false,
    )
    expect(
      predicate({ queryKey: ['analytics', 'parentDemographics'] } as never),
    ).toBe(false)
  })
})
