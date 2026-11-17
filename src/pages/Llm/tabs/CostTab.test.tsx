import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import dayjs from 'dayjs'
import CostTab from './CostTab'
import { useLlmCost } from '../../../api/queries'
import type { LlmCostResponse } from '../../../types/analytics'

// 五个费用子组件是既有实现、本次只做平移；替身掉以便用最小夹具驱动 CostTab 自身逻辑
vi.mock('../CostCards', () => ({
  default: (props: { previousTotals?: unknown }) => (
    <div
      data-testid="cost-cards"
      data-has-prev={props.previousTotals === undefined ? 'no' : 'yes'}
    />
  ),
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

vi.mock('../../../api/queries', () => ({
  useLlmCost: vi.fn(),
}))

const mockCost = useLlmCost as unknown as ReturnType<typeof vi.fn>

/** CostTab 只读 series / month / totals 三个字段（其余由被替身的子组件消费） */
const minimalCost = {
  series: [],
  month: {},
  totals: {},
} as unknown as LlmCostResponse

function renderTab(data: LlmCostResponse | null = minimalCost) {
  mockCost.mockReturnValue({ data, isLoading: false, error: null })
  return render(<CostTab />)
}

/**
 * 费用口径是平移前 index.tsx 的既有行为，必须锁死：
 * 历史区间（终点＝昨日，今日账单未出）+ 环比区间＝等长的前一段。
 */
describe('CostTab 日期口径', () => {
  it('当前区间终点是昨日、共 30 天（excludeToday：今日账单必然偏低）', () => {
    renderTab()

    const [current] = mockCost.mock.calls.map(
      (call) => call[0] as { startDate: string; endDate: string },
    )
    const yesterday = dayjs().startOf('day').subtract(1, 'day')
    expect(dayjs(current.endDate).isSame(yesterday, 'day')).toBe(true)
    expect(
      dayjs(current.startDate).isSame(
        dayjs(current.endDate).subtract(29, 'day'),
        'day',
      ),
    ).toBe(true)
  })

  it('环比区间＝当前区间等长的前一段，终点紧接当前区间起点前一天', () => {
    renderTab()

    const [current, prev] = mockCost.mock.calls.map(
      (call) => call[0] as { startDate: string; endDate: string },
    )
    expect(mockCost).toHaveBeenCalledTimes(2)
    expect(dayjs(prev.endDate).isSame(dayjs(current.startDate).subtract(1, 'day'), 'day')).toBe(
      true,
    )
    expect(
      dayjs(prev.startDate).isSame(dayjs(current.startDate).subtract(30, 'day'), 'day'),
    ).toBe(true)
  })

  it('费用区块独立于性能区间：默认不含今日，且提供昨日/近7天/近30天/上月预设', () => {
    renderTab()

    // 页面级说明写明费用截至昨日
    expect(screen.getByText(/费用数据截至昨日/)).toBeInTheDocument()
  })
})

describe('CostTab 渲染', () => {
  it('有数据时渲染五块费用内容，并把环比 totals 传给卡片', () => {
    renderTab()

    expect(screen.getByTestId('cost-cards')).toBeInTheDocument()
    expect(screen.getByTestId('cost-cards').dataset.hasPrev).toBe('yes')
    expect(screen.getByTestId('cost-by-model')).toBeInTheDocument()
    expect(screen.getByTestId('cost-total')).toBeInTheDocument()
    expect(screen.getByTestId('cost-unit-price')).toBeInTheDocument()
    expect(screen.getByTestId('cost-daily-table')).toBeInTheDocument()
    expect(screen.getByText('按模型费用趋势')).toBeInTheDocument()
    expect(screen.getByText('总费用趋势（含累计）')).toBeInTheDocument()
    expect(screen.getByText('百万 token 单价趋势')).toBeInTheDocument()
    expect(screen.getByText('每日明细与对账')).toBeInTheDocument()
  })

  it('无数据时不渲染费用子块（不拿 null 去喂图表）', () => {
    renderTab(null)

    expect(screen.queryByTestId('cost-cards')).not.toBeInTheDocument()
    expect(screen.queryByText('按模型费用趋势')).not.toBeInTheDocument()
  })

  it('接口报错时展示错误 Alert', () => {
    mockCost.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('cost down'),
    })
    render(<CostTab />)

    expect(screen.getByText('费用数据加载失败')).toBeInTheDocument()
    expect(screen.getByText('cost down')).toBeInTheDocument()
  })
})
