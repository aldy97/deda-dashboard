import { Card, Col, Row, Statistic, Tag, Tooltip, Typography } from 'antd'
import type { OverviewResponse } from '../../types/analytics'

function pct(value: number | null): string {
  if (value === null) return '-'
  return `${(value * 100).toFixed(1)}%`
}

/** 环比标签：正绿负红，null/0 灰色 */
function DeltaTag({ value }: { value: number | null }) {
  if (value === null || value === 0) {
    return <Tag style={{ marginTop: 8 }}>环比持平</Tag>
  }
  const up = value > 0
  return (
    <Tag color={up ? 'green' : 'red'} style={{ marginTop: 8 }}>
      环比 {up ? '+' : ''}
      {value.toFixed(1)}%
    </Tag>
  )
}

export default function KpiCards({ data }: { data: OverviewResponse }) {
  const { totals, today, retention } = data
  return (
    <Row gutter={[16, 16]}>
      <Col xs={12} md={6}>
        <Card>
          <Statistic
            title="累计激活设备"
            value={totals.devicesActivated}
            suffix="台"
          />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            累计入库 {totals.devicesRegistered} 台
          </Typography.Text>
        </Card>
      </Col>
      <Col xs={12} md={6}>
        <Card>
          <Tooltip title="分母为已入库设备数；接入出货数据后切换为出货口径">
            <Statistic title="激活率" value={pct(totals.activationRate)} />
          </Tooltip>
        </Card>
      </Col>
      <Col xs={12} md={6}>
        <Card>
          <Statistic
            title="累计家长用户"
            value={totals.usersRegistered}
            suffix="人"
          />
        </Card>
      </Col>
      <Col xs={12} md={6}>
        <Card>
          <Statistic
            title="活跃设备（当日）"
            value={today.dau}
            suffix="台"
          />
          <DeltaTag value={today.dauDeltaPct} />
        </Card>
      </Col>
      <Col xs={12} md={6}>
        <Card>
          <Statistic
            title="活跃设备日均使用时长"
            value={Math.round(today.avgDurationSecondsPerActiveDevice / 60)}
            suffix="分钟"
          />
          <Tag style={{ marginTop: 8 }}>估算口径</Tag>
        </Card>
      </Col>
      <Col xs={12} md={6}>
        <Card>
          <Statistic
            title="人均对话轮次"
            value={today.avgTurnsPerActiveDevice}
            suffix="轮"
          />
        </Card>
      </Col>
      <Col xs={12} md={6}>
        <Card>
          <Tooltip title="激活日为 7 天前的设备中，当日仍有对话的比例">
            <Statistic title="7 日留存" value={pct(retention.d7)} />
          </Tooltip>
        </Card>
      </Col>
      <Col xs={12} md={6}>
        <Card>
          <Statistic
            title="实时在线"
            value={today.onlineNow ?? '-'}
            suffix={today.onlineNow !== null ? '台' : ''}
          />
          <Tag style={{ marginTop: 8 }}>二期接入</Tag>
        </Card>
      </Col>
    </Row>
  )
}
