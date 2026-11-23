import type { MessageSafetySnapshot } from '../../types/analytics'
import { safetySourceLabel } from '../Llm/decisions'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 从 rawPayload 读取历史回补的安全快照。
 * 形状不合法一律返回 null，避免 vendor 的任意 DTO 被误读成安全判定。
 */
export function readMessageSafety(raw: unknown): MessageSafetySnapshot | null {
  if (!isPlainObject(raw) || !isPlainObject(raw.safety)) return null
  const safety = raw.safety
  if (
    typeof safety.blocked !== 'boolean' ||
    typeof safety.source !== 'string' ||
    typeof safety.reply !== 'string' ||
    !(typeof safety.layer === 'string' || safety.layer === null) ||
    !(typeof safety.category === 'string' || safety.category === null) ||
    !(typeof safety.matched === 'string' || safety.matched === null)
  ) {
    return null
  }
  return {
    layer: safety.layer as string | null,
    category: safety.category as string | null,
    blocked: safety.blocked,
    source: safety.source,
    matched: safety.matched as string | null,
    reply: safety.reply,
    ...(typeof safety.inferred === 'boolean'
      ? { inferred: safety.inferred }
      : {}),
    ...(typeof safety.backfilledAt === 'string'
      ? { backfilledAt: safety.backfilledAt }
      : {}),
  }
}

const SAFETY_REPLY_LABELS: Record<string, string> = {
  canned_block: '代码固定话术',
  unsafe_line_echo: '模型回抄安全句',
  caution_injected: '仅注入谨慎指令',
  none: '未触发',
  unknown: '未知',
}

export function safetyReplyLabel(reply: string): string {
  return SAFETY_REPLY_LABELS[reply] ?? reply
}

export function safetySourceLabelForMessage(source: string): string {
  // 回溯来源必须单独标注，不能伪装成模型原始判定
  if (source === 'inferred_from_reply') return '由 AI 回复推断'
  return safetySourceLabel(source)
}
