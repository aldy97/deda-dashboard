import { describe, expect, it } from 'vitest'
import {
  readMessageSafety,
  safetyReplyLabel,
  safetySourceLabelForMessage,
} from './message-safety'

describe('readMessageSafety', () => {
  const valid = {
    layer: 'L2',
    category: 'violence',
    blocked: true,
    source: 'l2_model',
    matched: null,
    reply: 'canned_block',
    inferred: false,
    backfilledAt: '2026-11-23T10:00:00.000Z',
  }

  it('读取合法的 rawPayload.safety', () => {
    expect(readMessageSafety({ channel: 'baidu-rtc', safety: valid })).toEqual(
      valid,
    )
  })

  it('缺失/非对象/形状不合法时返回 null', () => {
    expect(readMessageSafety(null)).toBeNull()
    expect(readMessageSafety({ channel: 'baidu-rtc' })).toBeNull()
    expect(readMessageSafety({ safety: null })).toBeNull()
    expect(readMessageSafety({ safety: 'text' })).toBeNull()
    expect(readMessageSafety({ safety: { layer: 'L2' } })).toBeNull()
  })

  it('兼容推断回补快照', () => {
    const inferred = {
      ...valid,
      layer: null,
      category: null,
      blocked: false,
      source: 'inferred_from_reply',
      reply: 'unsafe_line_echo',
      inferred: true,
    }
    expect(readMessageSafety({ safety: inferred })).toEqual(inferred)
  })
})

describe('safetyReplyLabel', () => {
  it('把后端枚举翻译成中文', () => {
    expect(safetyReplyLabel('canned_block')).toBe('代码固定话术')
    expect(safetyReplyLabel('unsafe_line_echo')).toBe('模型回抄安全句')
    expect(safetyReplyLabel('caution_injected')).toBe('仅注入谨慎指令')
    expect(safetyReplyLabel('none')).toBe('未触发')
    expect(safetyReplyLabel('unknown')).toBe('未知')
  })
})

describe('safetySourceLabelForMessage', () => {
  it('推断来源单独标注，不能伪装成模型判定', () => {
    expect(safetySourceLabelForMessage('inferred_from_reply')).toBe(
      '由 AI 回复推断',
    )
    expect(safetySourceLabelForMessage('l2_model')).toBe('L2 小模型判定')
  })
})
