import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import CostCards from './CostCards'
import type {
  LlmCostResponse,
  LlmCostSeriesItem,
  LlmCostTotals,
  LlmUnitEconomicsRow,
} from '../../types/analytics'

function point(overrides: Partial<LlmCostSeriesItem> = {}): LlmCostSeriesItem {
  return {
    date: '2026-11-20',
    smallCny: 0.1,
    mainCny: 0.2,
    otherCny: 0,
    totalCny: 0.3,
    smallTokens: 1000,
    mainTokens: 2000,
    smallCnyPerMillionTokens: 100,
    mainCnyPerMillionTokens: 100,
    smallSource: 'bill',
    mainSource: 'estimated',
    mainAccuracy: 'exact',
    settled: true,
    ...overrides,
  }
}

function totals(overrides: Partial<LlmCostTotals> = {}): LlmCostTotals {
  return {
    smallCny: 40,
    mainCny: 60,
    otherCny: 0,
    totalCny: 100,
    partial: false,
    days: 30,
    unpricedRows: 0,
    noTokenRows: 0,
    unpricedTokens: 0,
    ...overrides,
  }
}

function costData(overrides: {
  totals?: Partial<LlmCostTotals>
  series?: LlmCostSeriesItem[]
  aliyun?: Partial<LlmCostResponse['sources']['aliyun']>
  deepseek?: Partial<LlmCostResponse['sources']['deepseek']>
  month?: Partial<LlmCostResponse['month']>
  unitEconomics?: LlmUnitEconomicsRow[]
} = {}): LlmCostResponse {
  return {
    currency: 'CNY',
    pricing: { version: '2026-11', peakNote: '', lines: [] },
    range: {
      startDate: '2026-10-22',
      endDate: '2026-11-20',
      requestedStartDate: '2026-10-22',
      requestedEndDate: '2026-11-20',
      clamped: false,
      days: 30,
    },
    sources: {
      aliyun: {
        status: 'ok',
        kind: 'bill',
        latestBillDate: '2026-11-20',
        latestFetchedAt: null,
        modelSplit: true,
        daysWithData: 30,
        message: null,
        ...overrides.aliyun,
      },
      deepseek: {
        status: 'ok',
        kind: 'estimated',
        pricingVersion: '2026-11',
        rows: 10,
        pricedRows: 10,
        cacheHitRows: 3,
        upperBoundRows: 0,
        cacheTokenAvailable: true,
        ...overrides.deepseek,
      },
    },
    series: overrides.series ?? [point()],
    totals: totals(overrides.totals),
    month: {
      cycle: '2026-11',
      daysInCycle: 30,
      daysWithData: 20,
      toDateCny: 80,
      toDateSmallCny: 30,
      toDateMainCny: 50,
      projectedEndCny: 120,
      prevSamePeriodCny: 60,
      deltaPct: 5.5,
      partial: false,
      ...overrides.month,
    },
    unitEconomics:
      overrides.unitEconomics ??
      ([
        {
          model: 'qwen-flash',
          tier: 'small',
          source: 'bill',
          cny: 40,
          tokens: 1000,
          pricedTokens: 1000,
          cnyPerMillionTokens: 40000,
          tokenActiveDevices: 4,
          daysWithData: 1,
          cnyPerDevicePerDay: 10,
          unpricedRows: 0,
          noTokenRows: 0,
        },
      ] as LlmUnitEconomicsRow[]),
    reconciliation: {
      status: 'insufficient',
      days: 0,
      smallEstimatedCny: 0,
      smallBilledCny: 0,
      deltaPct: null,
    },
  }
}

describe('CostCards 健康区间', () => {
  it('区间合计带环比、主模型计价行与小模型账单日、单设备日均', () => {
    render(
      <CostCards
        data={costData()}
        previousTotals={totals({ totalCny: 50 })}
      />,
    )

    expect(screen.getByText('区间合计')).toBeInTheDocument()
    expect(screen.getByText('¥100.00')).toBeInTheDocument()
    expect(screen.getByText(/vs 前一等长区间 100\.0%/)).toBeInTheDocument()
    expect(screen.queryByText('合计不完整')).not.toBeInTheDocument()

    expect(screen.getByText('估算')).toBeInTheDocument()
    expect(
      screen.getByText('10 / 10 行已计价，3 行含缓存命中'),
    ).toBeInTheDocument()

    expect(screen.getByText('账单')).toBeInTheDocument()
    expect(screen.getByText('最新账单日 2026-11-20')).toBeInTheDocument()

    // 100 / 4 设备 / 1 天 = 25
    expect(screen.getByText('¥25.00')).toBeInTheDocument()
    expect(screen.getByText('4 设备 × 1 天')).toBeInTheDocument()

    expect(screen.getByText(/上月同期 ¥60\.00/)).toBeInTheDocument()
    expect(screen.getByText(/5\.5%/)).toBeInTheDocument()
  })

  it('环比为零时也给出朝向（不显示方向性颜色错误）', () => {
    render(
      <CostCards data={costData()} previousTotals={totals({ totalCny: 100 })} />,
    )

    expect(screen.getByText(/vs 前一等长区间 0\.0%/)).toBeInTheDocument()
  })

  it('环比下降时用绿色向下箭头', () => {
    render(
      <CostCards data={costData()} previousTotals={totals({ totalCny: 200 })} />,
    )

    expect(screen.getByText(/vs 前一等长区间 50\.0%/)).toBeInTheDocument()
  })

  it('前一区间缺数据或为 0 时不显示环比', () => {
    const { rerender } = render(
      <CostCards
        data={costData()}
        previousTotals={totals({ totalCny: null })}
      />,
    )
    expect(screen.queryByText(/vs 前一等长区间/)).not.toBeInTheDocument()

    rerender(<CostCards data={costData()} previousTotals={totals({ totalCny: 0 })} />)
    expect(screen.queryByText(/vs 前一等长区间/)).not.toBeInTheDocument()

    rerender(<CostCards data={costData()} />)
    expect(screen.queryByText(/vs 前一等长区间/)).not.toBeInTheDocument()
  })

  it('主模型可计价但缺缓存命中数时标注「估算·含上界」', () => {
    render(
      <CostCards
        data={costData({
          deepseek: { cacheTokenAvailable: false },
        })}
      />,
    )

    expect(screen.getByText('估算·含上界')).toBeInTheDocument()
    expect(screen.queryByText('估算')).not.toBeInTheDocument()
  })

  it('逐日主模型精度为上界或混合时同样标注含上界', () => {
    const { rerender } = render(
      <CostCards
        data={costData({ series: [point({ mainAccuracy: 'upper_bound' })] })}
      />,
    )
    expect(screen.getByText('估算·含上界')).toBeInTheDocument()

    rerender(
      <CostCards
        data={costData({ series: [point({ mainAccuracy: 'mixed' })] })}
      />,
    )
    expect(screen.getByText('估算·含上界')).toBeInTheDocument()
  })

  it('账单状态 ok 但最新账单日缺失时显示「—」占位', () => {
    render(
      <CostCards data={costData({ aliyun: { latestBillDate: null } })} />,
    )

    expect(screen.getByText('最新账单日 —')).toBeInTheDocument()
  })

  it('区间含暂估日时，小模型账单日标注「含暂估」', () => {
    render(
      <CostCards data={costData({ series: [point({ settled: false })] })} />,
    )

    expect(screen.getByText('最新账单日 2026-11-20，含暂估')).toBeInTheDocument()
  })
})

describe('CostCards 降级与缺源', () => {
  it('合计不完整时列出缺源原因；本期无主模型调用单独占位', () => {
    render(
      <CostCards
        data={costData({
          totals: {
            partial: true,
            totalCny: 0,
            smallCny: null,
            mainCny: null,
          },
          series: [point({ settled: false, smallCny: null, totalCny: null })],
          aliyun: { status: 'no_data', message: '账单未同步' },
          deepseek: { rows: 0, pricedRows: 0, cacheHitRows: 0 },
          unitEconomics: [],
        })}
      />,
    )

    expect(screen.getByText('合计不完整')).toBeInTheDocument()
    expect(screen.getByText('本期无调用')).toBeInTheDocument()
    expect(screen.getByText('暂无账单')).toBeInTheDocument()
    expect(screen.getByText('账单未同步')).toBeInTheDocument()
    // aliyun 不可用 → 小模型金额显式占位「—」
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('有历史主模型行但无成本快照时标「未计价」', () => {
    render(
      <CostCards
        data={costData({
          totals: { partial: false, totalCny: 0, smallCny: 1, mainCny: null },
          series: [point({ settled: true, mainCny: null })],
          aliyun: { status: 'ok', modelSplit: true, latestBillDate: '2026-11-01' },
          deepseek: { rows: 5, pricedRows: 0, cacheHitRows: 0 },
          unitEconomics: [],
        })}
      />,
    )

    expect(screen.getByText('未计价')).toBeInTheDocument()
  })

  it('partial 但没有可归因缺源时仍给出合计不完整提示', () => {
    render(
      <CostCards
        data={costData({
          totals: { partial: true },
          aliyun: { status: 'ok', modelSplit: true, latestBillDate: '2026-11-20' },
          deepseek: { rows: 5, pricedRows: 5, cacheHitRows: 0 },
        })}
      />,
    )

    expect(screen.getByText('合计不完整')).toBeInTheDocument()
  })

  it('账单未接入时标「未接入账单」，message 为空也不崩', () => {
    render(
      <CostCards
        data={costData({
          aliyun: { status: 'unconfigured', message: null },
          deepseek: { rows: 0 },
        })}
      />,
    )

    expect(screen.getByText('未接入账单')).toBeInTheDocument()
  })

  it('账单无法按模型拆分时降级为「账号合计」', () => {
    render(<CostCards data={costData({ aliyun: { modelSplit: false } })} />)

    expect(screen.getByText('账号合计')).toBeInTheDocument()
  })

  it('账期缺数据时标「不完整」，无上月同期时如实说明', () => {
    render(
      <CostCards
        data={costData({
          month: { partial: true, deltaPct: null, prevSamePeriodCny: null },
        })}
      />,
    )

    expect(screen.getByText('不完整')).toBeInTheDocument()
    expect(screen.getByText('上月同期 —')).toBeInTheDocument()
    expect(screen.getByText('（上月同期无数据）')).toBeInTheDocument()
  })

  it('月度环比下降时用绿色向下箭头', () => {
    render(
      <CostCards data={costData({ month: { deltaPct: -12.34 } })} />,
    )

    expect(screen.getByText(/12\.3%/)).toBeInTheDocument()
  })

  it('月度环比为 0 时仍展示 0.0%', () => {
    render(<CostCards data={costData({ month: { deltaPct: 0 } })} />)

    expect(screen.getByText(/0\.0%/)).toBeInTheDocument()
  })

  it('无设备数时单设备日均显示「—」，不除零', () => {
    render(
      <CostCards
        data={costData({
          unitEconomics: [],
          totals: { totalCny: null },
        })}
      />,
    )

    expect(screen.getByText('0 设备 × 1 天')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })
})
