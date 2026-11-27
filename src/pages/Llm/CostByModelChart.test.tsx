import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import CostByModelChart from './CostByModelChart'
import { chartOptions, tooltipOf } from '../../test/echartsOptions'
import type { LlmCostSeriesItem } from '../../types/analytics'

function point(overrides: Partial<LlmCostSeriesItem> = {}): LlmCostSeriesItem {
  return {
    date: '2026-11-01',
    smallCny: 0.1,
    mainCny: 0.2,
    otherCny: null,
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

interface SeriesOption {
  name: string
  data: Array<number | null>
  markArea?: { data: Array<Array<{ xAxis: string }>> }
}

function option() {
  return chartOptions[0] as {
    legend: { data: string[] }
    xAxis: { data: string[] }
    series: SeriesOption[]
  }
}

describe('CostByModelChart 空态', () => {
  it('无数据时给空态文案，不渲染空图', () => {
    render(<CostByModelChart data={[]} />)

    expect(screen.getByText('所选区间暂无费用数据')).toBeInTheDocument()
    expect(chartOptions).toHaveLength(0)
  })
})

describe('CostByModelChart 系列与暂估标记', () => {
  it('只有小模型与主模型两条线，others 全零时不加「其他」系列', () => {
    render(
      <CostByModelChart
        data={[
          point({ date: '2026-11-01', otherCny: 0 }),
          point({ date: '2026-11-02', totalCny: null, smallCny: 0.15 }),
        ]}
      />,
    )

    const opt = option()
    expect(opt.xAxis.data).toEqual(['11-01', '11-02'])
    expect(opt.series.map((s) => s.name)).toEqual(['qwen-flash（账单）', '历史主模型（估算）'])
    expect(opt.legend.data).toEqual(['qwen-flash（账单）', '历史主模型（估算）'])
  })

  it('otherCny 非零时增加「其他（账单）」系列与图例', () => {
    render(
      <CostByModelChart
        data={[
          point({ date: '2026-11-01', otherCny: 0.5 }),
          point({ date: '2026-11-02' }),
        ]}
      />,
    )

    const opt = option()
    expect(opt.series.map((s) => s.name)).toEqual([
      'qwen-flash（账单）',
      '历史主模型（估算）',
      '其他（账单）',
    ])
    expect(opt.legend.data).toContain('其他（账单）')
    expect(opt.series[2].data).toEqual([0.5, null])
  })

  it('连续暂估日聚成一段 markArea，末尾的暂估日也能闭合', () => {
    render(
      <CostByModelChart
        data={[
          point({ date: '2026-11-01', settled: true }),
          point({ date: '2026-11-02', settled: false }),
          point({ date: '2026-11-03', settled: false }),
          point({ date: '2026-11-04', settled: null }),
          point({ date: '2026-11-05', settled: false }),
        ]}
      />,
    )

    const marker = option().series.find((s) => s.name === '暂估标记')
    expect(marker).toBeDefined()
    expect(marker!.markArea!.data.map((area) => area.map((p) => p.xAxis))).toEqual(
      [
        ['11-02', '11-03'],
        ['11-05', '11-05'],
      ],
    )
  })

  it('全为终账时不渲染暂估标记系列', () => {
    render(
      <CostByModelChart
        data={[point({ date: '2026-11-01' }), point({ date: '2026-11-02' })]}
      />,
    )

    expect(option().series.some((s) => s.name === '暂估标记')).toBe(false)
  })
})

describe('CostByModelChart tooltip', () => {
  it('逐行给出金额与历史主模型来源/精度/终账状态', () => {
    render(
      <CostByModelChart
        data={[
          point({
            date: '2026-11-01',
            smallCny: 0.1,
            mainCny: 0.2,
            mainSource: 'estimated',
            mainAccuracy: 'upper_bound',
            settled: false,
          }),
          point({
            date: '2026-11-02',
            smallCny: null,
            mainCny: 0.5,
            mainSource: 'none',
            mainAccuracy: null,
            settled: null,
          }),
          point({
            date: '2026-11-03',
            mainAccuracy: 'mixed',
            settled: true,
          }),
        ]}
      />,
    )
    const formatter = tooltipOf(chartOptions[0])

    expect(
      formatter([
        { name: '11-01', seriesName: 'qwen-flash（账单）', value: 0.1, dataIndex: 0 },
        { name: '11-01', seriesName: '历史主模型（估算）', value: 0.2, dataIndex: 0 },
      ]).split('<br/>'),
    ).toEqual([
      '2026-11-01',
      'qwen-flash（账单）：¥0.10',
      '历史主模型（估算）：¥0.20',
      '历史主模型来源：估算',
      '历史主模型精度：上界',
      '终账状态：暂估',
    ])

    const second = formatter([
      { name: '11-02', seriesName: 'qwen-flash（账单）', value: null, dataIndex: 1 },
      { name: '11-02', seriesName: '历史主模型（估算）', value: 0.5, dataIndex: 1 },
    ])
    expect(second).toContain('qwen-flash（账单）：—')
    expect(second).toContain('历史主模型来源：none')
    expect(second).toContain('历史主模型精度：—')
    expect(second).toContain('终账状态：—')

    const third = formatter([
      { name: '11-03', seriesName: 'qwen-flash（账单）', value: 0.1, dataIndex: 2 },
    ])
    expect(third).toContain('历史主模型精度：混合')
    expect(third).toContain('终账状态：已终账')
  })

  it('params 为空时按第 0 个数据点兜底，不抛异常', () => {
    render(<CostByModelChart data={[point()]} />)
    const formatter = tooltipOf(chartOptions[0])

    expect(formatter([])).toContain('2026-11-01')
  })
})
