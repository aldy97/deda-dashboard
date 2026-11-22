import { describe, expect, it } from 'vitest'
import {
  AUDIT_ACTION_OPTIONS,
  auditActionMeta,
  characterLabel,
  fmtDate,
  fmtDateTime,
  fmtDuration,
  fmtSeconds,
  importActionMeta,
  interactionLabel,
  recoveryCodeMeta,
  segmentKindLabel,
  shortHash,
  versionStatusMeta,
} from './labels'

describe('labels · 枚举展示映射', () => {
  it('已知的 IP 用中文名，未知值原样透出', () => {
    expect(characterLabel('elly')).toBe('小象 Elly')
    expect(characterLabel('polly')).toBe('小马 Polly')
    expect(characterLabel('unknown-ip')).toBe('unknown-ip')
  })

  it('交互原语：空值给破折号，已知翻译，未知透出', () => {
    expect(interactionLabel(null)).toBe('—')
    expect(interactionLabel(undefined)).toBe('—')
    expect(interactionLabel('')).toBe('—')
    expect(interactionLabel('two_choice')).toBe('二选一')
    expect(interactionLabel('mystery')).toBe('mystery')
  })

  it('段落类型：已知翻译，未知透出', () => {
    expect(segmentKindLabel('narration')).toBe('旁白')
    expect(segmentKindLabel('interaction')).toBe('互动')
    expect(segmentKindLabel('chorus')).toBe('chorus')
  })

  it('版本状态：四种状态各有配色，未知值回退默认色', () => {
    expect(versionStatusMeta('draft')).toEqual({ label: '草稿', color: 'gold' })
    expect(versionStatusMeta('published')).toEqual({
      label: '当前发布版',
      color: 'green',
    })
    expect(versionStatusMeta('superseded')).toEqual({
      label: '历史版本',
      color: 'default',
    })
    expect(versionStatusMeta('discarded')).toEqual({ label: '已作废', color: 'red' })
    expect(versionStatusMeta('weird')).toEqual({ label: 'weird', color: 'default' })
  })

  it('审计动作：已知动作有中文与配色，未知动作透出并回退默认色', () => {
    expect(auditActionMeta('publish')).toEqual({ label: '发布', color: 'green' })
    expect(auditActionMeta('revert')).toEqual({ label: '快速回滚', color: 'orange' })
    expect(auditActionMeta('self_check_failed')).toEqual({
      label: '发布自检漂移',
      color: 'red',
    })
    expect(auditActionMeta('manual_thing')).toEqual({
      label: 'manual_thing',
      color: 'default',
    })
  })

  it('审计筛选选项覆盖服务端动作全集并按中文标签展示', () => {
    expect(AUDIT_ACTION_OPTIONS.length).toBe(17)
    expect(AUDIT_ACTION_OPTIONS).toContainEqual({ value: 'discard', label: '作废整集' })
  })

  it('导入动作：四种已知 + 未知兜底', () => {
    expect(importActionMeta('add')).toEqual({ label: '新增', color: 'green' })
    expect(importActionMeta('replace')).toEqual({ label: '替换', color: 'orange' })
    expect(importActionMeta('already_up_to_date')).toEqual({
      label: '内容一致，跳过',
      color: 'default',
    })
    expect(importActionMeta('reject')).toEqual({ label: '拒绝', color: 'red' })
    expect(importActionMeta('mystery')).toEqual({
      label: 'mystery',
      color: 'default',
    })
  })

  it('巡检病态码：已知码带处置口径，未知码 effect 为破折号', () => {
    expect(recoveryCodeMeta('STALE_AWAITING_REPLY')).toEqual({
      label: '长时间等待孩子回答',
      effect: '默认关闭（off/alert/exit 可配）',
    })
    expect(recoveryCodeMeta('SEGMENT_TABLE_DRIFT')).toEqual({
      label: '段落表与快照漂移',
      effect: '仅告警（绝不改写内容）',
    })
    expect(recoveryCodeMeta('NEW_CODE')).toEqual({ label: 'NEW_CODE', effect: '—' })
  })
})

describe('labels · 格式化', () => {
  // CI 跑 UTC、本地是 Asia/Shanghai：期望值按运行环境算，不硬编码钟点
  const pad = (n: number) => String(n).padStart(2, '0')
  const localDateTime = (iso: string) => {
    const d = new Date(iso)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }
  const localDate = (iso: string) => {
    const d = new Date(iso)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }

  it('fmtDateTime：空值给破折号，合法时间按秒格式化，非法输入原样返回', () => {
    expect(fmtDateTime(null)).toBe('—')
    expect(fmtDateTime(undefined)).toBe('—')
    expect(fmtDateTime('')).toBe('—')
    expect(fmtDateTime('2026-11-20T10:00:00+08:00')).toBe(
      localDateTime('2026-11-20T10:00:00+08:00'),
    )
    expect(fmtDateTime('not-a-date')).toBe('not-a-date')
  })

  it('fmtDate：空值给破折号，合法时间按天格式化，非法输入原样返回', () => {
    expect(fmtDate(null)).toBe('—')
    expect(fmtDate('2026-11-20T10:00:00+08:00')).toBe(
      localDate('2026-11-20T10:00:00+08:00'),
    )
    expect(fmtDate('nonsense')).toBe('nonsense')
  })

  it('fmtDuration：空值 / 非有限数给破折号，毫秒与秒两档', () => {
    expect(fmtDuration(null)).toBe('—')
    expect(fmtDuration(undefined)).toBe('—')
    expect(fmtDuration(Number.NaN)).toBe('—')
    expect(fmtDuration(Number.POSITIVE_INFINITY)).toBe('—')
    expect(fmtDuration(999)).toBe('999 ms')
    expect(fmtDuration(1000)).toBe('1.0 s')
    expect(fmtDuration(12_340)).toBe('12.3 s')
  })

  it('shortHash：空值给破折号，超过 12 位截断并加省略号', () => {
    expect(shortHash(null)).toBe('—')
    expect(shortHash('')).toBe('—')
    expect(shortHash('abc')).toBe('abc')
    expect(shortHash('a'.repeat(12))).toBe('a'.repeat(12))
    expect(shortHash('a'.repeat(13))).toBe(`${'a'.repeat(12)}…`)
  })

  it('fmtSeconds：空值 / 非有限数给破折号，分钟与秒两档', () => {
    expect(fmtSeconds(null)).toBe('—')
    expect(fmtSeconds(undefined)).toBe('—')
    expect(fmtSeconds(Number.NaN)).toBe('—')
    expect(fmtSeconds(59.4)).toBe('59 秒')
    expect(fmtSeconds(60)).toBe('1 分 0 秒')
    expect(fmtSeconds(125)).toBe('2 分 5 秒')
  })
})
