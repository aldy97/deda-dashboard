import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'
import LlmMonitor from './index'
import {
  useIntentSummary,
  useIntentTrend,
  useLlmCost,
  useLlmRecentFailures,
  useLlmSlowCalls,
  useLlmSummary,
  useLlmTrend,
  useReviewQueue,
  useSafetySummary,
  useSafetyTrend,
} from '../../api/queries'
import type {
  IntentSummaryResponse,
  SafetySummaryResponse,
} from '../../types/analytics'

/**
 * 集成测试：mock 掉 API 层（queries 钩子），渲染真实页面与四个真实 tab，
 * 验证「进页面只挂当前 tab、点 tab 换内容并写 URL、?tab= 刷新可还原」。
 */
vi.mock('../../api/queries', () => ({
  useLlmSummary: vi.fn(),
  useLlmTrend: vi.fn(),
  useLlmRecentFailures: vi.fn(),
  useLlmSlowCalls: vi.fn(),
  useLlmCost: vi.fn(),
  useSafetySummary: vi.fn(),
  useSafetyTrend: vi.fn(),
  useReviewQueue: vi.fn(),
  useIntentSummary: vi.fn(),
  useIntentTrend: vi.fn(),
}))

const ok = (data: unknown) => ({ data, isLoading: false, error: null, refetch: vi.fn() })

function safetySummary(): SafetySummaryResponse {
  return {
    total: 500,
    blockedCount: 5,
    blockRate: 0.01,
    byCategory: [],
    byLayer: [],
    bySource: [],
    failOpenCount: 0,
    invalidLabelCount: 0,
    notEvaluatedCount: 40,
    emotionalHarmCount: 2,
    reviewableCount: 5,
  }
}

function intentSummary(): IntentSummaryResponse {
  return {
    total: 500,
    byIntent: [],
    bySource: [
      { source: 'model', count: 400 },
      { source: 'no_device', count: 100 },
    ],
    modelInvokedCount: 400,
    modelInvokedRate: 0.8,
    fallbackCount: 0,
    fallbackRate: 0,
    notRoutedCount: 0,
    adventureTakeoverCount: 0,
    matrix: [],
  }
}

function mockApi() {
  ;(useLlmSummary as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
    ok({ scenes: [] }),
  )
  ;(useLlmTrend as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
    ok({ granularity: 'day', series: [] }),
  )
  ;(useLlmRecentFailures as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
    ok({ total: 0, page: 1, pageSize: 20, items: [] }),
  )
  ;(useLlmSlowCalls as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
    ok({ items: [] }),
  )
  ;(useLlmCost as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
    ok(null),
  )
  ;(useSafetySummary as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
    ok(safetySummary()),
  )
  ;(useSafetyTrend as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
    ok({ granularity: 'day', series: [] }),
  )
  ;(useReviewQueue as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
    ok({ total: 0, page: 1, pageSize: 20, items: [] }),
  )
  ;(useIntentSummary as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
    ok(intentSummary()),
  )
  ;(useIntentTrend as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
    ok({ granularity: 'day', series: [] }),
  )
}

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location-search">{location.search}</div>
}

function renderPage(entry = '/llm') {
  mockApi()
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <LocationProbe />
        <LlmMonitor />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const PERF_TEXT = '分场景汇总'
const COST_TEXT = /账单延迟约 24h 出账/
const SAFETY_TEXT = '安全判定概览'
const INTENT_TEXT = '意图判定概览'

describe('模型监控集成：四个 tab 的挂载与卸载', () => {
  it('四个 tab 都渲染，默认落在性能监控', () => {
    renderPage()

    expect(screen.getByRole('tab', { name: '性能监控' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '价格监控' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '安全监控' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '意图监控' })).toBeInTheDocument()

    expect(screen.getByText(PERF_TEXT)).toBeInTheDocument()
    // 其余 tab 的内容不挂载（避免进页面并发十几个请求）
    expect(screen.queryByText(COST_TEXT)).not.toBeInTheDocument()
    expect(screen.queryByText(SAFETY_TEXT)).not.toBeInTheDocument()
    expect(screen.queryByText(INTENT_TEXT)).not.toBeInTheDocument()
  })

  it('点价格监控：性能内容卸载、价格内容挂载，URL 写入 ?tab=cost', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('tab', { name: '价格监控' }))

    expect(screen.queryByText(PERF_TEXT)).not.toBeInTheDocument()
    expect(screen.getByText(COST_TEXT)).toBeInTheDocument()
    expect(screen.getByTestId('location-search').textContent).toBe('?tab=cost')
  })

  it('点安全监控：安全内容挂载、价格内容卸载', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('tab', { name: '安全监控' }))

    expect(screen.getByText(SAFETY_TEXT)).toBeInTheDocument()
    expect(screen.queryByText(COST_TEXT)).not.toBeInTheDocument()
    expect(screen.queryByText(PERF_TEXT)).not.toBeInTheDocument()
    expect(screen.getByTestId('location-search').textContent).toBe(
      '?tab=safety',
    )
  })

  it('点意图监控：意图内容挂载、安全内容卸载', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('tab', { name: '安全监控' }))
    await user.click(screen.getByRole('tab', { name: '意图监控' }))

    expect(screen.getByText(INTENT_TEXT)).toBeInTheDocument()
    expect(screen.queryByText(SAFETY_TEXT)).not.toBeInTheDocument()
    expect(screen.getByTestId('location-search').textContent).toBe('?tab=intent')
  })

  it('切回性能监控：内容重新挂载', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('tab', { name: '意图监控' }))
    expect(screen.queryByText(PERF_TEXT)).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: '性能监控' }))

    expect(screen.getByText(PERF_TEXT)).toBeInTheDocument()
    expect(screen.queryByText(INTENT_TEXT)).not.toBeInTheDocument()
    expect(screen.getByTestId('location-search').textContent).toBe('?tab=perf')
  })
})

describe('模型监控集成：?tab= 刷新还原', () => {
  it.each([
    ['perf', PERF_TEXT],
    ['safety', SAFETY_TEXT],
    ['intent', INTENT_TEXT],
  ])('?tab=%s 直接还原对应 tab 内容', (tab, expected) => {
    renderPage(`/llm?tab=${tab}`)

    expect(screen.getByText(expected)).toBeInTheDocument()
  })

  it('?tab=cost 还原价格监控，且不挂性能内容', () => {
    renderPage('/llm?tab=cost')

    expect(screen.getByText(COST_TEXT)).toBeInTheDocument()
    expect(screen.queryByText(PERF_TEXT)).not.toBeInTheDocument()
  })

  it('?tab 非法时回退性能监控，不渲染空白页', () => {
    renderPage('/llm?tab=nonsense')

    expect(screen.getByText(PERF_TEXT)).toBeInTheDocument()
  })
})
