import { Empty } from 'antd'
import ReactECharts from 'echarts-for-react'
import type { IntentTrendResponse } from '../../types/analytics'

/**
 * 意图判定趋势：判定轮次（柱）+ 小模型判定数（线）+ 关键词兜底数（线）。
 *
 * 兜底线贴着 0 是健康状态；抬起来说明小模型开始给出非法标签或调用失败，
 * 这些轮次的意图是关键词猜的，不可信。可与「性能监控」tab 的 intent_classify
 * 成功率按时间轴对照定位成因。
 */
export default function IntentTrendChart({
  data,
}: {
  data: IntentTrendResponse
}) {
  if (data.series.length === 0) {
    return <Empty description="所选区间暂无判定记录" />
  }

  const label = (date: string) =>
    data.granularity === 'day' ? date.slice(5) : date

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: (
        params: Array<{ seriesName: string; value: number; dataIndex: number }>,
      ) => {
        const point = data.series[params[0]?.dataIndex ?? 0]
        if (!point) return ''
        const lines = params.map((p) => `${p.seriesName}：${p.value}`)
        const modelRate =
          point.total > 0
            ? `${((point.modelInvoked / point.total) * 100).toFixed(2)}%`
            : '—'
        return [point.date, ...lines, `模型判定率：${modelRate}`].join('<br/>')
      },
    },
    legend: { data: ['判定轮次', '小模型判定', '关键词兜底'], bottom: 0 },
    grid: { left: 56, right: 24, top: 24, bottom: 56 },
    xAxis: { type: 'category', data: data.series.map((p) => label(p.date)) },
    yAxis: { type: 'value', name: '轮次', minInterval: 1 },
    series: [
      {
        name: '判定轮次',
        type: 'bar',
        barMaxWidth: 32,
        itemStyle: { color: '#d9d9d9', borderRadius: [4, 4, 0, 0] },
        data: data.series.map((p) => p.total),
      },
      {
        name: '小模型判定',
        type: 'line',
        smooth: true,
        itemStyle: { color: '#52c41a' },
        data: data.series.map((p) => p.modelInvoked),
      },
      {
        name: '关键词兜底',
        type: 'line',
        smooth: true,
        itemStyle: { color: '#fa541c' },
        data: data.series.map((p) => p.fallbackCount),
      },
    ],
  }

  return <ReactECharts option={option} style={{ height: 320 }} notMerge />
}
