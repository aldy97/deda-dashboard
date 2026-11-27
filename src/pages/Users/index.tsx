import { useState } from 'react'
import { Alert, Card, Col, Input, Row, Spin, Statistic } from 'antd'
import { useNavigate } from 'react-router-dom'
import { usePhoneBrands, useUsersDemographics, useUsersSummary } from '../../api/queries'
import AnalyticsRangePicker from '../../components/AnalyticsRangePicker'
import PageHeader from '../../components/PageHeader'
import { defaultRange, fmt } from '../../utils/date-range'
import type { DayRange } from '../../utils/date-range'
import Demographics from './Demographics'
import PhoneBrandChart from './PhoneBrandChart'

/** 家长 ID 是数据库 UUID；业务设备 ID 不是 UUID。搜索框按此分流两个详情页。 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * 用户画像页（P5）：家长总量/新增/绑定概览 + 孩子画像分布。
 * 区间控件仅影响「区间新增家长」（后端约定：startDate+endDate 同传才返回）。
 */
export default function Users() {
  const navigate = useNavigate()
  const [range, setRange] = useState<DayRange>(defaultRange(30))
  const summaryQuery = useUsersSummary({
    startDate: fmt(range[0]),
    endDate: fmt(range[1]),
  })
  const demographicsQuery = useUsersDemographics()
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
    <div>
      <PageHeader
        title="用户画像"
        description="聚合数据，不出 PII；画像分布为当前全量快照"
        actions={
          <AnalyticsRangePicker
            value={range}
            onChange={(r) => {
              if (r) setRange(r)
            }}
          />
        }
      />

      {/* 两个锚点共用一条搜索框：UUID = 家长档案，业务设备 ID = 设备档案 */}
      <Input.Search
        allowClear
        placeholder="输入设备 ID 或家长 ID 查看详情"
        style={{ maxWidth: 420, marginBottom: 16 }}
        onSearch={(v) => {
          const id = v.trim()
          if (!id) return
          if (UUID_RE.test(id)) {
            navigate(`/parents/${encodeURIComponent(id)}`)
          } else {
            navigate(`/users/${encodeURIComponent(id)}`)
          }
        }}
      />

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

        <Card title="画像分布" style={{ marginTop: 16 }}>
          {demographics && <Demographics data={demographics} />}
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
    </div>
  )
}
