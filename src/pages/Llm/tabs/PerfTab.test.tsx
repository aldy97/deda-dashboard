import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PerfTab from './PerfTab'
import { useLlmSummary, useLlmTrend } from '../../../api/queries'
import type { LlmSceneSummary } from '../../../types/analytics'

// 子组件是既有实现、本次只做平移，替身掉以聚焦 PerfTab 自身的告警与联动逻辑
vi.mock('../SceneSummaryTable', () => ({
  default: () => <div data-testid="scene-summary-table" />,
}))
vi.mock('../LlmTrendChart', () => ({
  default: () => <div data-testid="llm-trend-chart" />,
}))
vi.mock('../TurnHandoffCard', () => ({
  default: (props: { startDate: string; endDate: string }) => (
    <div
      data-testid="turn-handoff-card"
      data-start={props.startDate}
      data-end={props.endDate}
    />
  ),
}))
vi.mock('../RecentFailuresTable', () => ({
  default: (props: { scene?: string }) => (
    <div data-testid="recent-failures" data-scene={props.scene ?? ''} />
  ),
}))
vi.mock('../SlowCallsTable', () => ({
  default: (props: { startDate: string; endDate: string; scene?: string }) => (
    <div
      data-testid="slow-calls"
      data-scene={props.scene ?? ''}
      data-start={props.startDate}
      data-end={props.endDate}
    />
  ),
}))

vi.mock('../../../api/queries', () => ({
  useLlmSummary: vi.fn(),
  useLlmTrend: vi.fn(),
}))

const mockSummary = useLlmSummary as unknown as ReturnType<typeof vi.fn>
const mockTrend = useLlmTrend as unknown as ReturnType<typeof vi.fn>

function scene(overrides: Partial<LlmSceneSummary> = {}): LlmSceneSummary {
  return {
    scene: 'chat_main',
    tier: 'main',
    calls: 0,
    successRate: null,
    p50LatencyMs: null,
    p90LatencyMs: null,
    p50FirstTokenMs: null,
    p90FirstTokenMs: null,
    totalTokens: 0,
    failureBreakdown: [],
    ...overrides,
  }
}

function renderTab(scenes: LlmSceneSummary[]) {
  mockSummary.mockReturnValue({
    data: { scenes },
    isLoading: false,
    error: null,
  })
  mockTrend.mockReturnValue({
    data: { granularity: 'day', series: [] },
    isLoading: false,
    error: null,
  })
  return render(
    <MemoryRouter>
      <PerfTab />
    </MemoryRouter>,
  )
}

/**
 * 成功率告警阈值是平移前 index.tsx 的既有行为，必须逐条锁死：
 * 总调用 < 20 不评估（小样本不误报）；≥ 95% 不告警；< 95% 黄色；< 85% 红色。
 */
describe('PerfTab 成功率告警阈值', () => {
  it('总调用数 < 20 时不评估，避免小样本误报', () => {
    renderTab([scene({ calls: 19, successRate: 0.5 })])
    expect(screen.queryByText(/区间内调用成功率/)).not.toBeInTheDocument()
  })

  it('成功率 ≥ 95% 不告警', () => {
    renderTab([scene({ calls: 100, successRate: 0.95 })])
    expect(screen.queryByText(/区间内调用成功率/)).not.toBeInTheDocument()
  })

  it('95% > 成功率 ≥ 85% 给黄色提醒，指向失败明细', () => {
    renderTab([scene({ calls: 100, successRate: 0.9 })])
    const alert = screen.getByText(/区间内调用成功率/)
    expect(alert.textContent).toContain('90.0%')
    expect(alert.textContent).toContain('100 次调用')
    expect(alert.textContent).toContain('低于 95%，请关注下方失败明细')
  })

  it('成功率 < 85% 升级为红色告警，要求立即排查', () => {
    renderTab([scene({ calls: 100, successRate: 0.84 })])
    expect(screen.getByText(/已低于 85%，请立即排查上游模型与网络/)).toBeInTheDocument()
  })

  it('多场景按调用量加权求总成功率，不是简单平均', () => {
    // 100 次 100% + 300 次 70% → 加权 77.5%；简单平均会得 85%
    // 刻意避开 0.85 边界：0.8*300 在浮点下是 240.00000000000003，会让断言不稳
    renderTab([
      scene({ scene: 'chat_main', calls: 100, successRate: 1 }),
      scene({ scene: 'filler', tier: 'small', calls: 300, successRate: 0.7 }),
    ])
    const alert = screen.getByText(/区间内调用成功率/)
    expect(alert.textContent).toContain('77.5%')
    expect(alert.textContent).toContain('400 次调用')
    expect(alert.textContent).toContain('已低于 85%')
  })

  it('successRate 为 null 的场景按 0 计入加权（既有口径）', () => {
    renderTab([
      scene({ calls: 20, successRate: null }),
      scene({ scene: 'filler', tier: 'small', calls: 20, successRate: 1 }),
    ])
    const alert = screen.getByText(/区间内调用成功率/)
    expect(alert.textContent).toContain('50.0%')
  })
})

describe('PerfTab 结构与联动', () => {
  it('渲染五块既有内容：分场景汇总 / 趋势 / 衔接健康度 / 失败明细 / 慢调用', () => {
    renderTab([scene({ calls: 10, successRate: 1 })])

    expect(screen.getByTestId('scene-summary-table')).toBeInTheDocument()
    expect(screen.getByTestId('llm-trend-chart')).toBeInTheDocument()
    expect(screen.getByTestId('turn-handoff-card')).toBeInTheDocument()
    expect(screen.getByTestId('recent-failures')).toBeInTheDocument()
    expect(screen.getByTestId('slow-calls')).toBeInTheDocument()
    expect(screen.getByText('轮次衔接健康度（防死空气）')).toBeInTheDocument()
    expect(screen.getByText('慢调用长尾（成功但慢）')).toBeInTheDocument()
  })

  it('日期区间下传给按区间取数的子组件', () => {
    renderTab([scene({ calls: 10, successRate: 1 })])

    const handoff = screen.getByTestId('turn-handoff-card')
    const slow = screen.getByTestId('slow-calls')
    expect(handoff.dataset.start).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(handoff.dataset.start).toBe(slow.dataset.start)
    expect(handoff.dataset.end).toBe(slow.dataset.end)
  })

  it('场景筛选器提供全部已登记场景，默认不限场景', () => {
    renderTab([scene({ calls: 10, successRate: 1 })])

    expect(screen.getByText('全部场景')).toBeInTheDocument()
    // 未选场景时子组件收到 undefined，序列化成空串
    expect(screen.getByTestId('slow-calls').dataset.scene).toBe('')
    expect(screen.getByTestId('recent-failures').dataset.scene).toBe('')
  })

  it('趋势查询带 granularity=day', () => {
    renderTab([scene({ calls: 10, successRate: 1 })])

    expect(mockTrend).toHaveBeenLastCalledWith(
      expect.objectContaining({ granularity: 'day' }),
    )
  })

  it('接口报错时展示错误 Alert', () => {
    mockSummary.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('perf down'),
    })
    mockTrend.mockReturnValue({ data: null, isLoading: false, error: null })
    render(
      <MemoryRouter>
        <PerfTab />
      </MemoryRouter>,
    )

    expect(screen.getByText('模型监控数据加载失败')).toBeInTheDocument()
    expect(screen.getByText('perf down')).toBeInTheDocument()
  })
})
