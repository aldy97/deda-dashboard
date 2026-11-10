import { useState } from 'react'
import { Alert, Card, Col, Row, Spin, Statistic, Typography } from 'antd'
import {
  useContentAdventure,
  useContentLearning,
  useContentParentReport,
  useQualityConversation,
} from '../../api/queries'
import AnalyticsRangePicker from '../../components/AnalyticsRangePicker'
import { defaultRange, fmt } from '../../utils/date-range'
import type { DayRange } from '../../utils/date-range'
import AdventureSection from './AdventureSection'
import QualityTrend from './QualityTrend'

const formatPct = (rate: number | null) =>
  rate === null ? '—' : `${(rate * 100).toFixed(1)}%`

/**
 * 内容与质量页（P6）：冒险故事、学习数据、家长报告、对话质量。
 * 一个区间控件驱动全部四个接口；对话质量固定按日粒度。
 * /analytics/quality/llm-usage 一期 501（未落库），本页不接入。
 */
export default function Content() {
  const [range, setRange] = useState<DayRange>(defaultRange(30))
  const params = { startDate: fmt(range[0]), endDate: fmt(range[1]) }
  const adventureQuery = useContentAdventure(params)
  const learningQuery = useContentLearning(params)
  const parentReportQuery = useContentParentReport(params)
  const qualityQuery = useQualityConversation({ ...params, granularity: 'day' })
  const adventure = adventureQuery.data ?? null
  const learning = learningQuery.data ?? null
  const parentReport = parentReportQuery.data ?? null
  const quality = qualityQuery.data ?? null
  const loading =
    adventureQuery.isLoading ||
    learningQuery.isLoading ||
    parentReportQuery.isLoading ||
    qualityQuery.isLoading
  const queryError =
    adventureQuery.error ??
    learningQuery.error ??
    parentReportQuery.error ??
    qualityQuery.error
  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
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
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            内容与质量
          </Typography.Title>
          <Typography.Text type="secondary">
            区间为闭区间，含今日时今日数据进行中
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
          message="数据加载失败"
          description={error}
          style={{ marginBottom: 16 }}
        />
      )}

      <Spin spinning={loading}>
        <Card title="冒险故事">
          {adventure && <AdventureSection data={adventure} />}
        </Card>

        <Card title="学习数据" style={{ marginTop: 16 }}>
          {learning && (
            <Row gutter={[16, 16]}>
              <Col xs={12} md={8} lg={4}>
                <Statistic title="新学单词总数" value={learning.totalNewWords} />
              </Col>
              <Col xs={12} md={8} lg={4}>
                <Statistic
                  title="活跃设备人均新词"
                  value={learning.avgNewWordsPerActiveDevice}
                />
              </Col>
              <Col xs={12} md={8} lg={4}>
                <Statistic
                  title="跟读总次数"
                  value={learning.speakCountTotal}
                  suffix="次"
                />
              </Col>
              <Col xs={12} md={8} lg={4}>
                <Statistic
                  title="进行中习惯计划"
                  value={learning.habitPlansActive}
                />
              </Col>
              <Col xs={12} md={8} lg={4}>
                <Statistic
                  title="习惯平均完成率"
                  value={formatPct(learning.habitCompletionRate)}
                />
              </Col>
            </Row>
          )}
        </Card>

        <Card title="家长报告" style={{ marginTop: 16 }}>
          {parentReport && (
            <Row gutter={[16, 16]}>
              <Col xs={12} md={8} lg={4}>
                <Statistic title="生成报告数" value={parentReport.generated} />
              </Col>
              <Col xs={12} md={8} lg={4}>
                <Statistic title="生成失败数" value={parentReport.failed} />
              </Col>
              <Col xs={12} md={8} lg={4}>
                <Statistic
                  title="生成成功率"
                  value={formatPct(parentReport.successRate)}
                />
              </Col>
              <Col xs={12} md={8} lg={4}>
                <Statistic
                  title="收到反馈数"
                  value={parentReport.feedbackTotal}
                />
              </Col>
              <Col xs={12} md={8} lg={4}>
                <Statistic
                  title="反馈有用率"
                  value={formatPct(parentReport.usefulRate)}
                />
              </Col>
            </Row>
          )}
        </Card>

        <Card title="对话质量趋势（按日）" style={{ marginTop: 16 }}>
          {quality && <QualityTrend data={quality} />}
        </Card>
      </Spin>
    </div>
  )
}
