import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import SafetyBreakdownChart from './SafetyBreakdownChart'
import { chartOptions, tooltipOf } from '../../test/echartsOptions'
import type { SafetySummaryResponse } from '../../types/analytics'

function summary(
  overrides: Partial<SafetySummaryResponse> = {},
): SafetySummaryResponse {
  return {
    total: 1000,
    blockedCount: 20,
    blockRate: 0.02,
    byCategory: [
      { category: 'self_harm', count: 5, blockedCount: 5 },
      { category: 'safe', count: 900, blockedCount: 0 },
      { category: null, count: 12, blockedCount: 0 },
    ],
    byLayer: [
      { layer: 'L1', count: 8 },
      { layer: 'L2', count: 12 },
    ],
    bySource: [
      { source: 'l2_model', count: 960 },
      { source: 'l1_regex', count: 8 },
      { source: 'not_evaluated', count: 15 },
    ],
    failOpenCount: 12,
    invalidLabelCount: 5,
    notEvaluatedCount: 15,
    emotionalHarmCount: 3,
    reviewableCount: 25,
    ...overrides,
  }
}

function renderChart(payload: SafetySummaryResponse) {
  render(<SafetyBreakdownChart summary={payload} />)
}

function optionAt(index: number) {
  return chartOptions[index] as {
    xAxis: { data: string[] }
    series: Array<{
      name: string
      data: Array<{ value: number; itemStyle: { color: string } }>
    }>
  }
}

describe('SafetyBreakdownChart 来源图 tooltip', () => {
  it('给出占比（两位小数）与该来源的业务解释', () => {
    renderChart(summary())

    const html = tooltipOf(chartOptions[0])([
      { name: 'L1 正则命中', seriesName: '判定来源', value: 8, dataIndex: 1 },
    ])
    expect(html.split('<br/>')[0]).toBe('L1 正则命中：8 轮（0.80%）')
    expect(html).toContain('误伤孩子的气话')
  })

  it('total=0 时占比显示「—」，不拼成「（—%）」', () => {
    renderChart(summary({ total: 0, bySource: [{ source: 'l2_model', count: 0 }] }))

    const html = tooltipOf(chartOptions[0])([
      { name: 'L2 小模型判定', seriesName: '判定来源', value: 0, dataIndex: 0 },
    ])
    expect(html.split('<br/>')[0]).toBe('L2 小模型判定：0 轮（—）')
  })

  it('后端新增未知来源时降级显示原始 key，且不附解释', () => {
    renderChart(summary({ bySource: [{ source: 'brand_new_source', count: 3 }] }))

    const html = tooltipOf(chartOptions[0])([
      {
        name: 'brand_new_source',
        seriesName: '判定来源',
        value: 3,
        dataIndex: 0,
      },
    ])
    expect(html.split('<br/>')).toHaveLength(1)
    expect(html).toContain('brand_new_source：3 轮')
  })

  it('dataIndex 越界时按未知来源处理，不抛异常', () => {
    renderChart(summary())

    expect(
      tooltipOf(chartOptions[0])([
        { name: 'x', seriesName: '判定来源', value: 1, dataIndex: 99 },
      ]),
    ).toContain('x：1 轮')
  })

  it('params 为空返回空串', () => {
    renderChart(summary())

    expect(tooltipOf(chartOptions[0])([])).toBe('')
  })
})

describe('SafetyBreakdownChart 类别图 tooltip', () => {
  it('同时给出该类别的轮次与其中拦截数', () => {
    renderChart(summary())

    const html = tooltipOf(chartOptions[1])([
      { name: '自伤', seriesName: '判定类别', value: 5, dataIndex: 0 },
    ])
    expect(html.split('<br/>')).toEqual(['自伤：5 轮', '其中拦截 5 轮'])
  })

  it('「未能判定」额外说明它与 safe 严格区分', () => {
    renderChart(summary())

    const html = tooltipOf(chartOptions[1])([
      { name: '未能判定', seriesName: '判定类别', value: 12, dataIndex: 2 },
    ])
    expect(html).toContain('小模型没给出契约内标签，与「安全」严格区分')
  })

  it('safe 类别不附加「未能判定」的说明', () => {
    renderChart(summary())

    const html = tooltipOf(chartOptions[1])([
      { name: '安全', seriesName: '判定类别', value: 900, dataIndex: 1 },
    ])
    expect(html).not.toContain('严格区分')
  })

  it('dataIndex 越界时拦截数按 0 处理', () => {
    renderChart(summary())

    expect(
      tooltipOf(chartOptions[1])([
        { name: 'x', seriesName: '判定类别', value: 1, dataIndex: 99 },
      ]),
    ).toContain('其中拦截 0 轮')
  })

  it('params 为空返回空串', () => {
    renderChart(summary())

    expect(tooltipOf(chartOptions[1])([])).toBe('')
  })
})

describe('SafetyBreakdownChart 分桶与着色', () => {
  it('左图按来源、右图按类别，都不重排后端顺序', () => {
    renderChart(summary())

    expect(optionAt(0).xAxis.data).toEqual([
      'L2 小模型判定',
      'L1 正则命中',
      '未做 L2（冒险接管）',
    ])
    expect(optionAt(1).xAxis.data).toEqual(['自伤', '安全', '未能判定'])
  })

  it('来源图按来源上色，未知来源回退灰色', () => {
    renderChart(summary({ bySource: [{ source: 'brand_new_source', count: 3 }] }))

    expect(optionAt(0).series[0].data[0].itemStyle.color).toBe('#8c8c8c')
  })

  it('类别图 null 用灰色，与 safe 的绿色严格区分', () => {
    renderChart(summary())

    const colors = optionAt(1).series[0].data.map((d) => d.itemStyle.color)
    expect(colors).toEqual(['#f5222d', '#52c41a', '#bfbfbf'])
  })
})
