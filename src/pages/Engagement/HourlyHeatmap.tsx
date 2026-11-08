import { Empty } from 'antd'
import ReactECharts from 'echarts-for-react'
import type { HourlyHeatmapResponse } from '../../types/analytics'

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

/**
 * 7×24 时段热力图：行 = 星期（周一=0，与后端 grid 行序一致），列 = 小时。
 * 格子值 = 该时段活跃设备数（区间内去重）。
 */
export default function HourlyHeatmap({
  data,
}: {
  data: HourlyHeatmapResponse
}) {
  if (data.maxValue === 0) {
    return <Empty description="所选区间暂无活跃数据" />
  }

  const cells: Array<[number, number, number]> = []
  data.grid.forEach((row, weekday) => {
    row.forEach((value, hour) => {
      cells.push([hour, weekday, value])
    })
  })

  const option = {
    tooltip: {
      formatter: (params: { value: [number, number, number] }) =>
        `${WEEKDAYS[params.value[1]]} ${params.value[0]}:00-${params.value[0] + 1}:00<br/>活跃设备：${params.value[2]} 台`,
    },
    grid: { left: 56, right: 16, top: 16, bottom: 64 },
    xAxis: {
      type: 'category',
      data: Array.from({ length: 24 }, (_, h) => `${h}`),
      name: '时',
      splitArea: { show: true },
    },
    yAxis: {
      type: 'category',
      data: WEEKDAYS,
      splitArea: { show: true },
    },
    visualMap: {
      min: 0,
      max: data.maxValue,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      inRange: { color: ['#f0f5ff', '#1677ff'] },
    },
    series: [
      {
        type: 'heatmap',
        data: cells,
        label: { show: false },
        emphasis: {
          itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0, 0, 0, 0.3)' },
        },
      },
    ],
  }

  return <ReactECharts option={option} style={{ height: 340 }} notMerge />
}
