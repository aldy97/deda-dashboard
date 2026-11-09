import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

/**
 * 全 dashboard 唯一日期口径（参考模型监控页约定）：
 * - 时区统一 Asia/Shanghai（setDefault 影响此后所有 dayjs()，含时间戳渲染）；
 * - 「今日」一律可选，仅禁选未来日期；
 * - 默认区间含今日；today() 每次调用重新求值，避免页面挂过夜后跨午夜陈旧。
 */
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Shanghai')

export type DayRange = [Dayjs, Dayjs]

export const fmt = (d: Dayjs) => d.format('YYYY-MM-DD')

/** 今日零点（Asia/Shanghai），每次调用实时求值 */
export const today = () => dayjs().startOf('day')

/** 默认区间：近 days 个自然日且含今日，如 defaultRange(7) = [today-6, today] */
export const defaultRange = (days: number): DayRange => [
  today().subtract(days - 1, 'day'),
  today(),
]

/** 唯一禁用规则：今日可选，仅禁未来 */
export const disableFuture = (d: Dayjs) => d.isAfter(today(), 'day')

/** 区间是否覆盖今日（用于「今日数据进行中」标注） */
export const includesToday = (r: DayRange | null): boolean =>
  !!r && !r[0].isAfter(today(), 'day') && !r[1].isBefore(today(), 'day')

export const isToday = (d: Dayjs | null): boolean =>
  !!d && d.isSame(today(), 'day')

/**
 * RangePicker 预设。value 用函数形式，点击时才求值（跨午夜安全）。
 * 「今日」放第一位：今日是所有日期 filter 的可选重点。
 */
export const RANGE_PRESETS: Array<{
  label: string
  value: () => DayRange
}> = [
  { label: '今日', value: () => [today(), today()] },
  {
    label: '昨日',
    value: () => {
      const y = today().subtract(1, 'day')
      return [y, y]
    },
  },
  { label: '近 7 天', value: () => defaultRange(7) },
  { label: '近 30 天', value: () => defaultRange(30) },
]
