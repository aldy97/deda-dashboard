import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CostTab from './CostTab'
import { useLlmCost } from '../../../api/queries'
import type { LlmCostResponse } from '../../../types/analytics'

// 五个费用子组件已有独立测试；这里替身掉，聚焦 CostTab 自身的区间换算与接口调用
vi.mock('../CostCards', () => ({
  default: () => <div data-testid="cost-cards" />,
}))
vi.mock('../CostByModelChart', () => ({
  default: () => <div data-testid="cost-by-model" />,
}))
vi.mock('../CostTotalChart', () => ({
  default: () => <div data-testid="cost-total" />,
}))
vi.mock('../CostUnitPriceChart', () => ({
  default: () => <div data-testid="cost-unit-price" />,
}))
vi.mock('../CostDailyTable', () => ({
  default: () => <div data-testid="cost-daily-table" />,
}))

// 日期控件替换成两个按钮，直接驱动 onChange 的 null / 有效区间两条路径
vi.mock('../../../components/AnalyticsRangePicker', async () => {
  const { default: dayjs } = await import('dayjs')
  return {
    default: (props: {
      onChange: (range: unknown) => void
      excludeToday?: boolean
    }) => (
      <div>
        <span data-testid="exclude-today">{String(props.excludeToday)}</span>
        <button onClick={() => props.onChange(null)}>clear-range</button>
        <button
          onClick={() =>
            props.onChange([dayjs('2026-10-01'), dayjs('2026-10-10')])
          }
        >
          set-range
        </button>
      </div>
    ),
  }
})

vi.mock('../../../api/queries', () => ({
  useLlmCost: vi.fn(),
}))

const mockCost = useLlmCost as unknown as ReturnType<typeof vi.fn>

const minimalCost = {
  series: [],
  month: {},
  totals: {},
} as unknown as LlmCostResponse

function renderTab(data: LlmCostResponse | null = minimalCost) {
  mockCost.mockReturnValue({ data, isLoading: false, error: null })
  return render(<CostTab />)
}

function lastCost() {
  return mockCost.mock.calls[mockCost.mock.calls.length - 1][0] as {
    startDate: string
    endDate: string
  }
}

describe('CostTab 区间变更', () => {
  it('日期控件强制 excludeToday（费用只能看历史区间）', () => {
    renderTab()

    expect(screen.getByTestId('exclude-today').textContent).toBe('true')
  })

  it('选择新区间后当前区间与等长前区间同时重算', async () => {
    const user = userEvent.setup()
    renderTab()

    await user.click(screen.getByRole('button', { name: 'set-range' }))

    const calls = mockCost.mock.calls.map(
      (call) => call[0] as { startDate: string; endDate: string },
    )
    const [current, prev] = calls.slice(-2)
    expect(current).toEqual({ startDate: '2026-10-01', endDate: '2026-10-10' })
    // 10 天区间 → 前一段是 09-21 ~ 09-30
    expect(prev).toEqual({ startDate: '2026-09-21', endDate: '2026-09-30' })
  })

  it('清空日期（onChange 收到 null）时保留原区间，不会把区间置空', async () => {
    const user = userEvent.setup()
    renderTab()
    const before = lastCost()

    await user.click(screen.getByRole('button', { name: 'clear-range' }))

    expect(lastCost()).toEqual(before)
    expect(mockCost.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('改区间后子组件仍全部挂载', async () => {
    const user = userEvent.setup()
    renderTab()

    await user.click(screen.getByRole('button', { name: 'set-range' }))

    expect(screen.getByTestId('cost-cards')).toBeInTheDocument()
    expect(screen.getByTestId('cost-by-model')).toBeInTheDocument()
    expect(screen.getByTestId('cost-total')).toBeInTheDocument()
    expect(screen.getByTestId('cost-unit-price')).toBeInTheDocument()
    expect(screen.getByTestId('cost-daily-table')).toBeInTheDocument()
  })
})

describe('CostTab 异常兜底', () => {
  it('非 Error 异常降级为固定文案，不渲染空异常信息', () => {
    mockCost.mockReturnValue({ data: null, isLoading: false, error: 'boom' })
    render(<CostTab />)

    // Alert 标题 + description 都是「费用数据加载失败」
    expect(screen.getAllByText('费用数据加载失败')).toHaveLength(2)
  })

  it('Error 对象展示其 message', () => {
    mockCost.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('cost down'),
    })
    render(<CostTab />)

    expect(screen.getByText('cost down')).toBeInTheDocument()
  })
})
