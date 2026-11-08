import { useCallback, useEffect, useState } from 'react'
import { Alert, Card, Col, DatePicker, Row, Spin, Typography } from 'antd'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import {
  fetchDurationDistribution,
  fetchEngagementSummary,
  fetchFeatureAdoption,
  fetchHourlyHeatmap,
  fetchModeUsage,
} from '../../api/analytics'
import type {
  DurationDistributionResponse,
  EngagementSummaryResponse,
  FeatureAdoptionResponse,
  HourlyHeatmapResponse,
  ModeUsageResponse,
} from '../../types/analytics'
import SummaryCards from './SummaryCards'
import ModeUsageChart from './ModeUsageChart'
import HourlyHeatmap from './HourlyHeatmap'
import DurationDistributionChart from './DurationDistributionChart'
import FeatureAdoptionTable from './FeatureAdoptionTable'

type Range = [Dayjs, Dayjs]

const fmt = (d: Dayjs) => d.format('YYYY-MM-DD')
const yesterday = () => dayjs().subtract(1, 'day')

/** 数据日期上限为 T-1（昨天），与总览页口径一致 */
const disableAfterYesterday = (d: Dayjs) => d.isAfter(yesterday(), 'day')

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : '加载失败'
}

/**
 * 使用行为页（P3）：汇总 KPI + 模式分布 + 时段热力 + 时长分桶 + 功能渗透率。
 * 区间控件驱动 summary / mode-usage / hourly-heatmap；
 * 单日控件驱动 duration-distribution / feature-adoption。
 */
export default function Engagement() {
  // ---- 区间口径（summary / mode-usage / heatmap）----
  const [range, setRange] = useState<Range>([
    dayjs().subtract(6, 'day'),
    yesterday(),
  ])
  const [summary, setSummary] = useState<EngagementSummaryResponse | null>(null)
  const [modeUsage, setModeUsage] = useState<ModeUsageResponse | null>(null)
  const [heatmap, setHeatmap] = useState<HourlyHeatmapResponse | null>(null)
  const [rangeLoading, setRangeLoading] = useState(true)
  const [rangeError, setRangeError] = useState<string | null>(null)

  const loadRange = useCallback(async (r: Range) => {
    setRangeLoading(true)
    setRangeError(null)
    const params = { startDate: fmt(r[0]), endDate: fmt(r[1]) }
    try {
      const [summaryData, modeData, heatmapData] = await Promise.all([
        fetchEngagementSummary(params),
        fetchModeUsage(params),
        fetchHourlyHeatmap(params),
      ])
      setSummary(summaryData)
      setModeUsage(modeData)
      setHeatmap(heatmapData)
    } catch (err) {
      setRangeError(toErrorMessage(err))
    } finally {
      setRangeLoading(false)
    }
  }, [])

  // ---- 单日口径（duration-distribution / feature-adoption）----
  const [date, setDate] = useState<Dayjs>(yesterday())
  const [distribution, setDistribution] =
    useState<DurationDistributionResponse | null>(null)
  const [adoption, setAdoption] = useState<FeatureAdoptionResponse | null>(null)
  const [dayLoading, setDayLoading] = useState(true)
  const [dayError, setDayError] = useState<string | null>(null)

  const loadDay = useCallback(async (d: Dayjs) => {
    setDayLoading(true)
    setDayError(null)
    try {
      const [distributionData, adoptionData] = await Promise.all([
        fetchDurationDistribution(fmt(d)),
        fetchFeatureAdoption(fmt(d)),
      ])
      setDistribution(distributionData)
      setAdoption(adoptionData)
    } catch (err) {
      setDayError(toErrorMessage(err))
    } finally {
      setDayLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRange(range)
  }, [loadRange, range])

  useEffect(() => {
    void loadDay(date)
  }, [loadDay, date])

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
            时长类指标为估算口径（每条对话 × 0.5 分钟）；单日快照按自然日（Asia/Shanghai）
          </Typography.Text>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Typography.Text type="secondary">区间</Typography.Text>
          <DatePicker.RangePicker
            allowClear={false}
            disabledDate={disableAfterYesterday}
            value={range}
            onChange={(dates) => {
              if (dates?.[0] && dates?.[1]) setRange([dates[0], dates[1]])
            }}
          />
          <Typography.Text type="secondary">单日</Typography.Text>
          <DatePicker
            allowClear={false}
            disabledDate={disableAfterYesterday}
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
        {summary && <SummaryCards data={summary} />}

        <Card title="模式分布（对话轮次）" style={{ marginTop: 16 }}>
          {modeUsage && <ModeUsageChart data={modeUsage} />}
        </Card>

        <Card
          title="时段热力（活跃设备数，7×24）"
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
