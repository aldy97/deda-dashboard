import { DatePicker } from 'antd'
import TodayOngoingTag from './TodayOngoingTag'
import {
  RANGE_PRESETS,
  disableFuture,
  includesToday,
} from '../utils/date-range'
import type { DayRange } from '../utils/date-range'

interface Props {
  value: DayRange | null
  /** allowClear=true 时才可能收到 null */
  onChange: (range: DayRange | null) => void
  allowClear?: boolean
  size?: 'small' | 'middle' | 'large'
  placeholder?: [string, string]
}

/**
 * 全 dashboard 统一的日期区间控件。封装铁律：
 * 今日可选（仅禁未来）+ 预设「今日/昨日/近7天/近30天」+ 覆盖今日时标注「今日数据进行中」。
 * 新页面不要绕过本组件直接写 DatePicker.RangePicker。
 */
export default function AnalyticsRangePicker({
  value,
  onChange,
  allowClear = false,
  size,
  placeholder,
}: Props) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <DatePicker.RangePicker
        allowClear={allowClear}
        size={size}
        placeholder={placeholder}
        disabledDate={disableFuture}
        presets={RANGE_PRESETS}
        value={value}
        onChange={(dates) =>
          onChange(dates?.[0] && dates?.[1] ? [dates[0], dates[1]] : null)
        }
      />
      {includesToday(value) && <TodayOngoingTag />}
    </span>
  )
}
