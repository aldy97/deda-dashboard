import { useState } from 'react'
import { Alert, Card, Col, Row, Spin, Statistic } from 'antd'
import { Link } from 'react-router-dom'
import { useContentParentReport } from '../../api/queries'
import AnalyticsRangePicker from '../../components/AnalyticsRangePicker'
import { defaultRange, fmt } from '../../utils/date-range'
import type { DayRange } from '../../utils/date-range'

const formatPct = (rate: number | null) =>
  rate === null ? '—' : `${(rate * 100).toFixed(1)}%`

/**
 * 家长报告生成质量面板：区间内生成成功/失败数与反馈有用率。
 * 从「内容与质量」页搬迁至此，作为用户反馈页的第三个 tab。
 */
export default function ParentReportPanel() {
  const [range, setRange] = useState<DayRange>(defaultRange(30))
  const params = { startDate: fmt(range[0]), endDate: fmt(range[1]) }
  const query = useContentParentReport(params)
  const data = query.data ?? null
  const loading = query.isLoading
  const error = query.error
    ? query.error instanceof Error
      ? query.error.message
      : '加载失败'
    : null

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
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
          message="家长报告数据加载失败"
          description={error}
          style={{ marginBottom: 12 }}
        />
      )}

      <Spin spinning={loading}>
        {data && (
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={12} md={8} lg={4}>
              <Statistic title="生成报告数" value={data.generated} />
            </Col>
            <Col xs={12} md={8} lg={4}>
              <Statistic title="生成失败数" value={data.failed} />
            </Col>
            <Col xs={12} md={8} lg={4}>
              <Statistic
                title="生成成功率"
                value={formatPct(data.successRate)}
              />
            </Col>
            <Col xs={12} md={8} lg={4}>
              <Statistic title="收到反馈数" value={data.feedbackTotal} />
            </Col>
            <Col xs={12} md={8} lg={4}>
              <Statistic
                title="反馈有用率"
                value={formatPct(data.usefulRate)}
              />
            </Col>
          </Row>
        )}

        <Card size="small" style={{ marginTop: data ? 0 : 16 }}>
          <Row gutter={[16, 8]}>
            <Col>
              <Link to="?tab=report">看日报反馈明细 →</Link>
            </Col>
            <Col>
              <Link to="/llm?tab=perf&scene=parent_report">
                生成失败排查：模型监控·家长日报生成 →
              </Link>
            </Col>
          </Row>
        </Card>
      </Spin>
    </div>
  )
}
