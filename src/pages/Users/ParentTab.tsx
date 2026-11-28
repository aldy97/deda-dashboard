import { Alert, Card, Col, Row, Spin, Statistic } from 'antd'
import { usePhoneBrands, useParentDemographics, useUsersSummary } from '../../api/queries'
import AnalyticsRangePicker from '../../components/AnalyticsRangePicker'
import { fmt } from '../../utils/date-range'
import type { DayRange } from '../../utils/date-range'
import ParentDemographics from './ParentDemographics'
import PhoneBrandChart from './PhoneBrandChart'

/**
 * 家长画像 tab：概览卡片、家长性别/年龄段、手机品牌。
 * 统计单位是家长账号（users），与孩子/设备画像不混算。
 */
export default function ParentTab({
  range,
  onRangeChange,
}: {
  range: DayRange
  onRangeChange: (range: DayRange) => void
}) {
  const summaryQuery = useUsersSummary({
    startDate: fmt(range[0]),
    endDate: fmt(range[1]),
  })
  const demographicsQuery = useParentDemographics()
  const brandsQuery = usePhoneBrands()

  const summary = summaryQuery.data ?? null
  const demographics = demographicsQuery.data ?? null
  const phoneBrands = brandsQuery.data ?? null
  const loading = summaryQuery.isLoading || demographicsQuery.isLoading
  const queryError = summaryQuery.error ?? demographicsQuery.error
  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : '加载失败'
    : null
  const brandsError = brandsQuery.error
    ? brandsQuery.error instanceof Error
      ? brandsQuery.error.message
      : '加载失败'
    : null

  return (
    <Spin spinning={loading}>
      <div style={{ marginBottom: 16 }}>
        <AnalyticsRangePicker
          value={range}
          onChange={(next) => {
            if (next) onRangeChange(next)
          }}
        />
      </div>

      {error && (
        <Alert
          type="error"
          showIcon
          message="家长数据加载失败"
          description={error}
          style={{ marginBottom: 16 }}
        />
      )}

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
              <Statistic title="多孩家庭" value={summary.multiChildFamilies} />
            </Card>
          </Col>
          <Col xs={12} md={8} lg={4}>
            <Card size="small" style={{ height: '100%' }}>
              <Statistic
                title="多设备家庭"
                value={summary.multiDeviceFamilies}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Card title="家长画像分布" style={{ marginTop: 16 }}>
        {demographics && <ParentDemographics data={demographics} />}
      </Card>

      <Card title="家长手机品牌分布（当前快照）" style={{ marginTop: 16 }}>
        {brandsError && (
          <Alert
            type="error"
            showIcon
            message="手机品牌数据加载失败"
            description={brandsError}
            style={{ marginBottom: 12 }}
          />
        )}
        <Spin spinning={brandsQuery.isLoading}>
          {phoneBrands && <PhoneBrandChart data={phoneBrands} />}
        </Spin>
      </Card>
    </Spin>
  )
}
