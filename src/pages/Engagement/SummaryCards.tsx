import { Card, Col, Row, Statistic } from 'antd'
import type { EngagementSummaryResponse } from '../../types/analytics'
import InfoTip from '../../components/InfoTip'

/** 秒 → 分钟（1 位小数） */
const toMinutes = (seconds: number) =>
  Math.round((seconds / 60) * 10) / 10

const EstimatedTip = (
  <InfoTip title="估算口径：每条孩子发言 × 0.5 分钟（与小程序家长端学习统计同源），非真实录音时长" />
)

const DurationP50Tip = (
  <InfoTip title="每台活跃设备的估算时长（发言轮次 × 0.5 分钟，非真实录音时长）排序后取中位数，反映典型设备、不被重度用户拉高" />
)

const DurationP90Tip = (
  <InfoTip title="每台活跃设备的估算时长（发言轮次 × 0.5 分钟，非真实录音时长）排序后取 90 分位，反映重度使用设备的上限" />
)

const TurnsP50Tip = (
  <InfoTip title="每台活跃设备发言轮次的中位数；与人均轮次对照可看使用是否两极分化" />
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
      title: <>人均使用时长 {EstimatedTip}</>,
      value: toMinutes(data.avgDurationSecondsPerDevice),
      suffix: '分钟',
    },
    {
      title: <>时长 P50 {DurationP50Tip}</>,
      value: toMinutes(data.durationP50Seconds),
      suffix: '分钟',
    },
    {
      title: <>时长 P90 {DurationP90Tip}</>,
      value: toMinutes(data.durationP90Seconds),
      suffix: '分钟',
    },
    { title: '人均对话轮次', value: data.avgTurnsPerDevice, suffix: '轮' },
    {
      title: <>轮次 P50 {TurnsP50Tip}</>,
      value: data.turnsP50,
      suffix: '轮',
    },
    { title: '人均活跃天数', value: data.avgActiveDaysPerDevice, suffix: '天' },
    { title: '总对话轮次', value: data.totalTurns, suffix: '轮' },
  ]

  return (
    <Row gutter={[16, 16]}>
      {cards.map((card, index) => (
        <Col xs={12} md={8} lg={6} key={index}>
          <Card size="small" style={{ height: '100%' }}>
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
