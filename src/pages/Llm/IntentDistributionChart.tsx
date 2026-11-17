import { Col, Row, Typography } from 'antd'
import ReactECharts from 'echarts-for-react'
import type { IntentSummaryResponse } from '../../types/analytics'
import {
  INTENT_SOURCE_CHART_COLOR,
  INTENT_SOURCE_META,
  intentLabel,
  intentSourceLabel,
} from './decisions'

/**
 * 意图分布 + 决策来源分布。
 *
 * 来源图是排查入口：模型判定（绿）占比掉、兜底（橙红）占比升，说明小模型在失效；
 * 正则未命中（青）占比过高说明路由词表覆盖不足。两张图都不重排后端顺序
 * （byIntent / bySource 均为计数倒序）。
 */
export default function IntentDistributionChart({
  summary,
}: {
  summary: IntentSummaryResponse
}) {
  const intentOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (
        params: Array<{ name: string; value: number; dataIndex: number }>,
      ) => {
        const point = params[0]
        if (!point) return ''
        const ratio =
          summary.total > 0
            ? `${((point.value / summary.total) * 100).toFixed(2)}%`
            : '—'
        return `${point.name}：${point.value} 轮（${ratio}）`
      },
    },
    grid: { left: 48, right: 16, top: 24, bottom: 88 },
    xAxis: {
      type: 'category',
      data: summary.byIntent.map((item) => intentLabel(item.intent)),
      axisLabel: { interval: 0, rotate: 30, fontSize: 11 },
    },
    yAxis: { type: 'value', name: '轮次', minInterval: 1 },
    series: [
      {
        name: '意图分布',
        type: 'bar',
        barMaxWidth: 40,
        label: { show: true, position: 'top' },
        itemStyle: { color: '#1677ff', borderRadius: [4, 4, 0, 0] },
        data: summary.byIntent.map((item) => item.count),
      },
    ],
  }

  const sourceOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (
        params: Array<{ name: string; value: number; dataIndex: number }>,
      ) => {
        const point = params[0]
        if (!point) return ''
        const source = summary.bySource[point.dataIndex]?.source ?? null
        const meta = source === null ? undefined : INTENT_SOURCE_META[source]
        const ratio =
          summary.total > 0
            ? `${((point.value / summary.total) * 100).toFixed(2)}%`
            : '—'
        return [
          `${point.name}：${point.value} 轮（${ratio}）`,
          ...(meta ? [meta.description] : []),
        ].join('<br/>')
      },
    },
    grid: { left: 48, right: 16, top: 24, bottom: 104 },
    xAxis: {
      type: 'category',
      data: summary.bySource.map((item) => intentSourceLabel(item.source)),
      axisLabel: { interval: 0, rotate: 40, fontSize: 11 },
    },
    yAxis: { type: 'value', name: '轮次', minInterval: 1 },
    series: [
      {
        name: '决策来源',
        type: 'bar',
        barMaxWidth: 40,
        label: { show: true, position: 'top' },
        data: summary.bySource.map((item) => ({
          value: item.count,
          itemStyle: {
            color:
              (item.source !== null
                ? INTENT_SOURCE_CHART_COLOR[item.source]
                : undefined) ?? '#8c8c8c',
            borderRadius: [4, 4, 0, 0],
          },
        })),
      },
    ],
  }

  return (
    <Row gutter={16}>
      <Col xs={24} lg={12}>
        <Typography.Text strong>意图分布</Typography.Text>
        <ReactECharts option={intentOption} style={{ height: 300 }} notMerge />
      </Col>
      <Col xs={24} lg={12}>
        <Typography.Text strong>决策来源分布</Typography.Text>
        <ReactECharts option={sourceOption} style={{ height: 300 }} notMerge />
      </Col>
    </Row>
  )
}
