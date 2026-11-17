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
import { useSafetySummary, useSafetyTrend } from '../../../api/queries'
import AnalyticsRangePicker from '../../../components/AnalyticsRangePicker'
import InfoTip from '../../../components/InfoTip'
import { defaultRange, fmt } from '../../../utils/date-range'
import type { DayRange } from '../../../utils/date-range'
import type { Granularity } from '../../../types/analytics'
import ReviewQueueTable from '../ReviewQueueTable'
import SafetyBreakdownChart from '../SafetyBreakdownChart'
import SafetyTrendChart from '../SafetyTrendChart'
import {
  formatDecisionRate,
  silentDegradeCount,
  unauditedPassCount,
  unauditedPassRate,
} from '../decisions'

const GRANULARITY_OPTIONS = [
  { label: '按日', value: 'day' },
  { label: '按周', value: 'week' },
  { label: '按月', value: 'month' },
]

/**
 * 安全监控 tab：小模型安全判定的可信度，数据源 turn_decision_logs。
 *
 * 看这一页要记住三件事：
 * 1. 分桶必须按 safetySource，不能按 category——l2_invalid_label / l2_fail_open /
 *    not_evaluated 三类都是「放行」，混进 safe 就把静默降级读成了正常。
 * 2. 比率分母为 0 时后端返回 null，一律渲染「—」，不渲染 0.00%。
 * 3. 判定记录数 ≤ 对话轮次数，差值不是漏审（埋点在每个 return 之前而非 finally）。
 */
export default function SafetyTab() {
  const [range, setRange] = useState<DayRange>(defaultRange(7))
  const [granularity, setGranularity] = useState<Granularity>('day')
  const params = useMemo(
    () => ({ startDate: fmt(range[0]), endDate: fmt(range[1]) }),
    [range],
  )
  const summaryQuery = useSafetySummary(params)
  const trendQuery = useSafetyTrend({ ...params, granularity })
  const summary = summaryQuery.data ?? null
  const trend = trendQuery.data ?? null
  const loading = summaryQuery.isLoading || trendQuery.isLoading
  const queryError = summaryQuery.error ?? trendQuery.error
  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : '加载失败'
    : null

  const degrade = summary === null ? 0 : silentDegradeCount(summary)

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
          <InfoTip title="已知盲区：编排顺序是 L1 → 冒险接管 → Promise.all([L2, intent])，所以冒险互动轮次绕过 L2，只有 L1 正则兜着，而 L1 刻意不收「杀/打/揍/枪/刀/去死」这类孩子的气话。本期按决定只监控不改行为，未评估占比就是这块盲区的暴露面。" />
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

      {summary !== null && degrade > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={`小模型安全分类存在静默降级：${summary.failOpenCount} 次调用异常放行、${summary.invalidLabelCount} 次非法标签放行`}
          description="这些轮次没有经过 L2 语义审核就放行了，只靠 L3 大模型 system prompt 兜底。调用异常升高＝模型不可用（与性能监控的 safety_l2 成功率对照），非法标签升高＝prompt 退化或模型漂移。"
        />
      )}

      {summary !== null && (
        <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
          已知盲区：冒险互动轮次绕过 L2，本期共 {summary.notEvaluatedCount} 轮
          只经过 L1 正则；这类轮次按留存规则不留原文，可计数但不可逐字复核。
        </Typography.Paragraph>
      )}

      {error && (
        <Alert
          type="error"
          showIcon
          message="安全判定数据加载失败"
          description={error}
          style={{ marginBottom: 16 }}
        />
      )}

      <Spin spinning={loading}>
        {summary && (
          <>
            <Card title="安全判定概览">
              <Row gutter={[24, 16]}>
                <Col>
                  <Statistic
                    title="判定轮次"
                    value={summary.total}
                    suffix="轮"
                  />
                </Col>
                <Col>
                  <Statistic title="拦截" value={summary.blockedCount} suffix="轮" />
                </Col>
                <Col>
                  <Statistic
                    title="拦截率"
                    value={formatDecisionRate(summary.blockRate)}
                  />
                </Col>
                <Col>
                  <Statistic
                    title="未审计放行"
                    value={unauditedPassCount(summary)}
                    suffix={formatDecisionRate(unauditedPassRate(summary))}
                  />
                </Col>
                <Col>
                  <Statistic
                    title="其中·静默降级"
                    value={silentDegradeCount(summary)}
                  />
                </Col>
                <Col>
                  <Statistic
                    title="其中·未评估盲区"
                    value={summary.notEvaluatedCount}
                  />
                </Col>
                <Col>
                  <Statistic
                    title="情绪伤害"
                    value={summary.emotionalHarmCount}
                  />
                </Col>
                <Col>
                  <Statistic title="可复核" value={summary.reviewableCount} />
                </Col>
              </Row>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                未审计放行 = 调用异常放行 + 非法标签放行 + 未做 L2，即「放行了但 L2
                没给出可信结论」。情绪伤害不拦截，但会注入共情引导 system
                消息，是行为改变点，判得准不准只能人工复核。
              </Typography.Text>
            </Card>

            <Card title="判定分桶" style={{ marginTop: 16 }}>
              <SafetyBreakdownChart summary={summary} />
            </Card>

            {trend && (
              <Card title="拦截率趋势" style={{ marginTop: 16 }}>
                <SafetyTrendChart data={trend} />
              </Card>
            )}

            <Card title="人工复核队列" style={{ marginTop: 16 }}>
              {/* key 带区间：换区间时重挂载，把分页/筛选状态复位，避免停在越界页码 */}
              <ReviewQueueTable
                key={`${params.startDate}_${params.endDate}`}
                startDate={params.startDate}
                endDate={params.endDate}
              />
            </Card>
          </>
        )}
      </Spin>
    </div>
  )
}
