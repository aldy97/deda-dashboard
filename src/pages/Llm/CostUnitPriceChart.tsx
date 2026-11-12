import { Empty } from 'antd'
import ReactECharts from 'echarts-for-react'
import type { LlmCostResponse, LlmOfficialPriceLine } from '../../types/analytics'
import InfoTip from '../../components/InfoTip'

const SMALL_MODEL = 'qwen-flash'
const MAIN_MODEL = 'deepseek-flash'
/** 只画未命中输入价与输出价：日单价是输入/输出的混合值，命中价单独画没有对照意义 */
const REFERENCE_KINDS: LlmOfficialPriceLine['kind'][] = ['input_miss', 'output']

interface ReferenceLines {
  small: LlmOfficialPriceLine[]
  main: LlmOfficialPriceLine[]
}

/**
 * 参考线全部取自后端 pricing.lines，前端不写任何价格或档位字面量。
 * - 小模型：qwen-flash 按上下文长度分档，取**最低档**（后端按 QWEN_FLASH_TIERS 升序 push，
 *   数组第一条即最低档；实际流量几乎全落此档）。档位标签由数据推导，后端改格式不会静默失效。
 * - 主模型：取空闲时段价（日单价是峰谷混合值，参考线只作量级锚点；label 里已带「空闲」字样）。
 */
function pickReferenceLines(lines: LlmOfficialPriceLine[]): ReferenceLines {
  const qwen = lines.filter((l) => l.model === SMALL_MODEL && l.band === null)
  const lowestTier = qwen[0]?.tierLabel ?? null
  return {
    small: qwen.filter(
      (l) =>
        lowestTier !== null &&
        l.tierLabel === lowestTier &&
        REFERENCE_KINDS.includes(l.kind),
    ),
    main: lines.filter(
      (l) =>
        l.model === MAIN_MODEL &&
        l.band === 'off_peak' &&
        REFERENCE_KINDS.includes(l.kind),
    ),
  }
}

function priceLineMark(
  line: LlmOfficialPriceLine,
  color: string,
): Record<string, unknown> {
  return {
    yAxis: line.cnyPerMillionTokens,
    silent: true,
    symbol: 'none',
    lineStyle: { color, type: 'dashed' },
    label: {
      formatter: `${line.label} ¥${line.cnyPerMillionTokens.toFixed(4)}`,
      position: 'end',
    },
  }
}

/**
 * 图C：小模型与主模型的每日百万 token 单价折线 + 定价参考线。
 * 把「量」的影响除掉，一眼看出 prompt 变胖、缓存失效、峰谷占比漂移；
 * 小模型这条还能直接验证账单解析对不对。
 */
export default function CostUnitPriceChart({ data }: { data: LlmCostResponse }) {
  const { series, pricing } = data

  if (series.length === 0) {
    return <Empty description="所选区间暂无费用数据" />
  }

  const dates = series.map((p) => p.date.slice(5))

  const smallColor = '#1677ff'
  const mainColor = '#fa8c16'
  const { small, main } = pickReferenceLines(pricing.lines)
  const markLines: Record<string, unknown>[] = [
    ...small.map((l) => priceLineMark(l, smallColor)),
    ...main.map((l) => priceLineMark(l, mainColor)),
  ]

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: (
        params: Array<{ seriesName: string; value: number | null; dataIndex: number }>,
      ) => {
        const idx = params[0]?.dataIndex ?? 0
        const point = series[idx]
        const lines = params.map((p) => {
          const val =
            p.value !== null ? `¥${p.value.toFixed(4)}/M tokens` : '—'
          return `${p.seriesName}：${val}`
        })
        return [`${point.date}`, ...lines].join('<br/>')
      },
    },
    legend: { data: ['小模型单价', '主模型单价'], bottom: 0 },
    grid: { left: 56, right: 24, top: 24, bottom: 56 },
    xAxis: { type: 'category', data: dates },
    yAxis: {
      type: 'value',
      name: '¥/M tokens',
      axisLabel: { formatter: '{value}' },
    },
    series: [
      {
        name: '小模型单价',
        type: 'line',
        smooth: true,
        connectNulls: false,
        itemStyle: { color: smallColor },
        data: series.map((p) => p.smallCnyPerMillionTokens),
        ...(markLines.length > 0
          ? { markLine: { silent: true, symbol: 'none', data: markLines } }
          : {}),
      },
      {
        name: '主模型单价',
        type: 'line',
        smooth: true,
        connectNulls: false,
        itemStyle: { color: mainColor },
        data: series.map((p) => p.mainCnyPerMillionTokens),
      },
    ],
  }

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <InfoTip
          title={`单价 = 日费用 / 日百万 token 数（小模型分母为全部 token，主模型分母为已计价 token）；null 表示当天无对应消费。虚线为官网定价参考线，取自 pricing.version=${pricing.version} 的 pricing.lines，前端不硬编码价格。`}
        />
      </div>
      <ReactECharts option={option} style={{ height: 320 }} notMerge />
    </div>
  )
}
