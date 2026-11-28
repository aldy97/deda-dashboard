import ReactECharts from 'echarts-for-react'

export interface DistributionItem {
  name: string
  value: number
}

const captionStyle = {
  textAlign: 'center' as const,
  color: 'rgba(0,0,0,0.45)',
}

function ChartShell({
  caption,
  option,
}: {
  caption: string
  option: Record<string, unknown>
}) {
  return (
    <div>
      <ReactECharts notMerge style={{ height: 260 }} option={option} />
      <div style={captionStyle}>{caption}</div>
    </div>
  )
}

/**
 * 分布饼图：家长/孩子/设备画像共用同一骨架，单位与标题由调用方传入。
 * 只做展示，PII 红线由数据源保证（调用方只传聚合计数）。
 */
export function DistributionPie({
  caption,
  seriesName,
  items,
  unit,
}: {
  caption: string
  seriesName: string
  items: DistributionItem[]
  unit: '台' | '人'
}) {
  const option = {
    tooltip: { trigger: 'item', formatter: `{b}: {c} ${unit}（{d}%）` },
    legend: { type: 'scroll', bottom: 0 },
    series: [
      {
        name: seriesName,
        type: 'pie',
        radius: ['40%', '65%'],
        center: ['50%', '45%'],
        label: { formatter: `{b}\n{c} ${unit}` },
        data: items,
      },
    ],
  }
  return <ChartShell caption={caption} option={option} />
}

/** 分布柱状图：与饼图同一套画布/标题骨架，单位决定 y 轴名称。 */
export function DistributionBar({
  caption,
  categories,
  values,
  unit,
}: {
  caption: string
  categories: string[]
  values: number[]
  unit: '台' | '人'
}) {
  const option = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 48, right: 24, top: 24, bottom: 56 },
    xAxis: { type: 'category', data: categories, axisLabel: { interval: 0 } },
    yAxis: { type: 'value', name: `${unit}数`, minInterval: 1 },
    series: [
      {
        type: 'bar',
        barMaxWidth: 48,
        label: { show: true, position: 'top' },
        itemStyle: { color: '#1677ff', borderRadius: [4, 4, 0, 0] },
        data: values,
      },
    ],
  }
  return <ChartShell caption={caption} option={option} />
}
