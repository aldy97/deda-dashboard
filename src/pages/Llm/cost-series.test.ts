import { describe, expect, it } from 'vitest'
import { dayTotalMissing, dayTotalPartial } from './cost-series'
import type { LlmCostSeriesItem } from '../../types/analytics'

function point(overrides: Partial<LlmCostSeriesItem> = {}): LlmCostSeriesItem {
  return {
    date: '2026-11-20',
    smallCny: 0.1,
    mainCny: 0.2,
    otherCny: 0,
    totalCny: 0.3,
    smallTokens: 1000,
    mainTokens: 2000,
    smallCnyPerMillionTokens: 100,
    mainCnyPerMillionTokens: 100,
    smallSource: 'bill',
    mainSource: 'estimated',
    mainAccuracy: 'exact',
    settled: true,
    ...overrides,
  }
}

describe('dayTotalPartial 逐日合计是否缺源', () => {
  it('完整日不算缺源', () => {
    expect(dayTotalPartial(point())).toBe(false)
  })

  it('小模型账单未出（smallCny=null）即算缺源', () => {
    expect(dayTotalPartial(point({ smallCny: null }))).toBe(true)
  })

  it('有主模型 token 但未计价（mainCny=null）算缺源', () => {
    expect(
      dayTotalPartial(point({ mainCny: null, mainTokens: 1234 })),
    ).toBe(true)
  })

  it('mainTokens=0 且 mainCny=null 是「当天没有主模型调用」，不算缺源', () => {
    expect(
      dayTotalPartial(point({ mainCny: null, mainTokens: 0 })),
    ).toBe(false)
  })

  it('当天 totalCny 为 null（整日无数据）不算「合计不完整」', () => {
    expect(
      dayTotalPartial(
        point({ totalCny: null, smallCny: null, mainCny: null }),
      ),
    ).toBe(false)
  })
})

describe('dayTotalMissing 缺哪一块的说明', () => {
  it('完整日返回 null', () => {
    expect(dayTotalMissing(point())).toBeNull()
  })

  it('只缺小模型账单', () => {
    expect(dayTotalMissing(point({ smallCny: null }))).toBe(
      '合计不含qwen-flash（当日账单未出）',
    )
  })

  it('只缺主模型计价', () => {
    expect(
      dayTotalMissing(point({ mainCny: null, mainTokens: 88 })),
    ).toBe('合计不含历史主模型（有 token 但未计价）')
  })

  it('两块都缺时用顿号连接', () => {
    expect(
      dayTotalMissing(point({ smallCny: null, mainCny: null, mainTokens: 88 })),
    ).toBe('合计不含qwen-flash（当日账单未出）、历史主模型（有 token 但未计价）')
  })
})
