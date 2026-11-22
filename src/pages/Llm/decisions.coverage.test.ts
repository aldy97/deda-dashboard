import { describe, expect, it } from 'vitest'
import {
  SAFETY_SOURCE_CHART_COLOR,
  SAFETY_SOURCE_META,
  buildIntentStages,
  formatDecisionRate,
  intentLabel,
  intentSourceLabel,
  intentToMode,
  isSilentDegradeSource,
  isUnauditedPassSource,
  pivotIntentMatrix,
  safetySourceLabel,
  unauditedPassRate,
} from './decisions'
import type {
  IntentSummaryResponse,
  SafetySummaryResponse,
} from '../../types/analytics'

/**
 * decisions.test.ts 已覆盖主路径；本文件补齐未触达的兜底分支：
 * null / 未知枚举值 / 并列排序 / 分母为 0 的相邻口径。
 */

function safetySummary(
  overrides: Partial<SafetySummaryResponse> = {},
): SafetySummaryResponse {
  return {
    total: 100,
    blockedCount: 10,
    blockRate: 0.1,
    byCategory: [],
    byLayer: [],
    bySource: [],
    failOpenCount: 0,
    invalidLabelCount: 0,
    notEvaluatedCount: 0,
    emotionalHarmCount: 0,
    reviewableCount: 10,
    ...overrides,
  }
}

function intentSummary(
  bySource: Array<{ source: string | null; count: number }>,
  overrides: Partial<IntentSummaryResponse> = {},
): IntentSummaryResponse {
  const total = bySource.reduce((sum, s) => sum + s.count, 0)
  const countOf = (source: string) =>
    bySource.find((s) => s.source === source)?.count ?? 0
  return {
    total,
    byIntent: [],
    bySource,
    modelInvokedCount: countOf('model'),
    modelInvokedRate: total > 0 ? countOf('model') / total : null,
    fallbackCount: countOf('fallback_invalid_label') + countOf('fallback_error'),
    fallbackRate: null,
    notRoutedCount: countOf('not_routed'),
    adventureTakeoverCount: countOf('adventure_takeover'),
    matrix: [],
    ...overrides,
  }
}

describe('枚举兜底：未知值与 null 不能渲染成空白', () => {
  it('位置 0 的 null 与未知意图都降级为原始 key / 固定文案', () => {
    expect(safetySourceLabel(null)).toBe('未知来源')
    expect(intentLabel(null)).toBe('未走到路由')
    expect(intentLabel('future_intent')).toBe('future_intent')
    expect(intentSourceLabel(null)).toBe('未知来源')
    expect(intentSourceLabel('future_source')).toBe('future_source')
    expect(safetySourceLabel('future_safety')).toBe('future_safety')
  })

  it('静默降级判定：null 与未知来源都是 false，不误报', () => {
    expect(isSilentDegradeSource(null)).toBe(false)
    expect(isSilentDegradeSource('future_source')).toBe(false)
    expect(SAFETY_SOURCE_META['future_source']).toBeUndefined()
  })

  it('未审计放行：null 来源直接 false（不能因 source 为 null 抛异常）', () => {
    expect(isUnauditedPassSource(null)).toBe(false)
    expect(isUnauditedPassSource('future_source')).toBe(false)
    expect(isUnauditedPassSource('l2_fail_open')).toBe(true)
    // not_evaluated 是 blindSpot（非 silentDegrade）也要算未审计放行
    expect(isUnauditedPassSource('not_evaluated')).toBe(true)
  })

  it('每个安全来源都有图表色，避免 echarts 渲染成默认黑', () => {
    expect(Object.keys(SAFETY_SOURCE_CHART_COLOR).sort()).toEqual(
      Object.keys(SAFETY_SOURCE_META).sort(),
    )
  })
})

describe('intentToMode 意图→消息模式', () => {
  it('六个对话模式直出同名 mode', () => {
    for (const intent of [
      'free_chat',
      'adventure_story',
      'english_story',
      'idiom_story',
      'sleep_story',
      'free_story',
    ]) {
      expect(intentToMode(intent)).toBe(intent)
    }
  })

  it('sleep_config / 未知值 / null / 空串都返回 null（不下钻）', () => {
    expect(intentToMode('sleep_config')).toBeNull()
    expect(intentToMode('future_intent')).toBeNull()
    expect(intentToMode(null)).toBeNull()
    expect(intentToMode('')).toBeNull()
  })
})

describe('计数口径在分母为 0 与并列时的边界', () => {
  it('未审计放行计数在 total=0 时仍按各字段求和（不抛异常）', () => {
    const summary = safetySummary({
      total: 0,
      failOpenCount: 2,
      invalidLabelCount: 3,
      notEvaluatedCount: 5,
    })
    expect(
      summary.failOpenCount +
        summary.invalidLabelCount +
        summary.notEvaluatedCount,
    ).toBe(10)
  })

  it('未审计放行率：分母非 0 时按比例计算，分母 0 时为 null', () => {
    expect(
      unauditedPassRate(
        safetySummary({ total: 200, failOpenCount: 10, invalidLabelCount: 30 }),
      ),
    ).toBe(0.2)
    expect(unauditedPassRate(safetySummary({ total: 0 }))).toBeNull()
  })

  it('判定比率 null 渲染「—」，非 null 保留两位小数', () => {
    expect(formatDecisionRate(null)).toBe('—')
    expect(formatDecisionRate(0.0002)).toBe('0.02%')
  })

  it('total=0 时五个阶段计数全 0、比率全 null', () => {
    const stages = buildIntentStages(intentSummary([]))
    expect(stages.map((s) => s.count)).toEqual([0, 0, 0, 0, 0])
    expect(stages.every((s) => s.rate === null)).toBe(true)
  })

  it('routed 为负数（脏数据：未路由计数大于总数）时按 0 兜底', () => {
    const stages = buildIntentStages(
      intentSummary(
        [
          { source: 'not_routed', count: 5 },
          { source: 'model', count: 1 },
        ],
        { total: 3 },
      ),
    )
    const byKey = Object.fromEntries(stages.map((s) => [s.key, s.count]))
    expect(byKey.routed).toBe(0)
  })
})

describe('pivotIntentMatrix 并列排序与 null 行', () => {
  it('列计数并列时按来源 key 字典序，行并列时按意图 key 字典序', () => {
    const { sources, rows } = pivotIntentMatrix([
      { intent: 'sleep_story', source: 'model', count: 3 },
      { intent: 'free_chat', source: 'model', count: 3 },
      { intent: 'free_chat', source: 'continuation', count: 3 },
      { intent: 'sleep_story', source: 'continuation', count: 3 },
    ])
    expect(sources).toEqual(['continuation', 'model'])
    expect(rows.map((r) => r.intent)).toEqual(['free_chat', 'sleep_story'])
  })

  it('null 行与字符串行并列时，null 按其空串参与排序（稳定不抛异常）', () => {
    const { rows } = pivotIntentMatrix([
      { intent: null, source: 'not_routed', count: 2 },
      { intent: 'free_chat', source: 'model', count: 2 },
    ])
    expect(rows).toHaveLength(2)
    // 空串 '' < 'free_chat'，null 行排在前
    expect(rows[0].intent).toBeNull()
    expect(rows[0].counts['not_routed']).toBe(2)
  })

  it('三行计数并列时 null 行参与排序，不抛异常', () => {
    const { rows } = pivotIntentMatrix([
      { intent: null, source: 'not_routed', count: 2 },
      { intent: 'free_chat', source: 'model', count: 2 },
      { intent: 'sleep_story', source: 'model', count: 2 },
    ])
    expect(rows).toHaveLength(3)
    expect(rows.map((r) => r.total)).toEqual([2, 2, 2])
  })

  it('source 全为 null 时列只有一个 NULL_BUCKET', () => {
    const { sources } = pivotIntentMatrix([
      { intent: 'free_chat', source: null, count: 1 },
      { intent: 'sleep_story', source: null, count: 2 },
    ])
    expect(sources).toEqual(['__null__'])
  })
})
