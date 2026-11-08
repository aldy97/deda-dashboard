import { useCallback, useEffect, useState } from 'react'
import { Alert, Card, DatePicker, Select, Spin, Typography } from 'antd'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { fetchLlmSummary, fetchLlmTrend } from '../../api/analytics'
import type { LlmSummaryResponse, LlmTrendResponse } from '../../types/analytics'
import SceneSummaryTable from './SceneSummaryTable'
import LlmTrendChart from './LlmTrendChart'
import RecentFailuresTable from './RecentFailuresTable'
import { SCENE_META } from './scenes'

type Range = [Dayjs, Dayjs]

const fmt = (d: Dayjs) => d.format('YYYY-MM-DD')
const yesterday = () => dayjs().subtract(1, 'day')
const disableAfterYesterday = (d: Dayjs) => d.isAfter(yesterday(), 'day')

/**
 * 模型监控页：主模型 + 小模型全量调用的分场景汇总、趋势与失败明细。
 * 契约见 docs/llm-monitoring-spec.md；首包时间（TTFT）仅流式场景有值。
 * 注意：fail-open 场景（安全分类、过渡语）失败不报错，只能靠本页成功率发现。
 */
export default function LlmMonitor() {
  const [range, setRange] = useState<Range>([
    dayjs().subtract(6, 'day'),
    yesterday(),
  ])
  const [scene, setScene] = useState<string | undefined>(undefined)
  const [summary, setSummary] = useState<LlmSummaryResponse | null>(null)
  const [trend, setTrend] = useState<LlmTrendResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (r: Range, s: string | undefined) => {
    setLoading(true)
    setError(null)
    const params = { startDate: fmt(r[0]), endDate: fmt(r[1]) }
    try {
      const [summaryData, trendData] = await Promise.all([
        fetchLlmSummary(params),
        fetchLlmTrend({ ...params, granularity: 'day', ...(s ? { scene: s } : {}) }),
      ])
      setSummary(summaryData)
      setTrend(trendData)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(range, scene)
  }, [load, range, scene])

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
        <DatePicker.RangePicker
          allowClear={false}
          disabledDate={disableAfterYesterday}
          value={range}
          onChange={(dates) => {
            if (dates?.[0] && dates?.[1]) setRange([dates[0], dates[1]])
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

        <Card title="最近失败明细" style={{ marginTop: 16 }}>
          <RecentFailuresTable scene={scene} />
        </Card>
      </Spin>
    </div>
  )
}
