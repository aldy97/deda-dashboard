import ReactECharts from 'echarts-for-react'
import { Empty } from 'antd'
import type { OverviewTrendResponse } from '../../types/analytics'

/**
 * 主趋势图：活跃设备 / 当日开机 / 新增激活 / 新增用户（左轴，计数）+
 * 日均使用时长（右轴，分钟，估算口径）。legend 可点击隐藏指标。
 * 「当日开机」为天级口径（device_presence_daily），早于落库上线日为 null，
 * 用断点而非补 0 表示，与实时口径的「实时在线」不可互相校验。
 */
export default function TrendChart({ data }: { data: OverviewTrendResponse }) {
  const series = data.series
  if (series.length === 0) {
    return <Empty description="所选区间暂无数据" />
  }

  const dates = series.map((point) => point.date.slice(5))
  const minutes = (seconds?: number) =>
    seconds === undefined ? null : Math.round((seconds / 60) * 10) / 10

  const option = {
    tooltip: { trigger: 'axis' },
    legend: {
      data: ['活跃设备', '当日开机', '新增激活', '新增用户', '日均使用时长'],
      bottom: 0,
    },
    grid: { left: 48, right: 48, top: 24, bottom: 56 },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: false,
    },
    yAxis: [
      { type: 'value', name: '台 / 人', minInterval: 1 },
      { type: 'value', name: '分钟', min: 0 },
    ],
    series: [
      {
        name: '活跃设备',
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: series.map((point) => point.dau ?? 0),
      },
      {
        name: '当日开机',
        type: 'line',
        smooth: true,
        showSymbol: false,
        // null = 该日早于 device_presence_daily 落库上线日，留断点不补 0
        connectNulls: false,
        lineStyle: { type: 'dotted' },
        data: series.map((point) => point.devicesPoweredOn ?? null),
      },
      {
        name: '新增激活',
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: series.map((point) => point.newActivatedDevices ?? 0),
      },
      {
        name: '新增用户',
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: series.map((point) => point.newUsers ?? 0),
      },
      {
        name: '日均使用时长',
        type: 'line',
        smooth: true,
        showSymbol: false,
        yAxisIndex: 1,
        lineStyle: { type: 'dashed' },
        data: series.map((point) => minutes(point.avgDurationSeconds)),
      },
    ],
  }

  return <ReactECharts option={option} style={{ height: 360 }} notMerge />
}
