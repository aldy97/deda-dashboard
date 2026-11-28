import { useState } from 'react'
import { Alert, Card, Col, Row, Spin, Statistic } from 'antd'
import AccessLink from '../../components/access/AccessLink'
import {
  useContentAdventure,
  useContentLearning,
  useQualityConversation,
} from '../../api/queries'
import AnalyticsRangePicker from '../../components/AnalyticsRangePicker'
import InfoTip from '../../components/InfoTip'
import PageHeader from '../../components/PageHeader'
import RefreshButton from '../../components/RefreshButton'
import { usePageRefresh } from '../../api/refresh'
import { defaultRange, fmt } from '../../utils/date-range'
import type { DayRange } from '../../utils/date-range'
import AdventureSection from './AdventureSection'
import AdventureChoicesSection from './AdventureChoicesSection'
import QualityTrend from './QualityTrend'
import AdventureTestGuide from '../AdventureStudio/AdventureTestGuide'

const formatPct = (rate: number | null) =>
  rate === null ? '—' : `${(rate * 100).toFixed(1)}%`

/**
 * 内容与质量页（P6）：冒险故事、二选一选项命中、学习数据、对话质量。
 * 一个区间控件驱动全部区块；对话质量固定按日粒度。
 * 家长报告卡片已搬迁至用户反馈页作为第三个 tab。
 * /analytics/quality/llm-usage 一期 501（未落库），本页不接入。
 * 例外：「二选一选项命中」区块自己持有查询，不并进本页的整页 loading 与
 * 整页错误 Alert——它的后端端点上线晚于本页，若并进来，端点 404 会让整页
 * 挂红色横幅，而其余三个区块的数据其实是好的。区块内自己显示错误即可。
 */
export default function Content() {
  const [range, setRange] = useState<DayRange>(defaultRange(30))
  const params = { startDate: fmt(range[0]), endDate: fmt(range[1]) }
  const adventureQuery = useContentAdventure(params)
  const learningQuery = useContentLearning(params)
  const qualityQuery = useQualityConversation({ ...params, granularity: 'day' })
  const adventure = adventureQuery.data ?? null
  const learning = learningQuery.data ?? null
  const quality = qualityQuery.data ?? null
  const loading =
    adventureQuery.isLoading ||
    learningQuery.isLoading ||
    qualityQuery.isLoading
  const queryError =
    adventureQuery.error ?? learningQuery.error ?? qualityQuery.error
  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : '加载失败'
    : null
  const dateQuery = `startDate=${fmt(range[0])}&endDate=${fmt(range[1])}`
  const { refresh, isRefreshing } = usePageRefresh('content')

  return (
    <div>
      <PageHeader
        title="内容与质量"
        description="区间为闭区间，含今日时今日数据进行中"
        actions={
          <>
            <AnalyticsRangePicker
              value={range}
              onChange={(r) => {
                if (r) setRange(r)
              }}
            />
            <RefreshButton loading={isRefreshing} onClick={refresh} />
          </>
        }
      />

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
        <Card title="冒险故事" extra={<AdventureTestGuide />}>
          {adventure && <AdventureSection data={adventure} range={range} />}
        </Card>

        <Card title="二选一选项命中" style={{ marginTop: 16 }}>
          <AdventureChoicesSection range={range} />
        </Card>

        <Card
          title="学习数据"
          extra={
            <div style={{ display: 'flex', gap: 12 }}>
              <AccessLink
                hint="message-list"
                to={`/messages?mode=english_chat&${dateQuery}`}
              >
                英语对话消息 →
              </AccessLink>
              <AccessLink
                hint="message-list"
                to={`/messages?mode=english_story&${dateQuery}`}
              >
                英语故事消息 →
              </AccessLink>
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
              <AccessLink hint="llm-perf" arrow to="/llm?tab=perf">
                模型监控·性能
              </AccessLink>
              <AccessLink hint="llm-safety" arrow to="/llm?tab=safety">
                模型监控·安全
              </AccessLink>
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
