import type { ModeUsageResponse } from '../../types/analytics'

/**
 * 使用行为页 → 消息明细页的模式下钻链接。
 *
 * 抽成纯函数是因为「哪些模式该出现链接」这件事有两处会用到（模式分布卡下方、
 * 功能渗透率表），而且它是可枚举的口径问题：图表按日铺开，同一个 mode 会在多天
 * 重复出现，链接只该出现一次。
 */

/** 去重保序：顺序沿用各 mode 在区间内首次出现的日期，与图表图例的视觉顺序一致 */
export function uniqueModes(data: ModeUsageResponse | null): string[] {
  if (!data) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const day of data.series) {
    for (const item of day.modes) {
      if (!seen.has(item.mode)) {
        seen.add(item.mode)
        result.push(item.mode)
      }
    }
  }
  return result
}

/**
 * 带区间的消息明细链接。
 * 区间必须一起带过去：否则从「近 30 天模式分布」跳到消息明细会落回默认近 7 天，
 * 两边的数字对不上，看起来像数据错了。
 */
export function messagesModeLink(
  mode: string,
  startDate: string,
  endDate: string,
): string {
  return `/messages?mode=${encodeURIComponent(mode)}&startDate=${startDate}&endDate=${endDate}`
}
