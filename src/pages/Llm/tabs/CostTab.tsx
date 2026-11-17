import { useMemo, useState } from 'react'
import { Alert, Card, Spin, Typography } from 'antd'
import { useLlmCost } from '../../../api/queries'
import AnalyticsRangePicker from '../../../components/AnalyticsRangePicker'
import { fmt, historicalRange } from '../../../utils/date-range'
import type { DayRange } from '../../../utils/date-range'
import CostByModelChart from '../CostByModelChart'
import CostCards from '../CostCards'
import CostDailyTable from '../CostDailyTable'
import CostTotalChart from '../CostTotalChart'
import CostUnitPriceChart from '../CostUnitPriceChart'

/**
 * 价格监控 tab：由原 /llm 单页的「费用」区块平移而来，口径逐项保持不变。
 *
 * 与性能 tab 的区间刻意不同：费用走历史口径（终点＝昨日、禁选今日），
 * 因为阿里云 BSS 账单延迟约 24h 出账，把今日算进来必然偏低、会误读成费用下降。
 * 环比区间＝与当前区间等长的前一段，终点紧接当前区间起点前一天。
 */
export default function CostTab() {
  const [costRange, setCostRange] = useState<DayRange>(historicalRange(30))
  const costParams = useMemo(
    () => ({ startDate: fmt(costRange[0]), endDate: fmt(costRange[1]) }),
    [costRange],
  )
  const costDays = costRange[1].diff(costRange[0], 'day') + 1
  const prevStartDate = useMemo(
    () => fmt(costRange[0].subtract(costDays, 'day')),
    [costRange, costDays],
  )
  const prevEndDate = useMemo(
    () => fmt(costRange[0].subtract(1, 'day')),
    [costRange],
  )
  const costQuery = useLlmCost(costParams)
  const prevCostQuery = useLlmCost({
    startDate: prevStartDate,
    endDate: prevEndDate,
  })
  const costData = costQuery.data ?? null
  const prevCostData = prevCostQuery.data ?? null
  const costLoading = costQuery.isLoading || prevCostQuery.isLoading
  const costError = costQuery.error ?? prevCostQuery.error
  const costErrorMsg = costError
    ? costError instanceof Error
      ? costError.message
      : '费用数据加载失败'
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
        <Typography.Text type="secondary">
          账单延迟约 24h 出账，费用数据截至昨日；今日数字必然偏低，故本页禁选今日
        </Typography.Text>
        <AnalyticsRangePicker
          value={costRange}
          onChange={(r) => {
            if (r) setCostRange(r)
          }}
          excludeToday
        />
      </div>

      {costErrorMsg && (
        <Alert
          type="error"
          showIcon
          message="费用数据加载失败"
          description={costErrorMsg}
          style={{ marginBottom: 16 }}
        />
      )}

      <Spin spinning={costLoading}>
        {costData && (
          <>
            <CostCards data={costData} previousTotals={prevCostData?.totals} />
            <Card title="按模型费用趋势" size="small" style={{ marginTop: 16 }}>
              <CostByModelChart data={costData.series} />
            </Card>
            <Card title="总费用趋势（含累计）" size="small" style={{ marginTop: 16 }}>
              <CostTotalChart
                series={costData.series}
                month={costData.month}
              />
            </Card>
            <Card title="百万 token 单价趋势" size="small" style={{ marginTop: 16 }}>
              <CostUnitPriceChart data={costData} />
            </Card>
            <Card title="每日明细与对账" size="small" style={{ marginTop: 16 }}>
              <CostDailyTable data={costData} />
            </Card>
          </>
        )}
      </Spin>
    </div>
  )
}
