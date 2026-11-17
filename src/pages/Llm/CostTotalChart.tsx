import { Empty } from 'antd'
import ReactECharts from 'echarts-for-react'
import type { LlmCostMonth, LlmCostSeriesItem } from '../../types/analytics'
import InfoTip from '../../components/InfoTip'
import { dayTotalMissing, dayTotalPartial } from './cost-series'

interface Props {
  series: LlmCostSeriesItem[]
  month: LlmCostMonth
}

/**
 * 累计口径：只累加「数据完整」的日（totalCny 非 null 且非缺源日）。
 * 缺数据日/缺源日一律 null 断线——既不平推前值（那等于宣称当日花费 0），也不补 0。
 * 代价：断点之后的累计值偏低（不含未知日），已在下方 InfoTip 如实声明。
 */
function buildCumulative(series: LlmCostSeriesItem[]): (number | null)[] {
  const result: (number | null)[] = []
  let acc = 0
  for (const s of series) {
    if (s.totalCny === null || dayTotalPartial(s)) {
      result.push(null)
      continue
    }
    acc += s.totalCny
    result.push(acc)
  }
  return result
}

/**
 * 图B：每日总费用折线 + 累计面积图。
 * 月末预测用 markLine，label 必带账期（month 块固定跟随「昨日所在账期」，与所选区间解耦）。
 */
export default function CostTotalChart({ series, month }: Props) {
  if (series.length === 0) {
    return <Empty description="所选区间暂无费用数据" />
  }

  const dates = series.map((p) => p.date.slice(5))
  const cumulative = buildCumulative(series)

  const hasProjection = month.projectedEndCny !== null

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: (
        params: Array<{
          seriesName: string
          value: number | null
          dataIndex: number
        }>,
      ) => {
        const idx = params[0]?.dataIndex ?? 0
        const point = series[idx]
        const dayVal =
          point.totalCny !== null ? `¥${point.totalCny.toFixed(2)}` : '—'
        const accVal =
          params[1]?.value !== null && params[1]?.value !== undefined
            ? `¥${Number(params[1].value).toFixed(2)}`
            : '—'
        const lines = [
          `${point.date}`,
          `每日总费用：${dayVal}`,
          `累计：${accVal}`,
        ]
        const missing = dayTotalMissing(point)
        if (missing) lines.push(missing)
        return lines.join('<br/>')
      },
    },
    legend: { data: ['每日总费用', '累计'], bottom: 0 },
    grid: { left: 56, right: 24, top: 24, bottom: 56 },
    xAxis: { type: 'category', data: dates },
    // 不设 min:0 —— 退款/调账为负数，必须能画到 0 以下
    yAxis: {
      type: 'value',
      name: '¥',
      axisLabel: { formatter: '{value}' },
    },
    series: [
      {
        name: '每日总费用',
        type: 'line',
        smooth: true,
        connectNulls: false,
        itemStyle: { color: '#1677ff' },
        data: series.map((p) => p.totalCny),
      },
      {
        name: '累计',
        type: 'line',
        smooth: true,
        connectNulls: false,
        lineStyle: { width: 0 },
        itemStyle: { color: '#1677ff' },
        areaStyle: { color: 'rgba(22, 119, 255, 0.1)' },
        data: cumulative,
        ...(hasProjection
          ? {
              markLine: {
                silent: true,
                symbol: 'none',
                lineStyle: { color: '#ff4d4f', type: 'dashed' },
                label: {
                  formatter: `月末预测（${month.cycle}）¥${month.projectedEndCny!.toFixed(2)}`,
                },
                data: [{ yAxis: month.projectedEndCny }],
              },
            }
          : {}),
      },
    ],
  }

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <InfoTip title="累计只累加「数据完整」的日期：当日缺账单或缺计价时断开，不补 0、不平推前值，因此断点之后的累计值偏低（不含未知日）。「本月已发生 / 月末预测」固定为昨日所在账期，与上方所选区间无关；当月账单为暂估（终账在次月 3 日 12 点后）。" />
      </div>
      <ReactECharts option={option} style={{ height: 320 }} notMerge />
    </div>
  )
}
