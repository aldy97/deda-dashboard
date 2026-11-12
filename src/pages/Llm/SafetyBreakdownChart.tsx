import { Col, Row, Typography } from 'antd'
import ReactECharts from 'echarts-for-react'
import type { SafetySummaryResponse } from '../../types/analytics'
import {
  SAFETY_CATEGORY_CHART_COLOR,
  SAFETY_SOURCE_CHART_COLOR,
  SAFETY_SOURCE_META,
  SAFETY_UNKNOWN_CHART_COLOR,
  safetyCategoryLabel,
  safetySourceLabel,
} from './decisions'

/**
 * 安全判定分桶：左「按判定来源」，右「按类别」。
 *
 * 来源图是主图，必须放在前面：l2_invalid_label / l2_fail_open / not_evaluated
 * 三类都表现为「放行」，只看类别图会把它们和真判过的 safe 混成一桶，
 * 静默降级就被读成了正常。类别图只回答「拦下来的都是什么事」。
 *
 * 两张图都不重排后端顺序：byCategory 是严重度序（sexual→…→safe→null），
 * bySource 是计数倒序，重排会破坏「最该先看的在最上面」。
 */
export default function SafetyBreakdownChart({
  summary,
}: {
  summary: SafetySummaryResponse
}) {
  const sourceOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: Array<{ name: string; value: number; dataIndex: number }>) => {
        const point = params[0]
        if (!point) return ''
        const source = summary.bySource[point.dataIndex]?.source ?? null
        const meta = source === null ? undefined : SAFETY_SOURCE_META[source]
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
    grid: { left: 48, right: 16, top: 24, bottom: 88 },
    xAxis: {
      type: 'category',
      data: summary.bySource.map((item) => safetySourceLabel(item.source)),
      axisLabel: { interval: 0, rotate: 30, fontSize: 11 },
    },
    yAxis: { type: 'value', name: '轮次', minInterval: 1 },
    series: [
      {
        name: '判定来源',
        type: 'bar',
        barMaxWidth: 40,
        label: { show: true, position: 'top' },
        data: summary.bySource.map((item) => ({
          value: item.count,
          itemStyle: {
            color: SAFETY_SOURCE_CHART_COLOR[item.source] ?? '#8c8c8c',
            borderRadius: [4, 4, 0, 0],
          },
        })),
      },
    ],
  }

  const categoryOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: Array<{ name: string; value: number; dataIndex: number }>) => {
        const point = params[0]
        if (!point) return ''
        const bucket = summary.byCategory[point.dataIndex]
        return [
          `${point.name}：${point.value} 轮`,
          `其中拦截 ${bucket?.blockedCount ?? 0} 轮`,
          point.name === '未能判定'
            ? '小模型没给出契约内标签，与「安全」严格区分'
            : '',
        ]
          .filter(Boolean)
          .join('<br/>')
      },
    },
    grid: { left: 48, right: 16, top: 24, bottom: 88 },
    xAxis: {
      type: 'category',
      data: summary.byCategory.map((item) => safetyCategoryLabel(item.category)),
      axisLabel: { interval: 0, rotate: 30, fontSize: 11 },
    },
    yAxis: { type: 'value', name: '轮次', minInterval: 1 },
    series: [
      {
        name: '判定类别',
        type: 'bar',
        barMaxWidth: 40,
        label: { show: true, position: 'top' },
        data: summary.byCategory.map((item) => ({
          value: item.count,
          itemStyle: {
            color:
              (item.category !== null
                ? SAFETY_CATEGORY_CHART_COLOR[item.category]
                : undefined) ?? SAFETY_UNKNOWN_CHART_COLOR,
            borderRadius: [4, 4, 0, 0],
          },
        })),
      },
    ],
  }

  return (
    <Row gutter={16}>
      <Col xs={24} lg={12}>
        <Typography.Text strong>按判定来源分桶</Typography.Text>
        <ReactECharts option={sourceOption} style={{ height: 280 }} notMerge />
      </Col>
      <Col xs={24} lg={12}>
        <Typography.Text strong>按判定类别分桶</Typography.Text>
        <ReactECharts option={categoryOption} style={{ height: 280 }} notMerge />
      </Col>
    </Row>
  )
}
