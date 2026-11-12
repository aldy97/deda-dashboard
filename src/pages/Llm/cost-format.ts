/**
 * 全站统一的 LLM 费用金额格式化（与 formatMs/formatRate 约定一致）。
 * 规则：
 * - null → '—'（缺数据，不能当 0）；
 * - |v| >= 1 → 2 位小数；
 * - |v| < 1 → 4 位小数；
 * - 负数保留负号；
 * - 前缀 ¥。
 */
export const formatCny = (value: number | null): string => {
  if (value === null) return '—'
  const abs = Math.abs(value)
  const decimals = abs >= 1 ? 2 : 4
  return `¥${value.toFixed(decimals)}`
}
