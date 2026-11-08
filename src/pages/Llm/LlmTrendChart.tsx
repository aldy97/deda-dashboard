import { Empty } from 'antd'
import ReactECharts from 'echarts-for-react'
import type { LlmTrendResponse } from '../../types/analytics'

/**
 * 模型调用趋势：调用量（柱，左轴）+ 成功率（线，右轴 %）。
 * 流式场景追加首包均值虚线（左轴注意：与调用量单位不同，仅作形态参考，
 * 因此放入独立小图更准——一期先按「成功率 + 调用量」呈现）。
 */
export default function LlmTrendChart({ data }: { data: LlmTrendResponse }) {
  if (data.series.length === 0) {
    return <Empty description="所选区间暂无调用数据" />
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
            `${p.seriesName}：${p.value === null ? '暂无数据' : p.value}${p.seriesName === '成功率' ? '%' : ''}`,
        )
        const extras = [
          `总 token：${point.totalTokens.toLocaleString()}`,
          `延迟 P50：${point.p50LatencyMs === null ? '—' : `${point.p50LatencyMs} ms`}`,
          `首包均值：${point.avgFirstTokenMs === null ? '—' : `${point.avgFirstTokenMs} ms`}`,
        ]
        return [`${point.date}`, ...lines, ...extras].join('<br/>')
      },
    },
    legend: { data: ['调用量', '成功率'], bottom: 0 },
    grid: { left: 56, right: 56, top: 24, bottom: 56 },
    xAxis: { type: 'category', data: dates },
    yAxis: [
      { type: 'value', name: '调用量', minInterval: 1 },
      {
        type: 'value',
        name: '成功率',
        min: 0,
        max: 100,
        axisLabel: { formatter: '{value}%' },
      },
    ],
    series: [
      {
        name: '调用量',
        type: 'bar',
        barMaxWidth: 32,
        itemStyle: { color: '#91caff', borderRadius: [4, 4, 0, 0] },
        data: data.series.map((p) => p.calls),
      },
      {
        name: '成功率',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        connectNulls: false,
        itemStyle: { color: '#52c41a' },
        data: data.series.map((p) => pct(p.successRate)),
      },
    ],
  }

  return <ReactECharts option={option} style={{ height: 320 }} notMerge />
}
