import { Empty } from 'antd'
import ReactECharts from 'echarts-for-react'
import type { LlmCostSeriesItem } from '../../types/analytics'

const mainSourceLabel = (v: string) => (v === 'estimated' ? '估算' : v)
const mainAccuracyLabel = (v: string | null) => {
  if (v === 'exact') return '精确'
  if (v === 'upper_bound') return '上界'
  if (v === 'mixed') return '混合'
  return '—'
}
const settledLabel = (v: boolean | null) => {
  if (v === true) return '已终账'
  if (v === false) return '暂估'
  return '—'
}

function hasOther(series: LlmCostSeriesItem[]) {
  return series.some((s) => s.otherCny !== null && s.otherCny !== 0)
}

/**
 * 图A：按小模型/主模型/其他拆分的每日费用折线图。
 * 主模型用虚线（估算），未终账日期用 markArea 标「暂估」。
 */
export default function CostByModelChart({ data }: { data: LlmCostSeriesItem[] }) {
  if (data.length === 0) {
    return <Empty description="所选区间暂无费用数据" />
  }

  const dates = data.map((p) => p.date.slice(5))
  const showOther = hasOther(data)

  const unsettledAreas: Array<[number, number]> = []
  let rangeStart: number | null = null
  for (let i = 0; i < data.length; i++) {
    if (data[i].settled === false) {
      if (rangeStart === null) rangeStart = i
    } else {
      if (rangeStart !== null) {
        unsettledAreas.push([rangeStart, i - 1])
        rangeStart = null
      }
    }
  }
  if (rangeStart !== null) {
    unsettledAreas.push([rangeStart, data.length - 1])
  }

  const markAreaData = unsettledAreas.map(([start, end]) => [
    { xAxis: dates[start], itemStyle: { color: 'rgba(250, 173, 20, 0.08)' } },
    { xAxis: dates[end] },
  ])

  const seriesConfig: Array<Record<string, unknown>> = [
    {
      name: '小模型（账单）',
      type: 'line',
      smooth: true,
      connectNulls: false,
      itemStyle: { color: '#1677ff' },
      data: data.map((p) => p.smallCny),
    },
    {
      name: '主模型（估算）',
      type: 'line',
      smooth: true,
      connectNulls: false,
      lineStyle: { type: 'dashed' },
      itemStyle: { color: '#fa8c16' },
      data: data.map((p) => p.mainCny),
    },
  ]

  if (showOther) {
    seriesConfig.push({
      name: '其他（账单）',
      type: 'line',
      smooth: true,
      connectNulls: false,
      itemStyle: { color: '#52c41a' },
      data: data.map((p) => p.otherCny),
    })
  }

  const legendData = [
    '小模型（账单）',
    '主模型（估算）',
    ...(showOther ? ['其他（账单）' as string] : []),
  ]

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: (
        params: Array<{ seriesName: string; value: number | null; dataIndex: number }>,
      ) => {
        const idx = params[0]?.dataIndex ?? 0
        const point = data[idx]
        const lines = params.map((p) => {
          let val = '—'
          if (p.value !== null) {
            val = `¥${p.value.toFixed(2)}`
          }
          return `${p.seriesName}：${val}`
        })
        const meta = [
          `主模型来源：${mainSourceLabel(point.mainSource)}`,
          `主模型精度：${mainAccuracyLabel(point.mainAccuracy)}`,
          `终账状态：${settledLabel(point.settled)}`,
        ]
        return [`${point.date}`, ...lines, ...meta].join('<br/>')
      },
    },
    legend: { data: legendData, bottom: 0 },
    grid: { left: 56, right: 24, top: 24, bottom: 56 },
    xAxis: { type: 'category', data: dates },
    yAxis: {
      type: 'value',
      name: '¥',
      axisLabel: { formatter: '{value}' },
    },
    series: [
      ...seriesConfig,
      ...(markAreaData.length > 0
        ? [
            {
              name: '暂估标记',
              type: 'line',
              data: [],
              markArea: {
                silent: true,
                label: {
                  show: true,
                  position: 'insideTop',
                  formatter: '暂估',
                  fontSize: 11,
                  color: '#d48806',
                },
                data: markAreaData,
              },
            },
          ]
        : []),
    ],
  }

  return <ReactECharts option={option} style={{ height: 320 }} notMerge />
}
