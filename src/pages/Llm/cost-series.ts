import type { LlmCostSeriesItem } from '../../types/analytics'

/**
 * 逐日「合计是否不完整」判定 —— 费用区块唯一口径，勿在各组件里另写一份。
 *
 * 后端 totalCny = smallMicro + otherMicro + mainMicro，其中缺账单日 smallMicro 取 0
 * （deda-server llm-cost.service.ts 的逐日装配），所以「当天有埋点、账单还没出」时
 * totalCny 是只含主模型的实数，而 smallCny 如实为 null —— 合计与分项不自洽。
 * 账单同步只补拉 T-1~T-3，最近 1–3 天必然处于该状态，不是边角情况。
 * totals.partial 只覆盖区间级（区间内有任一账单行即为 false），逐日必须自己判。
 *
 * mainTokens === 0 表示当天确实没有主模型调用，不算缺源。
 */
export const dayTotalPartial = (s: LlmCostSeriesItem): boolean =>
  s.totalCny !== null &&
  (s.smallCny === null || (s.mainCny === null && s.mainTokens > 0))

/** 当日合计缺了哪一块（tooltip 用，如实说明）；完整日返回 null */
export function dayTotalMissing(s: LlmCostSeriesItem): string | null {
  if (!dayTotalPartial(s)) return null
  const missing: string[] = []
  if (s.smallCny === null) missing.push('小模型（当日账单未出）')
  if (s.mainCny === null && s.mainTokens > 0) {
    missing.push('主模型（有 token 但未计价）')
  }
  return `合计不含${missing.join('、')}`
}
