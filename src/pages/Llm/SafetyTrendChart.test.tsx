import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import SafetyTrendChart from './SafetyTrendChart'
import { chartOptions, tooltipOf } from '../../test/echartsOptions'
import type { SafetyTrendResponse } from '../../types/analytics'

const data: SafetyTrendResponse = {
  granularity: 'day',
  series: [
    {
      date: '2026-11-11',
      total: 500,
      blockedCount: 10,
      blockRate: 0.02,
      failOpenCount: 6,
      invalidLabelCount: 2,
      notEvaluatedCount: 8,
      emotionalHarmCount: 1,
    },
    {
      date: '2026-11-12',
      total: 0,
      blockedCount: 0,
      blockRate: null,
      failOpenCount: 0,
      invalidLabelCount: 0,
      notEvaluatedCount: 0,
      emotionalHarmCount: 0,
    },
  ],
}

function renderChart(payload: SafetyTrendResponse = data) {
  render(<SafetyTrendChart data={payload} />)
  return tooltipOf(chartOptions[0])
}

function option() {
  return chartOptions[0] as {
    xAxis: { data: string[] }
    series: Array<{ name: string; data: Array<number | null> }>
  }
}

describe('SafetyTrendChart 空态', () => {
  it('series 为空时给空态文案，不渲染空图', () => {
    render(<SafetyTrendChart data={{ granularity: 'day', series: [] }} />)

    expect(screen.getByText('所选区间暂无判定记录')).toBeInTheDocument()
    expect(chartOptions).toHaveLength(0)
  })
})

describe('SafetyTrendChart tooltip', () => {
  it('首行是桶日期，拦截率带百分号，末行附情绪伤害数', () => {
    const formatter = renderChart()

    const html = formatter([
      { name: '11-11', seriesName: '判定轮次', value: 500, dataIndex: 0 },
      { name: '11-11', seriesName: '拦截率', value: 2, dataIndex: 0 },
    ])
    expect(html.split('<br/>')).toEqual([
      '2026-11-11',
      '判定轮次：500',
      '拦截率：2%',
      '情绪伤害：1',
    ])
  })

  it('拦截率为 null 时显示「暂无数据」且不拼百分号', () => {
    const formatter = renderChart()

    const html = formatter([
      { name: '11-12', seriesName: '判定轮次', value: 0, dataIndex: 1 },
      { name: '11-12', seriesName: '拦截率', value: null, dataIndex: 1 },
    ])
    expect(html).toContain('拦截率：暂无数据')
    expect(html).not.toContain('暂无数据%')
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

describe('SafetyTrendChart 序列', () => {
  it('拦截率换算成百分数，null 保持 null 不补 0', () => {
    renderChart()

    const rate = option().series.find((s) => s.name === '拦截率')
    expect(rate?.data).toEqual([2, null])
  })

  it('三条未审计放行序列各取对应计数字段', () => {
    renderChart()

    const series = option().series
    expect(series.find((s) => s.name === '调用异常放行')?.data).toEqual([6, 0])
    expect(series.find((s) => s.name === '非法标签放行')?.data).toEqual([2, 0])
    expect(series.find((s) => s.name === '未做 L2')?.data).toEqual([8, 0])
  })

  it('granularity=day 时 x 轴只留月-日', () => {
    renderChart()

    expect(option().xAxis.data).toEqual(['11-11', '11-12'])
  })

  it('granularity 非 day 时 x 轴用完整桶 key（周一日期 / YYYY-MM）', () => {
    renderChart({
      granularity: 'month',
      series: [
        { ...data.series[0], date: '2026-11' },
        { ...data.series[1], date: '2026-10' },
      ],
    })

    expect(option().xAxis.data).toEqual(['2026-11', '2026-10'])
  })
})
