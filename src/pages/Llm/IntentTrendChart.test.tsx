import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import IntentTrendChart from './IntentTrendChart'
import { chartOptions, tooltipOf } from '../../test/echartsOptions'
import type { IntentTrendResponse } from '../../types/analytics'

const data: IntentTrendResponse = {
  granularity: 'day',
  series: [
    {
      date: '2026-11-11',
      total: 400,
      modelInvoked: 350,
      fallbackCount: 4,
      byIntent: [
        { intent: 'free_chat', count: 300 },
        { intent: null, count: 100 },
      ],
    },
    {
      date: '2026-11-12',
      total: 0,
      modelInvoked: 0,
      fallbackCount: 0,
      byIntent: [],
    },
  ],
}

function renderChart(payload: IntentTrendResponse = data) {
  render(<IntentTrendChart data={payload} />)
  return tooltipOf(chartOptions[0])
}

function option() {
  return chartOptions[0] as {
    xAxis: { data: string[] }
    series: Array<{ name: string; data: number[] }>
  }
}

describe('IntentTrendChart 空态', () => {
  it('series 为空时给空态文案，不渲染空图', () => {
    render(<IntentTrendChart data={{ granularity: 'day', series: [] }} />)

    expect(screen.getByText('所选区间暂无判定记录')).toBeInTheDocument()
    expect(chartOptions).toHaveLength(0)
  })
})

describe('IntentTrendChart tooltip', () => {
  it('末行给出模型判定率（两位小数），供运营判断小模型是否真在工作', () => {
    const formatter = renderChart()

    const html = formatter([
      { name: '11-11', seriesName: '判定轮次', value: 400, dataIndex: 0 },
      { name: '11-11', seriesName: '小模型判定', value: 350, dataIndex: 0 },
      { name: '11-11', seriesName: '关键词兜底', value: 4, dataIndex: 0 },
    ])
    expect(html.split('<br/>')).toEqual([
      '2026-11-11',
      '判定轮次：400',
      '小模型判定：350',
      '关键词兜底：4',
      '模型判定率：87.50%',
    ])
  })

  it('桶内 total=0 时模型判定率显示「—」，不渲染 NaN% 或 0.00%', () => {
    const formatter = renderChart()

    const html = formatter([
      { name: '11-12', seriesName: '判定轮次', value: 0, dataIndex: 1 },
    ])
    expect(html).toContain('模型判定率：—')
    expect(html).not.toContain('NaN')
  })

  it('dataIndex 越界返回空串而不是抛异常', () => {
    const formatter = renderChart()

    expect(
      formatter([
        { name: '', seriesName: '判定轮次', value: 1, dataIndex: 99 },
      ]),
    ).toBe('')
  })

  it('params 为空时退回第 0 个桶', () => {
    const formatter = renderChart()

    expect(formatter([])).toContain('2026-11-11')
  })
})

describe('IntentTrendChart 序列', () => {
  it('三条序列名与图例严格一致（改名会让图例失联）', () => {
    renderChart()

    expect(option().series.map((s) => s.name)).toEqual([
      '判定轮次',
      '小模型判定',
      '关键词兜底',
    ])
    expect(option().series.map((s) => s.data)).toEqual([
      [400, 0],
      [350, 0],
      [4, 0],
    ])
  })

  it('granularity=day 时 x 轴只留月-日，week/month 保留完整桶 key', () => {
    renderChart()
    expect(option().xAxis.data).toEqual(['11-11', '11-12'])

    renderChart({
      granularity: 'week',
      series: [{ ...data.series[0], date: '2026-11-09' }],
    })
    expect(chartOptions[1]).toBeDefined()
    expect(
      (chartOptions[1] as { xAxis: { data: string[] } }).xAxis.data,
    ).toEqual(['2026-11-09'])
  })
})
