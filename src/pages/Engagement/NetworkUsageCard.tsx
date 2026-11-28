import { Col, Empty, Row, Statistic, Typography } from 'antd'
import ReactECharts from 'echarts-for-react'
import type { NetworkUsageResponse } from '../../types/analytics'
import InfoTip from '../../components/InfoTip'

const pct = (value: number | null): string =>
  value === null ? '—' : `${(value * 100).toFixed(1)}%`

const percent = (value: number, total: number): number =>
  total > 0 ? Math.round((value / total) * 1000) / 10 : 0

/**
 * 对话网络分布：WiFi / 4G / 未知。
 * 数据源是服务端 conversation_network_daily，删除 messages 不影响本卡片。
 */
export default function NetworkUsageCard({
  data,
}: {
  data: NetworkUsageResponse
}) {
  if (data.totalTurns === 0) {
    return <Empty description="所选区间暂无对话数据" />
  }

  if (data.knownTurns === 0) {
    return (
      <div>
        <Empty description="暂无网络归属数据（老固件/上线前）" />
        <Typography.Paragraph type="secondary" style={{ textAlign: 'center' }}>
          未知 {data.unknownTurns} 轮；涉及 {data.deviceCount} 台设备
        </Typography.Paragraph>
      </div>
    )
  }

  const donutOption = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} 轮（{d}%）' },
    legend: { type: 'scroll', bottom: 0 },
    series: [
      {
        name: '对话网络',
        type: 'pie',
        radius: ['45%', '68%'],
        center: ['50%', '45%'],
        label: { formatter: '{b}\n{c} 轮' },
        data: [
          { name: 'WiFi', value: data.wifi.turns },
          { name: '4G', value: data.fourG.turns },
        ],
      },
    ],
  }

  const dates = data.series.map((point) => point.date.slice(5))
  const stackedOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { type: 'scroll', bottom: 0 },
    grid: { left: 48, right: 24, top: 24, bottom: 48 },
    xAxis: { type: 'category', data: dates },
    yAxis: {
      type: 'value',
      name: '占比',
      max: 100,
      axisLabel: { formatter: '{value}%' },
    },
    series: [
      {
        name: 'WiFi',
        type: 'bar',
        stack: 'network',
        data: data.series.map((point) =>
          percent(
            point.wifiTurns,
            point.wifiTurns + point.fourGTurns + point.unknownTurns,
          ),
        ),
      },
      {
        name: '4G',
        type: 'bar',
        stack: 'network',
        data: data.series.map((point) =>
          percent(
            point.fourGTurns,
            point.wifiTurns + point.fourGTurns + point.unknownTurns,
          ),
        ),
      },
      {
        name: '未知',
        type: 'bar',
        stack: 'network',
        data: data.series.map((point) =>
          percent(
            point.unknownTurns,
            point.wifiTurns + point.fourGTurns + point.unknownTurns,
          ),
        ),
      },
    ],
  }

  return (
    <div>
      <Row gutter={[16, 16]} align="middle">
        <Col xs={24} md={10}>
          <ReactECharts option={donutOption} style={{ height: 280 }} notMerge />
        </Col>
        <Col xs={24} md={14}>
          <Row gutter={[16, 16]}>
            <Col span={8}>
              <Statistic title="WiFi 占比" value={pct(data.wifi.shareOfKnown)} />
            </Col>
            <Col span={8}>
              <Statistic
                title="4G 占比"
                value={pct(data.fourG.shareOfKnown)}
              />
            </Col>
            <Col span={8}>
              <Statistic title="网络覆盖" value={pct(data.coverage)} />
            </Col>
          </Row>
          <Typography.Paragraph
            type="secondary"
            style={{ marginTop: 12, marginBottom: 0 }}
          >
            已归因 {data.knownTurns} / {data.totalTurns} 轮；未知{' '}
            {data.unknownTurns} 轮；涉及 {data.deviceCount} 台设备
          </Typography.Paragraph>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            网络取对话发起时设备最近一次上报；未知 = 老固件 / 切网 / 离线。
            <InfoTip title="数据来自对话落库时的日聚合表，删除 messages 不影响本卡片；比例分母为已知轮次（WiFi+4G）" />
          </Typography.Paragraph>
        </Col>
      </Row>

      {data.series.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Typography.Text type="secondary">按日网络占比</Typography.Text>
          <ReactECharts
            option={stackedOption}
            style={{ height: 260 }}
            notMerge
          />
        </div>
      )}
    </div>
  )
}
