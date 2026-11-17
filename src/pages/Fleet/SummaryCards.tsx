import { Card, Col, Row, Statistic, Typography } from 'antd'
import type { FleetSummaryResponse } from '../../types/analytics'
import InfoTip from '../../components/InfoTip'

function pct(value: number | null): string {
  if (value === null) return '-'
  return `${(value * 100).toFixed(1)}%`
}

function nullStat(value: number | null): string | number {
  return value === null ? '-' : value
}

/**
 * 舰队概览卡片行：7 张指标卡，分别标注天级/实时口径。
 * presenceSince 为 null 或日期早于其时，天级卡片显示「-」并提示尚未开始落库。
 */
export default function SummaryCards({ data }: { data: FleetSummaryResponse }) {
  const {
    totalDevices,
    activatedDevices,
    devicesPoweredOn,
    powerOnRate,
    onlineNow,
    lowBatteryNow,
    lowBatteryThreshold,
    presenceSince,
  } = data

  const noPresenceData = presenceSince === null

  return (
    <Row gutter={[16, 16]}>
      {/* 总设备数 */}
      <Col xs={12} md={6} lg={3}>
        <Card style={{ height: '100%' }}>
          <Statistic title="总设备数" value={totalDevices} suffix="台" />
        </Card>
      </Col>

      {/* 已激活 */}
      <Col xs={12} md={6} lg={3}>
        <Card style={{ height: '100%' }}>
          <Statistic
            title={
              <>
                已激活
                <InfoTip title="userDeviceBinding distinct deviceId 计数，与 engagement 同口径" />
              </>
            }
            value={activatedDevices}
            suffix="台"
          />
        </Card>
      </Col>

      {/* 当日开机（天级） */}
      <Col xs={12} md={6} lg={3}>
        <Card style={{ height: '100%' }}>
          <Statistic
            title={
              <>
                当日开机
                <InfoTip title="天级口径：当日 device_presence_daily 有上报记录的去重台数。presenceSince 之前的数据尚未落库，显示 -。" />
              </>
            }
            value={nullStat(devicesPoweredOn)}
            suffix={devicesPoweredOn !== null ? '台' : ''}
          />
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            天级口径
            {noPresenceData && (
              <>
                {' · '}
                <Typography.Text type="warning" style={{ fontSize: 11 }}>
                  尚未开始落库
                </Typography.Text>
                <InfoTip title="device_presence_daily 表为空（presenceSince 为 null），天级指标暂无数据。待 presence 日志开始落库后会自动出现。" />
              </>
            )}
          </Typography.Text>
        </Card>
      </Col>

      {/* 开机率 */}
      <Col xs={12} md={6} lg={3}>
        <Card style={{ height: '100%' }}>
          <Statistic
            title={
              <>
                开机率
                <InfoTip title="天级口径：当日开机台数 ÷ 已激活设备数。分母 0 或分子 null → null（显示 -）。" />
              </>
            }
            value={pct(powerOnRate)}
          />
          {noPresenceData && (
            <Typography.Text type="warning" style={{ fontSize: 11 }}>
              尚未开始落库
              <InfoTip title="device_presence_daily 表为空（presenceSince 为 null），天级指标暂无数据。" />
            </Typography.Text>
          )}
        </Card>
      </Col>

      {/* 实时在线（15 秒窗口） */}
      <Col xs={12} md={6} lg={3}>
        <Card style={{ height: '100%' }}>
          <Statistic
            title={
              <>
                实时在线
                <InfoTip title="实时口径：Redis device:link:{MAC} 的 lastSeenAt 落在 15 秒窗口内的设备数。Redis 查询失败 → null（显示 -）。" />
              </>
            }
            value={nullStat(onlineNow)}
            suffix={onlineNow !== null ? '台' : ''}
          />
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            15 秒窗口（实时）
          </Typography.Text>
        </Card>
      </Col>

      {/* 低电量 */}
      <Col xs={12} md={6} lg={3}>
        <Card style={{ height: '100%' }}>
          <Statistic
            title={
              <>
                低电量
                <InfoTip
                  title={`在线设备中 battery ≤ ${lowBatteryThreshold} 的台数；battery 为 null 的设备不计入。仅统计在线设备（15 秒窗口）。`}
                />
              </>
            }
            value={nullStat(lowBatteryNow)}
            suffix={lowBatteryNow !== null ? '台' : ''}
          />
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            ≤{lowBatteryThreshold}%（仅在线）
          </Typography.Text>
        </Card>
      </Col>
    </Row>
  )
}
