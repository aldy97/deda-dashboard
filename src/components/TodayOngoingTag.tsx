import { Tag, Tooltip } from 'antd'

/**
 * 「今日数据进行中」标注：凡日期 filter 覆盖今日时展示。
 * 今日是未闭环的自然日，指标（DAU、时长估算、留存等）会随时间继续累积，
 * 不能与完整自然日直接对比。
 */
export default function TodayOngoingTag() {
  return (
    <Tooltip title="今日为进行中的自然日，指标未闭环，请勿与完整日直接对比">
      <Tag color="gold" style={{ marginInlineEnd: 0 }}>
        今日数据进行中
      </Tag>
    </Tooltip>
  )
}
