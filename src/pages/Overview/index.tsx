import { useState } from 'react'
import { Alert, Button, Card, Col, Radio, Row, Spin, Typography } from 'antd'
import type { Dayjs } from 'dayjs'
import { useOverview, useOverviewTrend } from '../../api/queries'
import AnalyticsDatePicker from '../../components/AnalyticsDatePicker'
import TodayOngoingTag from '../../components/TodayOngoingTag'
import { defaultRange, fmt, today } from '../../utils/date-range'
import KpiCards from './KpiCards'
import TrendChart from './TrendChart'
import FunnelChart from './FunnelChart'

const RANGE_OPTIONS = [
  { label: '近 7 天', value: 7 },
  { label: '近 14 天', value: 14 },
  { label: '近 30 天', value: 30 },
]

/**
 * 总览页（P1）：核心 KPI 卡 + 主趋势图 + 激活漏斗。
 * KPI 日期与趋势区间均含今日（可切回历史日期）；今日数据为进行中口径，已标注。
 */
export default function Overview() {
  const [kpiDate, setKpiDate] = useState<Dayjs>(today())
  const [rangeDays, setRangeDays] = useState(30)
  const [startDate, endDate] = defaultRange(rangeDays).map(fmt)

  const overviewQuery = useOverview(fmt(kpiDate))
  const trendQuery = useOverviewTrend({ startDate, endDate })
  const overview = overviewQuery.data ?? null
  const trend = trendQuery.data ?? null
  const loading = overviewQuery.isLoading || trendQuery.isLoading
  const refreshing = overviewQuery.isFetching || trendQuery.isFetching
  const error = overviewQuery.error ?? trendQuery.error

  const refresh = () => {
    void overviewQuery.refetch()
    void trendQuery.refetch()
  }
  const errorMessage = error
    ? error instanceof Error
      ? error.message
      : '加载失败'
    : null

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            总览
          </Typography.Title>
          <Typography.Text type="secondary">
            数据日期 {overview?.date ?? '—'} · 时长为估算口径（每条对话 × 0.5 分钟）
          </Typography.Text>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <AnalyticsDatePicker
            value={kpiDate}
            onChange={(d) => {
              if (d) setKpiDate(d)
            }}
          />
          <Button onClick={refresh} loading={refreshing}>
            刷新
          </Button>
        </div>
      </div>

      {errorMessage && (
        <Alert
          type="error"
          showIcon
          message="数据加载失败"
          description={errorMessage}
          style={{ marginBottom: 16 }}
        />
      )}

      <Spin spinning={loading}>
        {overview && <KpiCards data={overview} />}

        <Card
          title="核心指标趋势"
          style={{ marginTop: 16 }}
          extra={
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <TodayOngoingTag />
              <Radio.Group
                optionType="button"
                buttonStyle="solid"
                options={RANGE_OPTIONS}
                value={rangeDays}
                onChange={(e) => setRangeDays(e.target.value as number)}
              />
            </div>
          }
        >
          {trend && <TrendChart data={trend} />}
        </Card>

        <Row gutter={16} style={{ marginTop: 16 }}>
          <Col span={24}>
            {overview && <FunnelChart funnel={overview.funnel} />}
          </Col>
        </Row>
      </Spin>
    </div>
  )
}
