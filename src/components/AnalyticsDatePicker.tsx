import { DatePicker } from 'antd'
import type { Dayjs } from 'dayjs'
import TodayOngoingTag from './TodayOngoingTag'
import { disableFuture, isToday } from '../utils/date-range'

interface Props {
  value: Dayjs | null
  onChange: (date: Dayjs | null) => void
  allowClear?: boolean
  size?: 'small' | 'middle' | 'large'
}

/**
 * 单日口径的统一日期控件（如使用行为页的「单日」、总览页 KPI 日期）。
 * 与 AnalyticsRangePicker 同一套铁律：今日可选、仅禁未来、选中今日时标注进行中。
 */
export default function AnalyticsDatePicker({
  value,
  onChange,
  allowClear = false,
  size,
}: Props) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <DatePicker
        allowClear={allowClear}
        size={size}
        disabledDate={disableFuture}
        value={value}
        onChange={(d) => onChange(d)}
      />
      {isToday(value) && <TodayOngoingTag />}
    </span>
  )
}
