import { useState } from 'react'
import { Alert, Card, Spin, Typography } from 'antd'
import type { Dayjs } from 'dayjs'
import {
  useFleetSummary,
  useFleetPresenceTrend,
  useFleetFirmwareDistribution,
  useFleetChurnRisk,
} from '../../api/queries'
import AnalyticsDatePicker from '../../components/AnalyticsDatePicker'
import AnalyticsRangePicker from '../../components/AnalyticsRangePicker'
import { fmt, yesterday } from '../../utils/date-range'
import type { DayRange } from '../../utils/date-range'
import SummaryCards from './SummaryCards'
import PresenceTrendChart from './PresenceTrendChart'
import FirmwareDistributionChart from './FirmwareDistributionChart'
import ChurnRiskTable from './ChurnRiskTable'
import DeviceTable from './DeviceTable'

const MAX_TREND_DAYS = 62

export default function Fleet() {
  // Summary: single date, default yesterday
  const [summaryDate, setSummaryDate] = useState<Dayjs>(yesterday())
  const summaryQuery = useFleetSummary(fmt(summaryDate))

  // Presence trend: date range, default last 30 days ending yesterday
  const [trendRange, setTrendRange] = useState<DayRange>([
    yesterday().subtract(29, 'day'),
    yesterday(),
  ])
  const [trendRangeError, setTrendRangeError] = useState<string | null>(null)
  const trendQuery = useFleetPresenceTrend({
    startDate: fmt(trendRange[0]),
    endDate: fmt(trendRange[1]),
  })

  // Firmware distribution: no params
  const firmwareQuery = useFleetFirmwareDistribution()

  // Churn risk: days control, default 7
  const [churnDays, setChurnDays] = useState(7)
  const churnQuery = useFleetChurnRisk(churnDays)

  const handleTrendRangeChange = (range: DayRange | null) => {
    if (!range) return
    const days = range[1].diff(range[0], 'day') + 1
    if (days > MAX_TREND_DAYS) {
      setTrendRangeError(
        `开机率趋势区间上限 ${MAX_TREND_DAYS} 天，当前选择了 ${days} 天，已自动截断至最近 ${MAX_TREND_DAYS} 天`,
      )
      setTrendRange([range[1].subtract(MAX_TREND_DAYS - 1, 'day'), range[1]])
    } else {
      setTrendRangeError(null)
      setTrendRange(range)
    }
  }

  const error =
    summaryQuery.error ??
    trendQuery.error ??
    firmwareQuery.error ??
    churnQuery.error
  const errorMessage =
    error instanceof Error ? error.message : error ? '加载失败' : null

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>
        设备舰队
      </Typography.Title>

      {errorMessage && (
        <Alert
          type="error"
          showIcon
          message="数据加载失败"
          description={errorMessage}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 舰队概览 — 单日口径 */}
      <Card
        title="舰队概览"
        style={{ marginBottom: 16 }}
        extra={
          <AnalyticsDatePicker
            value={summaryDate}
            onChange={(d) => {
              if (d) setSummaryDate(d)
            }}
          />
        }
      >
        <Spin spinning={summaryQuery.isLoading}>
          {summaryQuery.data && <SummaryCards data={summaryQuery.data} />}
        </Spin>
      </Card>

      {/* 开机率趋势 — 区间口径 */}
      <Card
        title="开机率趋势"
        style={{ marginBottom: 16 }}
        extra={
          <div>
            {trendRangeError && (
              <Typography.Text
                type="warning"
                style={{ fontSize: 12, marginRight: 8 }}
              >
                {trendRangeError}
              </Typography.Text>
            )}
            <AnalyticsRangePicker
              value={trendRange}
              onChange={handleTrendRangeChange}
              excludeToday
            />
          </div>
        }
      >
        <Spin spinning={trendQuery.isLoading}>
          {trendQuery.data && <PresenceTrendChart data={trendQuery.data} />}
        </Spin>
      </Card>

      {/* 固件版本分布 — 全量 */}
      <Card title="固件版本分布" style={{ marginBottom: 16 }}>
        <Spin spinning={firmwareQuery.isLoading}>
          {firmwareQuery.data && (
            <FirmwareDistributionChart data={firmwareQuery.data} />
          )}
        </Spin>
      </Card>

      {/* 流失风险设备 */}
      <Card title="流失风险设备" style={{ marginBottom: 16 }}>
        <Spin spinning={churnQuery.isLoading}>
          {churnQuery.data && (
            <ChurnRiskTable
              data={churnQuery.data}
              days={churnDays}
              onDaysChange={setChurnDays}
            />
          )}
        </Spin>
      </Card>

      {/* 设备明细 — 全量分页 */}
      <Card title="设备明细">
        <DeviceTable />
      </Card>
    </div>
  )
}
