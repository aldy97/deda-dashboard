import { describe, expect, it } from 'vitest'
import {
  INTENT_META,
  INTENT_SOURCE_META,
  NULL_BUCKET,
  SAFETY_CATEGORY_META,
  SAFETY_SOURCE_META,
  buildIntentStages,
  formatDecisionRate,
  intentLabel,
  intentSourceLabel,
  isSilentDegradeSource,
  isUnauditedPassSource,
  pivotIntentMatrix,
  safetyCategoryLabel,
  safetySourceLabel,
  silentDegradeCount,
  unauditedPassCount,
  unauditedPassRate,
} from './decisions'
import type {
  IntentSummaryResponse,
  SafetySummaryResponse,
} from '../../types/analytics'

/** 造一个「健康」的安全概览，各测试按需覆盖字段 */
function safetySummary(
  overrides: Partial<SafetySummaryResponse> = {},
): SafetySummaryResponse {
  return {
    total: 1000,
    blockedCount: 20,
    blockRate: 0.02,
    byCategory: [],
    byLayer: [],
    bySource: [],
    failOpenCount: 0,
    invalidLabelCount: 0,
    notEvaluatedCount: 0,
    emotionalHarmCount: 0,
    reviewableCount: 20,
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
  const modelInvokedCount = countOf('model')
  const fallbackCount =
    countOf('fallback_invalid_label') + countOf('fallback_error')
  return {
    total,
    byIntent: [],
    bySource,
    modelInvokedCount,
    modelInvokedRate: total > 0 ? modelInvokedCount / total : null,
    fallbackCount,
    fallbackRate: total > 0 ? fallbackCount / total : null,
    notRoutedCount: countOf('not_routed'),
    adventureTakeoverCount: countOf('adventure_takeover'),
    matrix: [],
    ...overrides,
  }
}

describe('判定枚举的中文名与着色', () => {
  it('安全来源五项都有中文名，且未知值降级为原始 key', () => {
    expect(safetySourceLabel('l1_regex')).toBe('L1 正则命中')
    expect(safetySourceLabel('l2_fail_open')).toBe('L2 调用异常放行')
    expect(safetySourceLabel('not_evaluated')).toBe('未做 L2（冒险接管）')
    // 后端新增取值时不能渲染成空白
    expect(safetySourceLabel('some_future_source')).toBe('some_future_source')
  })

  it('safetySource 为 null 时显示「未知来源」而非空白', () => {
    expect(safetySourceLabel(null)).toBe('未知来源')
  })

  it('安全类别 null 与 safe 严格区分（不可合并展示）', () => {
    expect(safetyCategoryLabel('safe')).toBe('安全')
    expect(safetyCategoryLabel(null)).toBe('未能判定')
    expect(safetyCategoryLabel('self_harm')).toBe('自伤')
    expect(safetyCategoryLabel('future_category')).toBe('future_category')
  })

  it('意图七标签齐全，null 显示「未走到路由」', () => {
    expect(intentLabel('free_chat')).toBe('自由聊天')
    expect(intentLabel('sleep_config')).toBe('哄睡设置')
    expect(intentLabel(null)).toBe('未走到路由')
    expect(Object.keys(INTENT_META)).toHaveLength(7)
  })

  it('意图来源十项齐全，编排层三项单独标注', () => {
    expect(intentSourceLabel('model')).toBe('小模型判定')
    expect(intentSourceLabel('pre_filter_skip')).toBe('正则未命中·直接闲聊')
    expect(intentSourceLabel('adventure_takeover')).toBe('冒险接管')
    expect(intentSourceLabel('no_device')).toBe('匿名链路')
    expect(intentSourceLabel(null)).toBe('未知来源')
    expect(Object.keys(INTENT_SOURCE_META)).toHaveLength(10)
  })

  it('元数据表覆盖全部枚举值，避免新增取值漏配着色', () => {
    expect(Object.keys(SAFETY_SOURCE_META)).toEqual([
      'l1_regex',
      'l2_model',
      'l2_invalid_label',
      'l2_fail_open',
      'not_evaluated',
    ])
    expect(Object.keys(SAFETY_CATEGORY_META)).toEqual([
      'sexual',
      'self_harm',
      'violence',
      'emotional_harm',
      'safe',
    ])
  })
})

describe('静默降级 / 未审计放行的判定', () => {
  it('只有 l2_invalid_label 与 l2_fail_open 算「静默降级」', () => {
    expect(isSilentDegradeSource('l2_fail_open')).toBe(true)
    expect(isSilentDegradeSource('l2_invalid_label')).toBe(true)
    // 未评估是编排设计导致的盲区，不是降级，处置方式不同
    expect(isSilentDegradeSource('not_evaluated')).toBe(false)
    expect(isSilentDegradeSource('l2_model')).toBe(false)
    expect(isSilentDegradeSource('l1_regex')).toBe(false)
    expect(isSilentDegradeSource(null)).toBe(false)
  })

  it('三类「放行了但没真审」都算未审计放行', () => {
    expect(isUnauditedPassSource('l2_fail_open')).toBe(true)
    expect(isUnauditedPassSource('l2_invalid_label')).toBe(true)
    expect(isUnauditedPassSource('not_evaluated')).toBe(true)
    // l2_model 判 safe 是真审过；l1_regex 是拦下来
    expect(isUnauditedPassSource('l2_model')).toBe(false)
    expect(isUnauditedPassSource('l1_regex')).toBe(false)
  })

  it('silentDegradeCount = failOpen + invalidLabel', () => {
    expect(
      silentDegradeCount(safetySummary({ failOpenCount: 3, invalidLabelCount: 4 })),
    ).toBe(7)
  })

  it('unauditedPassCount 含未评估，比 silentDegradeCount 多算盲区', () => {
    const summary = safetySummary({
      failOpenCount: 3,
      invalidLabelCount: 4,
      notEvaluatedCount: 30,
    })
    expect(unauditedPassCount(summary)).toBe(37)
    expect(silentDegradeCount(summary)).toBe(7)
  })

  it('unauditedPassRate 分母 0 返回 null 而不是 0', () => {
    expect(unauditedPassRate(safetySummary({ total: 0 }))).toBeNull()
    expect(
      unauditedPassRate(
        safetySummary({ total: 200, failOpenCount: 10, notEvaluatedCount: 40 }),
      ),
    ).toBe(0.25)
  })
})

describe('formatDecisionRate', () => {
  it('null 渲染「—」，绝不渲染成 0%', () => {
    expect(formatDecisionRate(null)).toBe('—')
  })

  it('保留两位小数：拦截率可能低于 0.1%，一位小数会全变成 0.0%', () => {
    expect(formatDecisionRate(0.0002)).toBe('0.02%')
    expect(formatDecisionRate(0.02)).toBe('2.00%')
    expect(formatDecisionRate(1)).toBe('100.00%')
    expect(formatDecisionRate(0)).toBe('0.00%')
  })
})

describe('buildIntentStages 决策路径', () => {
  const healthy = intentSummary([
    { source: 'model', count: 100 },
    { source: 'pre_filter_skip', count: 400 },
    { source: 'continuation', count: 200 },
    { source: 'session_sticky', count: 150 },
    { source: 'explicit_exit', count: 50 },
    { source: 'fallback_invalid_label', count: 30 },
    { source: 'fallback_error', count: 20 },
    { source: 'not_routed', count: 25 },
    { source: 'adventure_takeover', count: 15 },
    { source: 'no_device', count: 10 },
  ])

  it('五个阶段：总数 / 进入路由 / 模型 / 规则接管 / 兜底', () => {
    expect(buildIntentStages(healthy).map((s) => s.key)).toEqual([
      'total',
      'routed',
      'model',
      'rule',
      'fallback',
    ])
  })

  it('routed 扣掉三类未走路由的来源，且 routed = model + rule + fallback', () => {
    const stages = buildIntentStages(healthy)
    const byKey = Object.fromEntries(stages.map((s) => [s.key, s.count]))
    // 1000 - 25(not_routed) - 15(adventure_takeover) - 10(no_device)
    expect(byKey.total).toBe(1000)
    expect(byKey.routed).toBe(950)
    expect(byKey.model).toBe(100)
    expect(byKey.rule).toBe(800)
    expect(byKey.fallback).toBe(50)
    expect(byKey.routed).toBe(byKey.model + byKey.rule + byKey.fallback)
  })

  it('rate 相对 total，total 为 0 时全部为 null', () => {
    const stages = buildIntentStages(healthy)
    expect(stages[0].rate).toBe(1)
    expect(stages[1].rate).toBeCloseTo(0.95, 5)
    expect(stages[2].rate).toBeCloseTo(0.1, 5)

    const empty = buildIntentStages(intentSummary([]))
    expect(empty.map((s) => s.count)).toEqual([0, 0, 0, 0, 0])
    expect(empty.every((s) => s.rate === null)).toBe(true)
  })

  it('每个阶段都带面向运营的说明文案', () => {
    for (const stage of buildIntentStages(healthy)) {
      expect(stage.label.length).toBeGreaterThan(0)
      expect(stage.description.length).toBeGreaterThan(0)
    }
  })
})

describe('pivotIntentMatrix 交叉表', () => {
  it('行列都按总计数倒序，null 用 NULL_BUCKET 占位', () => {
    const { sources, rows } = pivotIntentMatrix([
      { intent: 'free_chat', source: 'model', count: 5 },
      { intent: 'free_chat', source: 'pre_filter_skip', count: 100 },
      { intent: 'sleep_story', source: 'model', count: 40 },
      { intent: null, source: 'not_routed', count: 7 },
    ])
    // 列：pre_filter_skip(100) > model(45) > not_routed(7)
    expect(sources).toEqual(['pre_filter_skip', 'model', 'not_routed'])
    // 行：free_chat(105) > sleep_story(40) > null(7)
    expect(rows.map((r) => r.intent)).toEqual(['free_chat', 'sleep_story', null])
    expect(rows[0].total).toBe(105)
    expect(rows[0].counts['pre_filter_skip']).toBe(100)
    expect(rows[0].counts['model']).toBe(5)
    // 缺组合渲染成「—」由组件层处理，pivot 只保证不编造 0 以外的值
    expect(rows[0].counts['not_routed'] ?? 0).toBe(0)
    expect(rows[2].counts['not_routed']).toBe(7)
  })

  it('source 为 null 的分组落到 NULL_BUCKET，不与真实来源混淆', () => {
    const { sources, rows } = pivotIntentMatrix([
      { intent: 'free_chat', source: null, count: 3 },
    ])
    expect(sources).toEqual([NULL_BUCKET])
    expect(rows[0].counts[NULL_BUCKET]).toBe(3)
  })

  it('空矩阵返回空行列，不抛异常', () => {
    expect(pivotIntentMatrix([])).toEqual({ sources: [], rows: [] })
  })

  it('同 intent+source 重复出现时累加（后端已聚合，防御性处理）', () => {
    const { rows } = pivotIntentMatrix([
      { intent: 'free_chat', source: 'model', count: 5 },
      { intent: 'free_chat', source: 'model', count: 2 },
    ])
    expect(rows[0].counts['model']).toBe(7)
    expect(rows[0].total).toBe(7)
  })
})
