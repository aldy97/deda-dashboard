import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import IntentDistributionChart from './IntentDistributionChart'
import { chartOptions, tooltipOf } from '../../test/echartsOptions'
import type { IntentSummaryResponse } from '../../types/analytics'

function summary(
  overrides: Partial<IntentSummaryResponse> = {},
): IntentSummaryResponse {
  return {
    total: 800,
    byIntent: [
      { intent: 'free_chat', count: 500 },
      { intent: 'adventure_story', count: 200 },
      { intent: null, count: 100 },
    ],
    bySource: [
      { source: 'model', count: 600 },
      { source: 'fallback_error', count: 40 },
      { source: 'not_routed', count: 100 },
    ],
    modelInvokedCount: 600,
    modelInvokedRate: 0.75,
    fallbackCount: 40,
    fallbackRate: 0.05,
    notRoutedCount: 100,
    adventureTakeoverCount: 60,
    matrix: [
      { intent: 'free_chat', source: 'model', count: 500 },
      { intent: null, source: 'not_routed', count: 100 },
    ],
    ...overrides,
  }
}

function renderChart(payload: IntentSummaryResponse) {
  render(<IntentDistributionChart summary={payload} />)
}

function optionAt(index: number) {
  return chartOptions[index] as {
    xAxis: { data: string[] }
    series: Array<{
      name: string
      data: Array<number | { value: number; itemStyle: { color: string } }>
    }>
  }
}

describe('IntentDistributionChart 意图图 tooltip', () => {
  it('给出占全部判定轮次的比例（两位小数）', () => {
    renderChart(summary())

    const html = tooltipOf(chartOptions[0])([
      { name: '自由聊天', seriesName: '意图分布', value: 500, dataIndex: 0 },
    ])
    expect(html).toBe('自由聊天：500 轮（62.50%）')
  })

  it('total=0 时占比显示「—」，不拼成「（—%）」', () => {
    renderChart(summary({ total: 0, byIntent: [{ intent: 'free_chat', count: 0 }] }))

    expect(
      tooltipOf(chartOptions[0])([
        { name: '自由聊天', seriesName: '意图分布', value: 0, dataIndex: 0 },
      ]),
    ).toBe('自由聊天：0 轮（—）')
  })

  it('params 为空返回空串', () => {
    renderChart(summary())

    expect(tooltipOf(chartOptions[0])([])).toBe('')
  })
})

describe('IntentDistributionChart 来源图 tooltip', () => {
  it('附上该来源的业务解释，让运营能自行判读', () => {
    renderChart(summary())

    const html = tooltipOf(chartOptions[1])([
      { name: '兜底·调用异常', seriesName: '决策来源', value: 40, dataIndex: 1 },
    ])
    expect(html.split('<br/>')[0]).toBe('兜底·调用异常：40 轮（5.00%）')
    expect(html).toContain('llm_usage_logs.failureReason')
  })

  it('source 为 null 时按未知来源处理，不附解释也不抛异常', () => {
    renderChart(summary({ bySource: [{ source: null, count: 7 }] }))

    const html = tooltipOf(chartOptions[1])([
      { name: '未知来源', seriesName: '决策来源', value: 7, dataIndex: 0 },
    ])
    expect(html.split('<br/>')).toHaveLength(1)
    expect(html).toBe('未知来源：7 轮（0.88%）')
  })

  it('dataIndex 越界时按未知来源处理', () => {
    renderChart(summary())

    expect(
      tooltipOf(chartOptions[1])([
        { name: 'x', seriesName: '决策来源', value: 1, dataIndex: 99 },
      ]),
    ).toBe('x：1 轮（0.13%）')
  })

  it('params 为空返回空串', () => {
    renderChart(summary())

    expect(tooltipOf(chartOptions[1])([])).toBe('')
  })
})

describe('IntentDistributionChart 分桶与着色', () => {
  it('x 轴一律用中文名，null 意图显示「未走到路由」，且不重排后端顺序', () => {
    renderChart(summary())

    expect(optionAt(0).xAxis.data).toEqual([
      '自由聊天',
      '冒险故事',
      '未走到路由',
    ])
    expect(optionAt(1).xAxis.data).toEqual([
      '小模型判定',
      '兜底·调用异常',
      '未路由·被安全拦截',
    ])
  })

  it('后端新增未知来源时降级显示原始 key', () => {
    renderChart(summary({ bySource: [{ source: 'brand_new_source', count: 3 }] }))

    expect(optionAt(1).xAxis.data).toEqual(['brand_new_source'])
  })

  it('来源图按来源上色：模型绿、兜底橙红、被拦截红，null 回退灰', () => {
    renderChart(summary({ bySource: [{ source: null, count: 3 }] }))

    const data = optionAt(1).series[0].data as Array<{
      value: number
      itemStyle: { color: string }
    }>
    expect(data[0].itemStyle.color).toBe('#8c8c8c')
  })

  it('意图图用统一主色，柱值直接取 count', () => {
    renderChart(summary())

    expect(optionAt(0).series[0].data).toEqual([500, 200, 100])
  })
})
