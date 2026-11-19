import { useState } from 'react'
import { Alert, Card, Col, Row, Spin, Statistic, Typography } from 'antd'
import { Link } from 'react-router-dom'
import {
  useContentAdventure,
  useContentAdventureChoices,
  useContentLearning,
  useQualityConversation,
} from '../../api/queries'
import AnalyticsRangePicker from '../../components/AnalyticsRangePicker'
import InfoTip from '../../components/InfoTip'
import { defaultRange, fmt } from '../../utils/date-range'
import type { DayRange } from '../../utils/date-range'
import AdventureSection from './AdventureSection'
import AdventureChoicesSection from './AdventureChoicesSection'
import QualityTrend from './QualityTrend'

const formatPct = (rate: number | null) =>
  rate === null ? '—' : `${(rate * 100).toFixed(1)}%`

/**
 * 内容与质量页（P6）：冒险故事、学习数据、对话质量。
 * 一个区间控件驱动全部三个接口；对话质量固定按日粒度。
 * 家长报告卡片已搬迁至用户反馈页作为第三个 tab。
 * /analytics/quality/llm-usage 一期 501（未落库），本页不接入。
 */
export default function Content() {
  const [range, setRange] = useState<DayRange>(defaultRange(30))
  const params = { startDate: fmt(range[0]), endDate: fmt(range[1]) }
  const adventureQuery = useContentAdventure(params)
  const choicesQuery = useContentAdventureChoices(params)
  const learningQuery = useContentLearning(params)
  const qualityQuery = useQualityConversation({ ...params, granularity: 'day' })
  const adventure = adventureQuery.data ?? null
  const choices = choicesQuery.data ?? null
  const learning = learningQuery.data ?? null
  const quality = qualityQuery.data ?? null
  const loading =
    adventureQuery.isLoading ||
    choicesQuery.isLoading ||
    learningQuery.isLoading ||
    qualityQuery.isLoading
  const queryError =
    adventureQuery.error ??
    choicesQuery.error ??
    learningQuery.error ??
    qualityQuery.error
  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : '加载失败'
    : null
  const dateQuery = `startDate=${fmt(range[0])}&endDate=${fmt(range[1])}`

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
          {adventure && <AdventureSection data={adventure} range={range} />}
        </Card>

        <Card title="二选一选项命中" style={{ marginTop: 16 }}>
          {choices && <AdventureChoicesSection data={choices} range={range} />}
        </Card>

        <Card
          title="学习数据"
          extra={
            <div style={{ display: 'flex', gap: 12 }}>
              <Link to={`/messages?mode=english_chat&${dateQuery}`}>
                英语对话消息 →
              </Link>
              <Link to={`/messages?mode=english_story&${dateQuery}`}>
                英语故事消息 →
              </Link>
            </div>
          }
          style={{ marginTop: 16 }}
        >
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

        <Card
          title={
            <>
              对话质量趋势（按日）
              <InfoTip title="本页口径：按消息行统计——对话失败率 = assistant status=failed 占比；安全拦截率 = rawPayload 含 safetyCategory 占比。模型监控「性能」tab 按 llm_call_logs 成功率口径，「安全」tab 按 turn_decision_logs 分桶口径，排查时以后者为准。" />
            </>
          }
          extra={
            <div style={{ display: 'flex', gap: 12 }}>
              <Link to="/llm?tab=perf">模型监控·性能 →</Link>
              <Link to="/llm?tab=safety">模型监控·安全 →</Link>
            </div>
          }
          style={{ marginTop: 16 }}
        >
          {quality && <QualityTrend data={quality} />}
        </Card>
      </Spin>
    </div>
  )
}
