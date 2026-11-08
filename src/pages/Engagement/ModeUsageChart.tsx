import { Empty } from 'antd'
import ReactECharts from 'echarts-for-react'
import type { ModeUsageResponse } from '../../types/analytics'

/** 与 deda-wechat-app learning-data.ts 的 MODE_LABELS 完全一致（唯一映射来源，勿自行增改） */
const MODE_LABELS: Record<string, string> = {
  free_chat: '自由对话',
  free_chat_casual: '自由闲聊',
  free_chat_roleplay: '角色扮演',
  free_chat_qa: '百科问答',
  english_chat: '英语对话',
  english_story: '英语故事',
  idiom_story: '成语故事',
  adventure_story: '冒险故事',
  free_story: '自由故事',
  daily_adventure: '每日冒险',
  adventure: '每日冒险',
  story: '故事',
  sleep: '哄睡故事',
  sleep_story: '哄睡故事',
  bedtime: '哄睡故事',
  music: '音乐',
  device_control: '设备控制',
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
