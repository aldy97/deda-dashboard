import { Empty } from 'antd'
import ReactECharts from 'echarts-for-react'
import type { DurationDistributionResponse } from '../../types/analytics'

/** 后端分桶 key → 展示顺序与中文标签 */
const BUCKET_ORDER: Array<{ key: string; label: string }> = [
  { key: '0-5min', label: '0-5 分钟' },
  { key: '5-15min', label: '5-15 分钟' },
  { key: '15-30min', label: '15-30 分钟' },
  { key: '30-60min', label: '30-60 分钟' },
  { key: '60min+', label: '60 分钟以上' },
]

/**
 * 单日使用时长分桶分布（估算口径）：柱状图，柱高 = 设备数。
 */
export default function DurationDistributionChart({
  data,
}: {
  data: DurationDistributionResponse
}) {
  if (data.buckets.every((b) => b.devices === 0)) {
    return <Empty description="该日暂无使用数据" />
  }

  const countOf = (key: string) =>
    data.buckets.find((b) => b.range === key)?.devices ?? 0

  const option = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 48, right: 24, top: 24, bottom: 32 },
    xAxis: {
      type: 'category',
      data: BUCKET_ORDER.map((b) => b.label),
      axisLabel: { interval: 0 },
    },
    yAxis: { type: 'value', name: '设备数', minInterval: 1 },
    series: [
      {
        type: 'bar',
        barMaxWidth: 48,
        label: { show: true, position: 'top' },
        itemStyle: { color: '#1677ff', borderRadius: [4, 4, 0, 0] },
        data: BUCKET_ORDER.map((b) => countOf(b.key)),
      },
    ],
  }

  return <ReactECharts option={option} style={{ height: 300 }} notMerge />
}
