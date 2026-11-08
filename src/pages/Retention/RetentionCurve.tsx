import { Empty } from 'antd'
import ReactECharts from 'echarts-for-react'
import type { RetentionCurveResponse } from '../../types/analytics'

/**
 * 留存曲线：D1/D3/D7/D14/D30/D60/D90 次日及关键日留存。
 * 仅激活满 N 天的设备计入该点分母；无合格设备时后端返回 null（断点显示）。
 */
export default function RetentionCurve({
  data,
}: {
  data: RetentionCurveResponse
}) {
  if (data.points.every((p) => p.rate === null)) {
    return <Empty description="暂无满足条件的留存数据（cohort 均未到期）" />
  }

  const option = {
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value: number | null) =>
        value === null ? '暂无数据' : `${(value * 100).toFixed(1)}%`,
    },
    grid: { left: 56, right: 24, top: 24, bottom: 32 },
    xAxis: {
      type: 'category',
      data: data.points.map((p) => `D${p.day}`),
      boundaryGap: false,
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 1,
      axisLabel: {
        formatter: (value: number) => `${Math.round(value * 100)}%`,
      },
    },
    series: [
      {
        name: '留存率',
        type: 'line',
        smooth: true,
        symbolSize: 8,
        connectNulls: false,
        data: data.points.map((p) => p.rate),
        label: {
          show: true,
          formatter: (params: { value: number | null }) =>
            params.value === null ? '' : `${(params.value * 100).toFixed(1)}%`,
        },
        areaStyle: { opacity: 0.08 },
      },
    ],
  }

  return <ReactECharts option={option} style={{ height: 300 }} notMerge />
}
