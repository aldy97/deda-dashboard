import { Empty } from 'antd'
import ReactECharts from 'echarts-for-react'
import type { ModeUsageResponse } from '../../types/analytics'

/** 与 MINI_PROGRAM_API.md 已知模式映射一致 */
const MODE_LABELS: Record<string, string> = {
  free_chat: '自由对话',
  english_chat: '英语对话',
  adventure_story: '每日冒险',
  english_story: '英语故事',
  idiom_story: '成语故事',
  free_story: '自由故事',
  sleep_story: '哄睡故事',
  unknown: '其他',
}

function labelOf(mode: string, conversationModeKey: string | null): string {
  const key = conversationModeKey ?? mode
  return MODE_LABELS[key] ?? key
}

/**
 * 模式分布：按日堆叠柱状图，柱高 = 当天各模式对话轮次（role=user 消息数）。
 * 子模式（conversationModeKey）优先于 mode 作为分类标签。
 */
export default function ModeUsageChart({ data }: { data: ModeUsageResponse }) {
  if (data.series.length === 0) {
    return <Empty description="所选区间暂无对话数据" />
  }

  const dates = data.series.map((day) => day.date)
  // 收集区间内出现过的全部模式标签，保持首次出现顺序
  const labels: string[] = []
  for (const day of data.series) {
    for (const m of day.modes) {
      const label = labelOf(m.mode, m.conversationModeKey)
      if (!labels.includes(label)) labels.push(label)
    }
  }

  const option = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { type: 'scroll', bottom: 0 },
    grid: { left: 48, right: 24, top: 24, bottom: 56 },
    xAxis: {
      type: 'category',
      data: dates.map((d) => d.slice(5)),
    },
    yAxis: { type: 'value', name: '轮次', minInterval: 1 },
    series: labels.map((label) => ({
      name: label,
      type: 'bar',
      stack: 'turns',
      emphasis: { focus: 'series' },
      data: data.series.map((day) => {
        const hit = day.modes.find(
          (m) => labelOf(m.mode, m.conversationModeKey) === label,
        )
        return hit?.turns ?? 0
      }),
    })),
  }

  return <ReactECharts option={option} style={{ height: 320 }} notMerge />
}
