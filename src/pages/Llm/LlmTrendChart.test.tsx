import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import LlmTrendChart from './LlmTrendChart'
import { chartOptions, tooltipOf } from '../../test/echartsOptions'
import type { LlmTrendResponse } from '../../types/analytics'

const data: LlmTrendResponse = {
  granularity: 'day',
  series: [
    {
      date: '2026-11-11',
      calls: 120,
      successRate: 0.987,
      p50LatencyMs: 1200.4,
      avgFirstTokenMs: 380.6,
      p50FirstTokenMs: 400.4,
      p90FirstTokenMs: 1200.6,
      totalTokens: 123456,
    },
    {
      date: '2026-11-12',
      calls: 0,
      successRate: null,
      p50LatencyMs: null,
      avgFirstTokenMs: null,
      p50FirstTokenMs: null,
      p90FirstTokenMs: null,
      totalTokens: 0,
    },
  ],
}

interface TrendOption {
  xAxis: { data: string[] }
  series: Array<{ name: string; data: Array<number | null> }>
}

function option() {
  return chartOptions[0] as unknown as TrendOption
}

describe('LlmTrendChart 空态', () => {
  it('series 为空时给空态文案，不渲染空图', () => {
    render(<LlmTrendChart data={{ granularity: 'day', series: [] }} />)

    expect(screen.getByText('所选区间暂无调用数据')).toBeInTheDocument()
    expect(chartOptions).toHaveLength(0)
  })
})

describe('LlmTrendChart 系列换算', () => {
  it('成功率换成百分比保留两位，首包分位数取整，null 保持断线', () => {
    render(<LlmTrendChart data={data} />)

    const opt = option()
    expect(opt.xAxis.data).toEqual(['11-11', '11-12'])
    expect(opt.series.map((s) => s.name)).toEqual([
      '调用量',
      '成功率',
      '首包 P50',
      '首包 P90',
    ])
    expect(opt.series[0].data).toEqual([120, 0])
    expect(opt.series[1].data).toEqual([98.7, null])
    expect(opt.series[2].data).toEqual([400, null])
    expect(opt.series[3].data).toEqual([1201, null])
  })
})

describe('LlmTrendChart tooltip', () => {
  it('按系列名补单位，null 显示「暂无数据」，末三行给 token 与延迟', () => {
    render(<LlmTrendChart data={data} />)
    const formatter = tooltipOf(chartOptions[0])

    const html = formatter([
      { name: '11-11', seriesName: '调用量', value: 120, dataIndex: 0 },
      { name: '11-11', seriesName: '成功率', value: 98.7, dataIndex: 0 },
      { name: '11-11', seriesName: '首包 P50', value: 400, dataIndex: 0 },
    ])
    expect(html.split('<br/>')).toEqual([
      '2026-11-11',
      '调用量：120',
      '成功率：98.7%',
      '首包 P50：400 ms',
      expect.stringContaining('总 token：'),
      '延迟 P50：1.20 s',
      '首包均值：381 ms',
    ])
  })

  it('null 值显示「暂无数据」而不是 0', () => {
    render(<LlmTrendChart data={data} />)
    const formatter = tooltipOf(chartOptions[0])

    const html = formatter([
      { name: '11-12', seriesName: '成功率', value: null, dataIndex: 1 },
      { name: '11-12', seriesName: '首包 P90', value: null, dataIndex: 1 },
    ])
    expect(html).toContain('成功率：暂无数据')
    expect(html).toContain('首包 P90：暂无数据')
    expect(html).toContain('延迟 P50：—')
    expect(html).toContain('首包均值：—')
  })

  it('params 为空时按第 0 个数据点兜底，不抛异常', () => {
    render(<LlmTrendChart data={data} />)
    const formatter = tooltipOf(chartOptions[0])

    expect(formatter([])).toContain('2026-11-11')
  })
})
