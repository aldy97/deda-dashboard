import { useCallback, useEffect, useState } from 'react'
import { Alert, Card, Col, Row, Spin, Statistic, Typography } from 'antd'
import { fetchUsersDemographics, fetchUsersSummary } from '../../api/analytics'
import type {
  UsersDemographicsResponse,
  UsersSummaryResponse,
} from '../../types/analytics'
import AnalyticsRangePicker from '../../components/AnalyticsRangePicker'
import { defaultRange, fmt } from '../../utils/date-range'
import type { DayRange } from '../../utils/date-range'
import Demographics from './Demographics'

/**
 * 用户画像页（P5）：家长总量/新增/绑定概览 + 孩子画像分布。
 * 区间控件仅影响「区间新增家长」（后端约定：startDate+endDate 同传才返回）。
 */
export default function Users() {
  const [range, setRange] = useState<DayRange>(defaultRange(30))
  const [summary, setSummary] = useState<UsersSummaryResponse | null>(null)
  const [demographics, setDemographics] =
    useState<UsersDemographicsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (r: DayRange) => {
    setLoading(true)
    setError(null)
    try {
      const [summaryData, demographicsData] = await Promise.all([
        fetchUsersSummary({ startDate: fmt(r[0]), endDate: fmt(r[1]) }),
        fetchUsersDemographics(),
      ])
      setSummary(summaryData)
      setDemographics(demographicsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(range)
  }, [load, range])

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            用户画像
          </Typography.Title>
          <Typography.Text type="secondary">
            聚合数据，不出 PII；画像分布为当前全量快照
          </Typography.Text>
        </div>
        <AnalyticsRangePicker
          value={range}
          onChange={(r) => {
            if (r) setRange(r)
          }}
        />
      </div>

      {error && (
        <Alert
          type="error"
          showIcon
          message="用户数据加载失败"
          description={error}
          style={{ marginBottom: 16 }}
        />
      )}

      <Spin spinning={loading}>
        {summary && (
          <Row gutter={[16, 16]}>
            <Col xs={12} md={8} lg={4}>
              <Card size="small" style={{ height: '100%' }}>
                <Statistic title="注册家长总数" value={summary.totalUsers} />
              </Card>
            </Col>
            <Col xs={12} md={8} lg={4}>
              <Card size="small" style={{ height: '100%' }}>
                <Statistic
                  title="区间新增家长"
                  value={summary.newUsersInRange ?? '—'}
                />
              </Card>
            </Col>
            <Col xs={12} md={8} lg={4}>
              <Card size="small" style={{ height: '100%' }}>
                <Statistic
                  title="已绑定设备的家长"
                  value={summary.usersWithBoundDevice}
                />
              </Card>
            </Col>
            <Col xs={12} md={8} lg={4}>
              <Card size="small" style={{ height: '100%' }}>
                <Statistic
                  title="人均设备数"
                  value={summary.avgDevicesPerUser}
                  suffix="台"
                />
              </Card>
            </Col>
            <Col xs={12} md={8} lg={4}>
              <Card size="small" style={{ height: '100%' }}>
                <Statistic
                  title="多孩家庭"
                  value={summary.multiChildFamilies}
                />
              </Card>
            </Col>
          </Row>
        )}

        <Card title="画像分布" style={{ marginTop: 16 }}>
          {demographics && <Demographics data={demographics} />}
        </Card>
      </Spin>
    </div>
  )
}
