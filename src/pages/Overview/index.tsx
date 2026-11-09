import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Card, Col, Radio, Row, Spin, Typography } from 'antd'
import type { Dayjs } from 'dayjs'
import { fetchOverview, fetchOverviewTrend } from '../../api/analytics'
import type { OverviewResponse, OverviewTrendResponse } from '../../types/analytics'
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
  const [overview, setOverview] = useState<OverviewResponse | null>(null)
  const [trend, setTrend] = useState<OverviewTrendResponse | null>(null)
  const [kpiDate, setKpiDate] = useState<Dayjs>(today())
  const [rangeDays, setRangeDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (date: Dayjs, days: number) => {
    setLoading(true)
    setError(null)
    const [startDate, endDate] = defaultRange(days).map(fmt)
    try {
      const [overviewData, trendData] = await Promise.all([
        fetchOverview(fmt(date)),
        fetchOverviewTrend({ startDate, endDate }),
      ])
      setOverview(overviewData)
      setTrend(trendData)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(kpiDate, rangeDays)
  }, [load, kpiDate, rangeDays])

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
          <Button onClick={() => void load(kpiDate, rangeDays)} loading={loading}>
            刷新
          </Button>
        </div>
      </div>

      {error && (
        <Alert
          type="error"
          showIcon
          message="数据加载失败"
          description={error}
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
