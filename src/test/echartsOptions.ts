/**
 * echarts-for-react 测试替身收集到的原始 option 对象。
 *
 * DOM 上的 data-option 经过 JSON.stringify，tooltip.formatter 这类函数字段会整段丢失，
 * 而 formatter 里往往藏着占比计算与空值兜底（total=0 → 「—」、无数据桶 → 「暂无数据」）。
 * 断言 tooltip 文案时从这里取活对象，按渲染顺序索引。
 *
 * 注意：同一个测试里若组件重渲染，会追加新的条目；只在「渲染一次即断言」的场景使用。
 */
export const chartOptions: Array<Record<string, unknown>> = []

export function resetChartOptions(): void {
  chartOptions.length = 0
}

/** tooltip.formatter 的入参形状，只声明各图 formatter 真正读到的字段 */
export interface TooltipParam {
  name: string
  seriesName: string
  value: number | null
  dataIndex: number
}

export type TooltipFormatter = (params: TooltipParam[]) => string

/** 从活 option 里取出 tooltip.formatter；拿不到就抛，避免断言变成恒真 */
export function tooltipOf(
  option: Record<string, unknown> | undefined,
): TooltipFormatter {
  if (!option) throw new Error('图表未渲染，取不到 option')
  const tooltip = option.tooltip as { formatter?: TooltipFormatter } | undefined
  if (!tooltip?.formatter) throw new Error('option.tooltip.formatter 不存在')
  return tooltip.formatter
}
