import { Empty } from 'antd'
import ReactECharts from 'echarts-for-react'
import type { DailyTurn } from '../../types/analytics'

/**
 * 单设备对话趋势折线（设备舰队抽屉与设备档案页共用）。
 *
 * 后端已按区间补 0，前端不再补点：无数据走 Empty，不画一张全 0 的假趋势
 * （那会读成「设备一直开着但孩子没说话」，与「没有数据」是两件事）。
 * 纵轴 min=0 且 minInterval=1——对话轮次是整数，0.5 轮的刻度线是假的。
 */
export default function DailyTurnsChart({
  dailyTurns,
}: {
  dailyTurns: DailyTurn[]
}) {
  if (dailyTurns.length === 0) {
    return (
      <Empty description="暂无对话数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
    )
  }

  // 横轴只取 MM-DD：回看窗口最长 90 天，带年份会挤成一团
  const dates = dailyTurns.map((p) => p.date.slice(5))

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: Array<{ value: number; dataIndex: number }>) => {
        const idx = params[0]?.dataIndex ?? 0
        const point = dailyTurns[idx]
        // 数据刷新瞬间 echarts 可能带着旧索引回调，越界时给空串而不是抛
        if (!point) return ''
        return `${point.date}<br/>对话轮次：${point.turns} 轮`
      },
    },
    grid: { left: 48, right: 24, top: 16, bottom: 32 },
    xAxis: { type: 'category', data: dates, boundaryGap: false },
    yAxis: { type: 'value', name: '轮', minInterval: 1, min: 0 },
    series: [
      {
        type: 'line',
        smooth: true,
        showSymbol: false,
        itemStyle: { color: '#1677ff' },
        areaStyle: { color: 'rgba(22, 119, 255, 0.08)' },
        data: dailyTurns.map((p) => p.turns),
      },
    ],
  }

  return <ReactECharts option={option} style={{ height: 240 }} notMerge />
}
