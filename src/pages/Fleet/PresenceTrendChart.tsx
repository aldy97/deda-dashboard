import { Empty } from 'antd'
import ReactECharts from 'echarts-for-react'
import type { FleetPresenceTrendResponse } from '../../types/analytics'
import InfoTip from '../../components/InfoTip'

/**
 * 每日开机台数（柱状） + 开机率（折线，右轴，%）。
 * null 值留断点不补 0（connectNulls: false）。
 * 区间上限 62 天已在页面层限制。
 */
export default function PresenceTrendChart({
  data,
}: {
  data: FleetPresenceTrendResponse
}) {
  const { series, presenceSince } = data
  if (series.length === 0) {
    return <Empty description="所选区间暂无数据" />
  }

  const dates = series.map((p) => p.date.slice(5))

  // 标注 presenceSince 位置（markLine）
  const presenceSinceLine =
    presenceSince !== null
      ? {
          silent: true,
          symbol: 'none',
          lineStyle: { color: '#faad14', type: 'dashed' as const },
          label: {
            formatter: `落库起始 {c}`,
            position: 'start' as const,
          },
          data: [
            {
              xAxis: presenceSince.slice(5),
              label: { formatter: `落库起始\n${presenceSince.slice(5)}` },
            },
          ],
        }
      : undefined

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
        const poweredOn =
          point.devicesPoweredOn !== null ? `${point.devicesPoweredOn} 台` : '—'
        const rate =
          point.powerOnRate !== null
            ? `${(point.powerOnRate * 100).toFixed(1)}%`
            : '—'
        const reports =
          point.reportCount !== null ? `${point.reportCount} 次` : '—'
        return [
          `${point.date}`,
          `开机台数：${poweredOn}`,
          `开机率：${rate}`,
          `心跳次数：${reports}`,
        ].join('<br/>')
      },
    },
    legend: { data: ['开机台数', '开机率'], bottom: 0 },
    grid: { left: 52, right: 52, top: 24, bottom: 56 },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: false,
    },
    yAxis: [
      { type: 'value', name: '台', minInterval: 1 },
      {
        type: 'value',
        name: '%',
        axisLabel: { formatter: '{value}%' },
      },
    ],
    series: [
      {
        name: '开机台数',
        type: 'bar',
        barMaxWidth: 16,
        connectNulls: false,
        data: series.map((p) => p.devicesPoweredOn),
        ...(presenceSinceLine ? { markLine: presenceSinceLine } : {}),
      },
      {
        name: '开机率',
        type: 'line',
        smooth: true,
        showSymbol: false,
        yAxisIndex: 1,
        connectNulls: false,
        data: series.map((p) =>
          p.powerOnRate !== null ? +(p.powerOnRate * 100).toFixed(1) : null,
        ),
      },
    ],
  }

  return (
    <div>
      {presenceSince && (
        <div style={{ marginBottom: 8 }}>
          <InfoTip
            title={`presence 数据最早自 ${presenceSince} 起落库，早于此日期的指标为 null（断点）。`}
          />
        </div>
      )}
      <ReactECharts option={option} style={{ height: 360 }} notMerge />
    </div>
  )
}
