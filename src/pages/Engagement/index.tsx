import { useState } from 'react'
import { Alert, Card, Col, Row, Spin, Typography } from 'antd'
import type { Dayjs } from 'dayjs'
import {
  useDurationDistribution,
  useEngagementSummary,
  useFeatureAdoption,
  useHourlyHeatmap,
  useModeUsage,
} from '../../api/queries'
import AnalyticsRangePicker from '../../components/AnalyticsRangePicker'
import AnalyticsDatePicker from '../../components/AnalyticsDatePicker'
import InfoTip from '../../components/InfoTip'
import { defaultRange, fmt, today } from '../../utils/date-range'
import type { DayRange } from '../../utils/date-range'
import SummaryCards from './SummaryCards'
import ModeUsageChart from './ModeUsageChart'
import HourlyHeatmap from './HourlyHeatmap'
import DurationDistributionChart from './DurationDistributionChart'
import FeatureAdoptionTable from './FeatureAdoptionTable'

function toErrorMessage(err: unknown): string | null {
  if (!err) return null
  return err instanceof Error ? err.message : '加载失败'
}

/**
 * 使用行为页（P3）：汇总 KPI + 模式分布 + 时段热力 + 时长分桶 + 功能渗透率。
 * 区间控件驱动 summary / mode-usage / hourly-heatmap；
 * 单日控件驱动 duration-distribution / feature-adoption。
 */
export default function Engagement() {
  // ---- 区间口径（summary / mode-usage / heatmap）----
  const [range, setRange] = useState<DayRange>(defaultRange(7))
  const rangeParams = { startDate: fmt(range[0]), endDate: fmt(range[1]) }
  const summaryQuery = useEngagementSummary(rangeParams)
  const modeUsageQuery = useModeUsage(rangeParams)
  const heatmapQuery = useHourlyHeatmap(rangeParams)
  const summary = summaryQuery.data ?? null
  const modeUsage = modeUsageQuery.data ?? null
  const heatmap = heatmapQuery.data ?? null
  const rangeLoading =
    summaryQuery.isLoading || modeUsageQuery.isLoading || heatmapQuery.isLoading
  const rangeError = toErrorMessage(
    summaryQuery.error ?? modeUsageQuery.error ?? heatmapQuery.error,
  )

  // ---- 单日口径（duration-distribution / feature-adoption）----
  const [date, setDate] = useState<Dayjs>(today())
  const dayStr = fmt(date)
  const distributionQuery = useDurationDistribution(dayStr)
  const adoptionQuery = useFeatureAdoption(dayStr)
  const distribution = distributionQuery.data ?? null
  const adoption = adoptionQuery.data ?? null
  const dayLoading = distributionQuery.isLoading || adoptionQuery.isLoading
  const dayError = toErrorMessage(distributionQuery.error ?? adoptionQuery.error)

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
            使用行为
          </Typography.Title>
          <Typography.Text type="secondary">
            时长类指标为估算口径（每条对话 × 0.5 分钟）；含今日时今日数据进行中
          </Typography.Text>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Typography.Text type="secondary">区间</Typography.Text>
          <AnalyticsRangePicker
            value={range}
            onChange={(r) => {
              if (r) setRange(r)
            }}
          />
          <Typography.Text type="secondary">单日</Typography.Text>
          <AnalyticsDatePicker
            value={date}
            onChange={(d) => {
              if (d) setDate(d)
            }}
          />
        </div>
      </div>

      {rangeError && (
        <Alert
          type="error"
          showIcon
          message="区间数据加载失败"
          description={rangeError}
          style={{ marginBottom: 16 }}
        />
      )}
      {dayError && (
        <Alert
          type="error"
          showIcon
          message="单日数据加载失败"
          description={dayError}
          style={{ marginBottom: 16 }}
        />
      )}

      <Spin spinning={rangeLoading}>
        {summary && (
          <>
            <Typography.Text type="secondary">
              区间汇总（{fmt(range[0])} ~ {fmt(range[1])}）
            </Typography.Text>
            <div style={{ marginTop: 8 }}>
              <SummaryCards data={summary} />
            </div>
          </>
        )}

        <Card
          title={`模式分布（对话轮次，${fmt(range[0])} ~ ${fmt(range[1])}）`}
          style={{ marginTop: 16 }}
        >
          {modeUsage && <ModeUsageChart data={modeUsage} />}
        </Card>

        <Card
          title={
            <>
              时段热力（活跃设备数，7×24，{fmt(range[0])} ~ {fmt(range[1])}）
              <InfoTip title="每一格 = 该「星期 × 小时」内有过发言的去重设备数（Asia/Shanghai），用于看孩子在什么时段使用最集中" />
            </>
          }
          style={{ marginTop: 16 }}
        >
          {heatmap && <HourlyHeatmap data={heatmap} />}
        </Card>
      </Spin>

      <Spin spinning={dayLoading}>
        <Row gutter={16} style={{ marginTop: 16 }}>
          <Col xs={24} lg={12}>
            <Card
              title={`使用时长分布（${date.format('MM-DD')}，估算口径）`}
            >
              {distribution && <DurationDistributionChart data={distribution} />}
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card
              title={`功能渗透率（截至 ${date.format('MM-DD')}）`}
            >
              {adoption && <FeatureAdoptionTable data={adoption} />}
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  )
}
