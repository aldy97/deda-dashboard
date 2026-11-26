import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import CostUnitPriceChart from './CostUnitPriceChart'
import { chartOptions, tooltipOf } from '../../test/echartsOptions'
import type {
  LlmCostResponse,
  LlmCostSeriesItem,
  LlmOfficialPriceLine,
} from '../../types/analytics'

function point(overrides: Partial<LlmCostSeriesItem> = {}): LlmCostSeriesItem {
  return {
    date: '2026-11-01',
    smallCny: 0.1,
    mainCny: 0.2,
    otherCny: 0,
    totalCny: 0.3,
    smallTokens: 1000,
    mainTokens: 2000,
    smallCnyPerMillionTokens: 0.3,
    mainCnyPerMillionTokens: 1.5,
    smallSource: 'bill',
    mainSource: 'estimated',
    mainAccuracy: 'exact',
    settled: true,
    ...overrides,
  }
}

function line(overrides: Partial<LlmOfficialPriceLine> = {}): LlmOfficialPriceLine {
  return {
    model: 'qwen-flash',
    band: null,
    kind: 'input_miss',
    tierLabel: '0-32K',
    label: '小模型输入（未命中）',
    cnyPerMillionTokens: 0.3,
    ...overrides,
  }
}

const priceLines: LlmOfficialPriceLine[] = [
  line(),
  line({ kind: 'output', label: '小模型输出', cnyPerMillionTokens: 1.2 }),
  // 缓存命中价不画：日单价是输入/输出混合值，单独画无对照意义
  line({ kind: 'input_hit', label: '小模型缓存命中', cnyPerMillionTokens: 0.06 }),
  // 更高档位不画：只取最低档（qwen 数组第一条）
  line({ tierLabel: '32K-128K', label: '小模型输入（大上下文）', cnyPerMillionTokens: 0.6 }),
  line({
    model: 'deepseek-flash',
    band: 'off_peak',
    kind: 'input_miss',
    tierLabel: null,
    label: '主模型输入（空闲）',
    cnyPerMillionTokens: 0.5,
  }),
  line({
    model: 'deepseek-flash',
    band: 'off_peak',
    kind: 'output',
    tierLabel: null,
    label: '主模型输出（空闲）',
    cnyPerMillionTokens: 2,
  }),
  // 峰时价不画：只取空闲时段作量级锚点
  line({
    model: 'deepseek-flash',
    band: 'peak',
    kind: 'input_miss',
    tierLabel: null,
    label: '主模型输入（峰时）',
    cnyPerMillionTokens: 1,
  }),
]

function costResponse(
  lines: LlmOfficialPriceLine[],
  series: LlmCostSeriesItem[] = [point()],
): LlmCostResponse {
  return {
    currency: 'CNY',
    pricing: { version: '2026-11', peakNote: '峰谷', lines },
    range: {
      startDate: '2026-11-01',
      endDate: '2026-11-01',
      requestedStartDate: '2026-11-01',
      requestedEndDate: '2026-11-01',
      clamped: false,
      days: 1,
    },
    sources: {
      aliyun: {
        status: 'ok',
        kind: 'bill',
        latestBillDate: '2026-11-01',
        latestFetchedAt: null,
        modelSplit: true,
        daysWithData: 1,
        message: null,
      },
      deepseek: {
        status: 'ok',
        kind: 'estimated',
        pricingVersion: '2026-11',
        rows: 1,
        pricedRows: 1,
        cacheHitRows: 0,
        upperBoundRows: 0,
        cacheTokenAvailable: true,
      },
    },
    series,
    totals: {
      smallCny: 0.1,
      mainCny: 0.2,
      otherCny: 0,
      totalCny: 0.3,
      partial: false,
      days: 1,
      unpricedRows: 0,
      noTokenRows: 0,
      unpricedTokens: 0,
    },
    month: {
      cycle: '2026-11',
      daysInCycle: 30,
      daysWithData: 1,
      toDateCny: 0.3,
      toDateSmallCny: 0.1,
      toDateMainCny: 0.2,
      projectedEndCny: 9,
      prevSamePeriodCny: null,
      deltaPct: null,
      partial: false,
    },
    unitEconomics: [],
    reconciliation: {
      status: 'insufficient',
      days: 0,
      smallEstimatedCny: 0,
      smallBilledCny: 0,
      deltaPct: null,
    },
  }
}

interface UnitOption {
  series: Array<{
    name: string
    data: Array<number | null>
    markLine?: { data: Array<{ yAxis: number; label: { formatter: string } }> }
  }>
}

function option() {
  return chartOptions[0] as unknown as UnitOption
}

describe('CostUnitPriceChart 空态', () => {
  it('series 为空时给空态文案，不渲染空图', () => {
    render(<CostUnitPriceChart data={costResponse(priceLines, [])} />)

    expect(screen.getByText('所选区间暂无费用数据')).toBeInTheDocument()
    expect(chartOptions).toHaveLength(0)
  })
})

describe('CostUnitPriceChart 参考线', () => {
  it('小模型只取最低档的输入未命中价与输出价，主模型只取空闲时段', () => {
    render(<CostUnitPriceChart data={costResponse(priceLines)} />)

    const markLines = option().series[0].markLine!.data
    expect(markLines).toHaveLength(4)
    expect(markLines.map((m) => m.yAxis)).toEqual([0.3, 1.2, 0.5, 2])
    expect(markLines[0].label.formatter).toBe('小模型输入（未命中） ¥0.3000')
    expect(markLines[3].label.formatter).toBe('主模型输出（空闲） ¥2.0000')
  })

  it('没有任何匹配的定价行时不加 markLine', () => {
    render(
      <CostUnitPriceChart
        data={costResponse([
          line({ model: 'future-model' }),
          line({ kind: 'input_hit' }),
        ])}
      />,
    )

    expect(option().series[0].markLine).toBeUndefined()
  })

  it('qwen 行 tierLabel 为 null 时无法定档，不画小模型参考线', () => {
    render(
      <CostUnitPriceChart
        data={costResponse([line({ tierLabel: null })])}
      />,
    )

    expect(option().series[0].markLine).toBeUndefined()
  })

  it('单价系列按日取数，null 表示当天无对应消费', () => {
    render(
      <CostUnitPriceChart
        data={costResponse(priceLines, [
          point({
            date: '2026-11-01',
            smallCnyPerMillionTokens: 0.3,
            mainCnyPerMillionTokens: 1.5,
          }),
          point({
            date: '2026-11-02',
            smallCnyPerMillionTokens: null,
            mainCnyPerMillionTokens: null,
          }),
        ])}
      />,
    )

    const opt = option()
    expect(opt.series.map((s) => s.name)).toEqual(['小模型单价', '主模型单价'])
    expect(opt.series[0].data).toEqual([0.3, null])
    expect(opt.series[1].data).toEqual([1.5, null])
  })
})

describe('CostUnitPriceChart tooltip', () => {
  it('金额按 ¥/M tokens 四位小数，null 显示「—」', () => {
    render(
      <CostUnitPriceChart
        data={costResponse(priceLines, [
          point({
            date: '2026-11-01',
            smallCnyPerMillionTokens: 0.3,
            mainCnyPerMillionTokens: null,
          }),
        ])}
      />,
    )
    const formatter = tooltipOf(chartOptions[0])

    expect(
      formatter([
        { name: '11-01', seriesName: '小模型单价', value: 0.3, dataIndex: 0 },
        { name: '11-01', seriesName: '主模型单价', value: null, dataIndex: 0 },
      ]).split('<br/>'),
    ).toEqual([
      '2026-11-01',
      '小模型单价：¥0.3000/M tokens',
      '主模型单价：—',
    ])
  })

  it('params 为空时按第 0 个数据点兜底，不抛异常', () => {
    render(<CostUnitPriceChart data={costResponse(priceLines)} />)
    const formatter = tooltipOf(chartOptions[0])

    expect(formatter([])).toContain('2026-11-01')
  })
})
