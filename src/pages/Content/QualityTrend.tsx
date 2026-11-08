import { Empty } from 'antd'
import ReactECharts from 'echarts-for-react'
import type { QualityConversationResponse } from '../../types/analytics'

/**
 * 对话质量趋势：失败率 + 安全拦截率（右轴无，均为百分比单轴）。
 * totalTurns=0 的日期后端返回 null，断点处理。
 */
export default function QualityTrend({
  data,
}: {
  data: QualityConversationResponse
}) {
  if (data.series.length === 0) {
    return <Empty description="所选区间暂无对话数据" />
  }

  const dates = data.series.map((p) => p.date.slice(5))
  const pct = (rate: number | null) =>
    rate === null ? null : Math.round(rate * 10000) / 100

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: (
        params: Array<{ seriesName: string; value: number | null; dataIndex: number }>,
      ) => {
        const point = data.series[params[0]?.dataIndex ?? 0]
        const lines = params.map(
          (p) =>
            `${p.seriesName}：${p.value === null ? '暂无数据' : `${p.value}%`}`,
        )
        return [
          `${point.date}（总轮次 ${point.totalTurns}）`,
          ...lines,
        ].join('<br/>')
      },
    },
    legend: { data: ['对话失败率', '安全拦截率'], bottom: 0 },
    grid: { left: 48, right: 24, top: 24, bottom: 56 },
    xAxis: { type: 'category', data: dates, boundaryGap: false },
    yAxis: {
      type: 'value',
      name: '%',
      min: 0,
      axisLabel: { formatter: '{value}%' },
    },
    series: [
      {
        name: '对话失败率',
        type: 'line',
        smooth: true,
        connectNulls: false,
        data: data.series.map((p) => pct(p.failureRate)),
      },
      {
        name: '安全拦截率',
        type: 'line',
        smooth: true,
        connectNulls: false,
        lineStyle: { type: 'dashed' },
        data: data.series.map((p) => pct(p.safetyRate)),
      },
    ],
  }

  return <ReactECharts option={option} style={{ height: 300 }} notMerge />
}
