import { Empty } from 'antd'
import ReactECharts from 'echarts-for-react'
import type { SafetyTrendResponse } from '../../types/analytics'

/**
 * 安全判定趋势：判定轮次（柱，左轴）+ 拦截率（线，右轴 %）
 * + 三类「放行了但没真审」的计数（线，左轴）。
 *
 * 三类未审计放行单独画线是这张图的重点：它们不会报错、不会掉成功率，
 * 只看拦截率完全发现不了。升高分别对应模型不可用（fail_open）、
 * prompt 退化（invalid_label）、冒险编排盲区扩大（not_evaluated）。
 */
export default function SafetyTrendChart({
  data,
}: {
  data: SafetyTrendResponse
}) {
  if (data.series.length === 0) {
    return <Empty description="所选区间暂无判定记录" />
  }

  const label = (date: string) =>
    data.granularity === 'day' ? date.slice(5) : date
  // 后端 blockRate 为 null（该桶 total=0）时保持 null，不补 0：
  // 补 0 会在图上画成「拦截率跌到 0」，与「当天没有数据」是两件事
  const pct = (rate: number | null) =>
    rate === null ? null : Math.round(rate * 10000) / 100

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: (
        params: Array<{ seriesName: string; value: number | null; dataIndex: number }>,
      ) => {
        const point = data.series[params[0]?.dataIndex ?? 0]
        if (!point) return ''
        const lines = params.map((p) => {
          // 百分号只跟着有值的拦截率走：null 是「当天没数据」，拼成「暂无数据%」会被读成 0%
          if (p.value === null) return `${p.seriesName}：暂无数据`
          return `${p.seriesName}：${p.value}${p.seriesName === '拦截率' ? '%' : ''}`
        })
        return [
          point.date,
          ...lines,
          `情绪伤害：${point.emotionalHarmCount}`,
        ].join('<br/>')
      },
    },
    legend: {
      data: ['判定轮次', '拦截率', '调用异常放行', '非法标签放行', '未做 L2'],
      bottom: 0,
    },
    grid: { left: 56, right: 56, top: 24, bottom: 56 },
    xAxis: { type: 'category', data: data.series.map((p) => label(p.date)) },
    yAxis: [
      { type: 'value', name: '轮次', minInterval: 1 },
      {
        type: 'value',
        name: '拦截率',
        min: 0,
        axisLabel: { formatter: '{value}%' },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: '判定轮次',
        type: 'bar',
        barMaxWidth: 32,
        itemStyle: { color: '#d9d9d9', borderRadius: [4, 4, 0, 0] },
        data: data.series.map((p) => p.total),
      },
      {
        name: '拦截率',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        connectNulls: false,
        itemStyle: { color: '#cf1322' },
        data: data.series.map((p) => pct(p.blockRate)),
      },
      {
        name: '调用异常放行',
        type: 'line',
        smooth: true,
        connectNulls: false,
        itemStyle: { color: '#fa8c16' },
        data: data.series.map((p) => p.failOpenCount),
      },
      {
        name: '非法标签放行',
        type: 'line',
        smooth: true,
        connectNulls: false,
        itemStyle: { color: '#fa541c' },
        data: data.series.map((p) => p.invalidLabelCount),
      },
      {
        name: '未做 L2',
        type: 'line',
        smooth: true,
        connectNulls: false,
        lineStyle: { type: 'dashed' },
        itemStyle: { color: '#8c8c8c' },
        data: data.series.map((p) => p.notEvaluatedCount),
      },
    ],
  }

  return <ReactECharts option={option} style={{ height: 320 }} notMerge />
}
