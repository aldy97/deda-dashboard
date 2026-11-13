import { useMemo, useState } from 'react'
import {
  Alert,
  Card,
  Col,
  Row,
  Select,
  Spin,
  Statistic,
  Typography,
} from 'antd'
import { useIntentSummary, useIntentTrend } from '../../../api/queries'
import AnalyticsRangePicker from '../../../components/AnalyticsRangePicker'
import InfoTip from '../../../components/InfoTip'
import { defaultRange, fmt } from '../../../utils/date-range'
import type { DayRange } from '../../../utils/date-range'
import type { Granularity } from '../../../types/analytics'
import IntentDistributionChart from '../IntentDistributionChart'
import IntentFunnel from '../IntentFunnel'
import IntentMatrixTable from '../IntentMatrixTable'
import IntentTrendChart from '../IntentTrendChart'
import { formatDecisionRate } from '../decisions'

const GRANULARITY_OPTIONS = [
  { label: '按日', value: 'day' },
  { label: '按周', value: 'week' },
  { label: '按月', value: 'month' },
]

/**
 * 意图监控 tab：小模型意图路由的决策路径，数据源 turn_decision_logs。
 *
 * 7 条决策出口里有 4 条根本不调小模型（正则未命中、会话续接、会话粘滞、显式退出），
 * 所以「意图分布」本身几乎没有排查价值——必须连着「决策来源」一起看。
 * 这一页的主表是 intent × source 交叉表，主图是决策路径。
 */
export default function IntentTab() {
  const [range, setRange] = useState<DayRange>(defaultRange(7))
  const [granularity, setGranularity] = useState<Granularity>('day')
  const params = useMemo(
    () => ({ startDate: fmt(range[0]), endDate: fmt(range[1]) }),
    [range],
  )
  const summaryQuery = useIntentSummary(params)
  const trendQuery = useIntentTrend({ ...params, granularity })
  const summary = summaryQuery.data ?? null
  const trend = trendQuery.data ?? null
  const loading = summaryQuery.isLoading || trendQuery.isLoading
  const queryError = summaryQuery.error ?? trendQuery.error
  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : '加载失败'
    : null

  // no_device 后端没有单列字段，从 bySource 取；正常量应接近 0
  const noDeviceCount =
    summary?.bySource.find((item) => item.source === 'no_device')?.count ?? 0

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          判定记录数 ≤ 对话轮次数：埋点在每个编排出口，未捕获异常中断的轮次没有记录，
          差值不是漏审。
          <InfoTip title="有活跃会话时由规则接管（会话续接/粘滞/显式退出），所以小模型调用量远小于对话轮次，这是设计而非故障。真正要盯的是「正则未命中直接闲聊」和「关键词兜底」两项。" />
        </Typography.Text>
        <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
          <Select
            style={{ width: 110 }}
            aria-label="统计粒度"
            value={granularity}
            options={GRANULARITY_OPTIONS}
            onChange={(value) => setGranularity(value)}
          />
          <AnalyticsRangePicker
            value={range}
            onChange={(r) => {
              if (r) setRange(r)
            }}
          />
        </span>
      </div>

      {summary !== null && summary.fallbackCount > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={`意图分类存在关键词兜底：${summary.fallbackCount} 轮（${formatDecisionRate(summary.fallbackRate)}）`}
          description="这些轮次的意图是关键词猜的，不可信。标签非法升高＝prompt 退化或模型漂移；调用异常升高＝模型不可用，可与性能监控 tab 的 intent_classify 成功率按时间轴对照。"
        />
      )}

      {error && (
        <Alert
          type="error"
          showIcon
          message="意图判定数据加载失败"
          description={error}
          style={{ marginBottom: 16 }}
        />
      )}

      <Spin spinning={loading}>
        {summary && (
          <>
            <Card title="意图判定概览">
              <Row gutter={[24, 16]}>
                <Col>
                  <Statistic title="判定轮次" value={summary.total} suffix="轮" />
                </Col>
                <Col>
                  <Statistic
                    title="未路由·被拦截"
                    value={summary.notRoutedCount}
                    suffix="轮"
                  />
                </Col>
                <Col>
                  <Statistic
                    title="冒险接管"
                    value={summary.adventureTakeoverCount}
                    suffix="轮"
                  />
                </Col>
                <Col>
                  <Statistic title="匿名链路" value={noDeviceCount} suffix="轮" />
                </Col>
              </Row>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                这三类根本没走到意图路由，单列出来避免被误读成「模型判成了自由聊天」。
                匿名链路＝请求不带 user 字段（联调或异常流量），正常量应接近 0。
              </Typography.Text>
            </Card>

            <Card title="决策路径" style={{ marginTop: 16 }}>
              <IntentFunnel summary={summary} />
            </Card>

            <Card title="意图与来源分布" style={{ marginTop: 16 }}>
              <IntentDistributionChart summary={summary} />
            </Card>

            {trend && (
              <Card title="意图趋势" style={{ marginTop: 16 }}>
                <IntentTrendChart data={trend} />
              </Card>
            )}

            <Card title="意图 × 来源交叉表" style={{ marginTop: 16 }}>
              <IntentMatrixTable summary={summary} />
            </Card>
          </>
        )}
      </Spin>
    </div>
  )
}
