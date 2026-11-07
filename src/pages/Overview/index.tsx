import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Card, Col, Radio, Row, Spin, Typography } from 'antd'
import dayjs from 'dayjs'
import { fetchOverview, fetchOverviewTrend } from '../../api/analytics'
import type { OverviewResponse, OverviewTrendResponse } from '../../types/analytics'
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
 * 数据日期默认 T-1（昨天，Asia/Shanghai 完整自然日）。
 */
export default function Overview() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null)
  const [trend, setTrend] = useState<OverviewTrendResponse | null>(null)
  const [rangeDays, setRangeDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (days: number) => {
    setLoading(true)
    setError(null)
    const endDate = dayjs().subtract(1, 'day').format('YYYY-MM-DD')
    const startDate = dayjs()
      .subtract(days, 'day')
      .format('YYYY-MM-DD')
    try {
      const [overviewData, trendData] = await Promise.all([
        fetchOverview(endDate),
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
    void load(rangeDays)
  }, [load, rangeDays])

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
            数据日期 {overview?.date ?? '—'}（T-1）· 时长为估算口径（每条对话 × 0.5 分钟）
          </Typography.Text>
        </div>
        <Button onClick={() => void load(rangeDays)} loading={loading}>
          刷新
        </Button>
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
            <Radio.Group
              optionType="button"
              buttonStyle="solid"
              options={RANGE_OPTIONS}
              value={rangeDays}
              onChange={(e) => setRangeDays(e.target.value as number)}
            />
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
