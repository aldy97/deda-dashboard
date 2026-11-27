import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import CostTotalChart from './CostTotalChart'
import { chartOptions, tooltipOf } from '../../test/echartsOptions'
import type { LlmCostMonth, LlmCostSeriesItem } from '../../types/analytics'

function point(overrides: Partial<LlmCostSeriesItem> = {}): LlmCostSeriesItem {
  return {
    date: '2026-11-01',
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

function month(overrides: Partial<LlmCostMonth> = {}): LlmCostMonth {
  return {
    cycle: '2026-11',
    daysInCycle: 30,
    daysWithData: 4,
    toDateCny: 0.6,
    toDateSmallCny: 0.2,
    toDateMainCny: 0.4,
    projectedEndCny: 4.5,
    prevSamePeriodCny: 0.4,
    deltaPct: 50,
    partial: false,
    ...overrides,
  }
}

const series = [
  point({ date: '2026-11-01', totalCny: 0.3 }),
  // 小模型账单未出：合计只含主模型，累计必须断线
  point({ date: '2026-11-02', smallCny: null, totalCny: 0.2 }),
  // 整日无数据
  point({
    date: '2026-11-03',
    smallCny: null,
    mainCny: null,
    totalCny: null,
    mainTokens: 0,
  }),
  point({ date: '2026-11-04', totalCny: 0.3 }),
]

interface TotalOption {
  xAxis: { data: string[] }
  series: Array<{
    name: string
    data: Array<number | null>
    markLine?: { data: Array<{ yAxis: number | null }> }
  }>
}

function option() {
  return chartOptions[0] as unknown as TotalOption
}

describe('CostTotalChart 空态', () => {
  it('无数据时给空态文案，不渲染空图', () => {
    render(<CostTotalChart series={[]} month={month()} />)

    expect(screen.getByText('所选区间暂无费用数据')).toBeInTheDocument()
    expect(chartOptions).toHaveLength(0)
  })
})

describe('CostTotalChart 累计口径', () => {
  it('只累加完整日，缺源日与无数据日一律断线，不平推前值', () => {
    render(<CostTotalChart series={series} month={month()} />)

    const opt = option()
    expect(opt.series[0].data).toEqual([0.3, 0.2, null, 0.3])
    // 第 2、3 天断线；第 4 天从 0.3 重新累加（不含未知日，故偏低）
    expect(opt.series[1].data).toEqual([0.3, null, null, 0.6])
  })

  it('有月末预测时画 markLine，label 带账期', () => {
    render(<CostTotalChart series={series} month={month()} />)

    const markLine = option().series[1].markLine
    expect(markLine).toBeDefined()
    expect(markLine!.data).toEqual([{ yAxis: 4.5 }])
  })

  it('没有预测（projectedEndCny=null）时不画 markLine', () => {
    render(
      <CostTotalChart series={series} month={month({ projectedEndCny: null })} />,
    )

    expect(option().series[1].markLine).toBeUndefined()
  })
})

describe('CostTotalChart tooltip', () => {
  it('给出每日总费用与累计；缺源日补充缺哪一块', () => {
    render(<CostTotalChart series={series} month={month()} />)
    const formatter = tooltipOf(chartOptions[0])

    const partial = formatter([
      { name: '11-02', seriesName: '每日总费用', value: 0.2, dataIndex: 1 },
      { name: '11-02', seriesName: '累计', value: null, dataIndex: 1 },
    ])
    expect(partial.split('<br/>')).toEqual([
      '2026-11-02',
      '每日总费用：¥0.20',
      '累计：—',
      '合计不含qwen-flash（当日账单未出）',
    ])

    const complete = formatter([
      { name: '11-01', seriesName: '每日总费用', value: 0.3, dataIndex: 0 },
      { name: '11-01', seriesName: '累计', value: 0.3, dataIndex: 0 },
    ])
    expect(complete.split('<br/>')).toEqual([
      '2026-11-01',
      '每日总费用：¥0.30',
      '累计：¥0.30',
    ])
  })

  it('无数据日 dayVal 显示「—」；累计参数缺失时也显示「—」', () => {
    render(<CostTotalChart series={series} month={month()} />)
    const formatter = tooltipOf(chartOptions[0])

    const empty = formatter([
      { name: '11-03', seriesName: '每日总费用', value: null, dataIndex: 2 },
    ])
    expect(empty.split('<br/>')).toEqual([
      '2026-11-03',
      '每日总费用：—',
      '累计：—',
    ])
  })

  it('params 为空时按第 0 个数据点兜底，不抛异常', () => {
    render(<CostTotalChart series={series} month={month()} />)
    const formatter = tooltipOf(chartOptions[0])

    expect(formatter([])).toContain('2026-11-01')
  })
})
