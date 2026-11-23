import { describe, expect, it } from 'vitest'
import { PAGE_LABELS, kpiDefs, pct } from './kpi-defs'
import type { OverviewResponse } from '../../types/analytics'

function overview(): OverviewResponse {
  return {
    date: '2026-11-14',
    totals: {
      devicesRegistered: 1200,
      devicesActivated: 800,
      usersRegistered: 600,
      activationRate: 0.667,
    },
    today: {
      dau: 120,
      dauDeltaPct: 5.2,
      avgDurationSecondsPerActiveDevice: 1800,
      avgTurnsPerActiveDevice: 12,
      devicesPoweredOn: 200,
      powerOnRate: 0.25,
      onlineNow: 15,
    },
    retention: { d1: 0.55, d7: 0.35, d30: null },
    funnel: {
      shipped: null,
      activated: 800,
      firstConversation: 750,
      active7d: 400,
    },
  }
}

describe('pct', () => {
  it('null 显示 -', () => {
    expect(pct(null)).toBe('-')
  })

  it('小数转百分比，保留一位', () => {
    expect(pct(0.667)).toBe('66.7%')
    expect(pct(0)).toBe('0.0%')
  })
})

describe('kpiDefs', () => {
  it('每张卡都带出口，且出口页面在 PAGE_LABELS 里有名字', () => {
    const defs = kpiDefs(overview())
    expect(defs).toHaveLength(10)
    for (const def of defs) {
      expect(PAGE_LABELS[def.href]).toBeTruthy()
    }
  })

  it('按指标语义分发到四个出口', () => {
    const hrefs = kpiDefs(overview()).map((def) => def.href)
    expect(hrefs).toEqual([
      '/fleet',
      '/fleet',
      '/users',
      '/engagement',
      '/engagement',
      '/engagement',
      '/retention',
      '/fleet',
      '/fleet',
      '/fleet',
    ])
  })

  it('累计激活设备带累计入库脚注', () => {
    const [first] = kpiDefs(overview())
    expect(first.note).toBe('累计入库 1200 台')
  })

  it('环比与估算口径走 footer，值来自数据', () => {
    const defs = kpiDefs(overview())
    expect(defs.find((def) => def.key === 'dau')?.footer).toEqual({
      kind: 'delta',
      value: 5.2,
    })
    expect(
      defs.find((def) => def.key === 'avgDuration')?.footer,
    ).toEqual({ kind: 'estimate' })
  })

  it('实时在线 / 当日开机为 null 时显示 - 且不带单位', () => {
    const base = overview()
    const defs = kpiDefs({
      ...base,
      today: { ...base.today, onlineNow: null, devicesPoweredOn: null },
    })
    for (const key of ['onlineNow', 'devicesPoweredOn']) {
      const def = defs.find((item) => item.key === key)
      expect(def?.value).toBe('-')
      expect(def?.suffix).toBe('')
    }
  })

  it('时长为秒转分钟的估算值', () => {
    const def = kpiDefs(overview()).find((item) => item.key === 'avgDuration')
    expect(def?.value).toBe(30)
    expect(def?.suffix).toBe('分钟')
  })
})
