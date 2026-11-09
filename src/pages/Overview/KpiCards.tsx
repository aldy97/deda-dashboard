import { Card, Col, Row, Statistic, Tag, Typography } from 'antd'
import type { OverviewResponse } from '../../types/analytics'
import InfoTip from '../../components/InfoTip'

function pct(value: number | null): string {
  if (value === null) return '-'
  return `${(value * 100).toFixed(1)}%`
}

/** 环比标签：正绿负红，null/0 灰色 */
function DeltaTag({ value }: { value: number | null }) {
  return (
    <>
      {value === null || value === 0 ? (
        <Tag style={{ marginTop: 8 }}>环比持平</Tag>
      ) : (
        <Tag color={value > 0 ? 'green' : 'red'} style={{ marginTop: 8 }}>
          环比 {value > 0 ? '+' : ''}
          {value.toFixed(1)}%
        </Tag>
      )}
      <InfoTip title="与前一自然日的活跃设备数相比；前一日活跃为 0 时无法计算，显示持平" />
    </>
  )
}

export default function KpiCards({ data }: { data: OverviewResponse }) {
  const { totals, today, retention } = data
  return (
    <Row gutter={[16, 16]}>
      <Col xs={12} md={6}>
        <Card style={{ height: '100%' }}>
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
        <Card style={{ height: '100%' }}>
          <Statistic
            title={
              <>
                激活率
                <InfoTip title="已激活设备 ÷ 已入库设备。「激活」= 家长扫码完成绑定（user_device_bindings 有记录）；接入出货数据后分母切换为出货口径" />
              </>
              }
            value={pct(totals.activationRate)}
          />
        </Card>
      </Col>
      <Col xs={12} md={6}>
        <Card style={{ height: '100%' }}>
          <Statistic
            title="累计家长用户"
            value={totals.usersRegistered}
            suffix="人"
          />
        </Card>
      </Col>
      <Col xs={12} md={6}>
        <Card style={{ height: '100%' }}>
          <Statistic
            title={
              <>
                活跃设备（当日）
                <InfoTip title="DAU 口径：当天有 ≥1 条孩子发言（role=user 消息）的去重设备数，按 Asia/Shanghai 自然日统计" />
              </>
              }
            value={today.dau}
            suffix="台"
          />
          <DeltaTag value={today.dauDeltaPct} />
        </Card>
      </Col>
      <Col xs={12} md={6}>
        <Card style={{ height: '100%' }}>
          <Statistic
            title="活跃设备日均使用时长"
            value={Math.round(today.avgDurationSecondsPerActiveDevice / 60)}
            suffix="分钟"
          />
          <Tag style={{ marginTop: 8 }}>估算口径</Tag>
        </Card>
      </Col>
      <Col xs={12} md={6}>
        <Card style={{ height: '100%' }}>
          <Statistic
            title="人均对话轮次"
            value={today.avgTurnsPerActiveDevice}
            suffix="轮"
          />
        </Card>
      </Col>
      <Col xs={12} md={6}>
        <Card style={{ height: '100%' }}>
          <Statistic
            title={
              <>
                7 日留存
                <InfoTip title="激活日恰好为 7 天前的设备中，数据日当天仍有对话的比例；当天没有「满 7 天」的设备时显示 -" />
              </>
              }
            value={pct(retention.d7)}
          />
        </Card>
      </Col>
      <Col xs={12} md={6}>
        <Card style={{ height: '100%' }}>
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
