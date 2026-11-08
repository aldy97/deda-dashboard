import { Card, Col, Row, Statistic, Tooltip } from 'antd'
import type { EngagementSummaryResponse } from '../../types/analytics'

/** 秒 → 分钟（1 位小数） */
const toMinutes = (seconds: number) =>
  Math.round((seconds / 60) * 10) / 10

const EstimatedTag = (
  <Tooltip title="估算口径：每条对话 × 0.5 分钟">
    <span style={{ color: '#fa8c16', fontSize: 12 }}>估算</span>
  </Tooltip>
)

/**
 * 使用行为汇总 KPI：区间口径。
 * 时长类字段为估算（estimated），卡片标题固定标注。
 */
export default function SummaryCards({
  data,
}: {
  data: EngagementSummaryResponse
}) {
  const cards = [
    { title: '活跃设备', value: data.activeDevices, suffix: '台' },
    {
      title: <>人均使用时长 {EstimatedTag}</>,
      value: toMinutes(data.avgDurationSecondsPerDevice),
      suffix: '分钟',
    },
    {
      title: <>时长 P50 {EstimatedTag}</>,
      value: toMinutes(data.durationP50Seconds),
      suffix: '分钟',
    },
    {
      title: <>时长 P90 {EstimatedTag}</>,
      value: toMinutes(data.durationP90Seconds),
      suffix: '分钟',
    },
    { title: '人均对话轮次', value: data.avgTurnsPerDevice, suffix: '轮' },
    { title: '轮次 P50', value: data.turnsP50, suffix: '轮' },
    { title: '人均活跃天数', value: data.avgActiveDaysPerDevice, suffix: '天' },
    { title: '总对话轮次', value: data.totalTurns, suffix: '轮' },
  ]

  return (
    <Row gutter={[16, 16]}>
      {cards.map((card, index) => (
        <Col xs={12} md={8} lg={6} key={index}>
          <Card size="small">
            <Statistic
              title={card.title}
              value={card.value}
              suffix={card.suffix}
            />
          </Card>
        </Col>
      ))}
    </Row>
  )
}
