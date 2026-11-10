import { useState } from 'react'
import { Alert, Card, Select, Spin, Typography } from 'antd'
import { useLlmSummary, useLlmTrend } from '../../api/queries'
import AnalyticsRangePicker from '../../components/AnalyticsRangePicker'
import { defaultRange, fmt } from '../../utils/date-range'
import type { DayRange } from '../../utils/date-range'
import SceneSummaryTable from './SceneSummaryTable'
import LlmTrendChart from './LlmTrendChart'
import RecentFailuresTable from './RecentFailuresTable'
import TurnHandoffCard from './TurnHandoffCard'
import SlowCallsTable from './SlowCallsTable'
import { SCENE_META } from './scenes'

/**
 * 模型监控页：主模型 + 小模型全量调用的分场景汇总、趋势与失败明细。
 * 契约见 docs/llm-monitoring-spec.md；首包时间（TTFT）仅流式场景有值。
 * 注意：fail-open 场景（安全分类、过渡语）失败不报错，只能靠本页成功率发现。
 */
export default function LlmMonitor() {
  const [range, setRange] = useState<DayRange>(defaultRange(7))
  const [scene, setScene] = useState<string | undefined>(undefined)
  const params = { startDate: fmt(range[0]), endDate: fmt(range[1]) }
  const summaryQuery = useLlmSummary(params)
  const trendQuery = useLlmTrend({
    ...params,
    granularity: 'day',
    ...(scene ? { scene } : {}),
  })
  const summary = summaryQuery.data ?? null
  const trend = trendQuery.data ?? null
  const loading = summaryQuery.isLoading || trendQuery.isLoading
  const queryError = summaryQuery.error ?? trendQuery.error
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
            模型监控
          </Typography.Title>
          <Typography.Text type="secondary">
            主模型（deepseek-flash）+ 小模型（qwen-flash）全量调用；首包时间仅流式场景有值
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
          message="模型监控数据加载失败"
          description={error}
          style={{ marginBottom: 16 }}
        />
      )}

      {(() => {
        // 失败率告警：区间内总调用 ≥ 20 才评估（小样本不误报）；
        // < 95% 黄色提醒，< 85% 红色告警
        if (!summary) return null
        const totalCalls = summary.scenes.reduce((sum, s) => sum + s.calls, 0)
        if (totalCalls < 20) return null
        const successes = summary.scenes.reduce(
          (sum, s) => sum + (s.successRate ?? 0) * s.calls,
          0,
        )
        const rate = successes / totalCalls
        if (rate >= 0.95) return null
        const critical = rate < 0.85
        return (
          <Alert
            type={critical ? 'error' : 'warning'}
            showIcon
            message={`区间内调用成功率 ${(rate * 100).toFixed(1)}%（${totalCalls} 次调用），${critical ? '已低于 85%，请立即排查上游模型与网络' : '低于 95%，请关注下方失败明细'}`}
            style={{ marginBottom: 16 }}
          />
        )
      })()}

      <Spin spinning={loading}>
        <Card title="分场景汇总">
          {summary && <SceneSummaryTable data={summary} />}
        </Card>

        <Card
          title="调用趋势"
          style={{ marginTop: 16 }}
          extra={
            <Select
              allowClear
              placeholder="全部场景"
              style={{ width: 180 }}
              value={scene}
              onChange={(v) => setScene(v)}
              options={Object.entries(SCENE_META).map(([key, meta]) => ({
                label: meta.label,
                value: key,
              }))}
            />
          }
        >
          {trend && <LlmTrendChart data={trend} />}
        </Card>

        <Card
          title="轮次衔接健康度（防死空气）"
          style={{ marginTop: 16 }}
        >
          <TurnHandoffCard startDate={fmt(range[0])} endDate={fmt(range[1])} />
        </Card>

        <Card title="最近失败明细" style={{ marginTop: 16 }}>
          <RecentFailuresTable scene={scene} />
        </Card>

        <Card title="慢调用长尾（成功但慢）" style={{ marginTop: 16 }}>
          <SlowCallsTable
            startDate={fmt(range[0])}
            endDate={fmt(range[1])}
            scene={scene}
          />
        </Card>
      </Spin>
    </div>
  )
}
