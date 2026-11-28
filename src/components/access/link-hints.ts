import { isOpsPath } from '../../layouts/menu'

/**
 * 链接目的地文案的唯一来源。
 *
 * `AccessLink` 只接受这里的目标键，不接受自由文本：同一目的地出现在多个页面时
 * （设备 ID 在舰队、家长档案、测试白名单都会出现），文案不会各写一份后漂移。
 */
export type LinkHintTarget =
  | 'device-profile'
  | 'parent-profile'
  | 'message-detail'
  | 'message-list'
  | 'memory-archive'
  | 'feedback-user'
  | 'engagement'
  | 'content'
  | 'llm-perf'
  | 'llm-safety'
  | 'prompts'
  | 'adventure'
  | 'test-devices'

interface TargetDef {
  label: string
  /** 目标页路径；ops 判定取剥掉 query 后的一级路径 */
  path: string
}

export const TARGETS: Record<LinkHintTarget, TargetDef> = {
  'device-profile': { label: '设备档案', path: '/users/:deviceId' },
  'parent-profile': { label: '家长档案', path: '/parents/:userId' },
  'message-detail': { label: '消息明细 · 该轮问答', path: '/messages?turnId=' },
  'message-list': { label: '消息明细', path: '/messages' },
  'memory-archive': { label: '记忆档案', path: '/memories/:deviceId' },
  'feedback-user': { label: '使用反馈（用户反馈 tab）', path: '/feedback?tab=user' },
  engagement: { label: '使用行为', path: '/engagement' },
  content: { label: '内容与质量', path: '/content' },
  'llm-perf': { label: '模型监控 · 性能', path: '/llm?tab=perf' },
  'llm-safety': { label: '模型监控 · 安全', path: '/llm?tab=safety' },
  prompts: { label: '提示词管理', path: '/prompts' },
  adventure: { label: '冒险内容工作台', path: '/adventure' },
  'test-devices': { label: '测试设备白名单', path: '/test-devices' },
}

/** 目标是否落在运维组（超管专属） */
export function isOpsTarget(target: LinkHintTarget): boolean {
  return isOpsPath(TARGETS[target].path.split('?')[0])
}

export interface LinkHintOptions {
  /** 目标页内的具体位置，如「该集版本快照」 */
  detail?: string
  /** 一起带过去的上下文，如 ['deviceId'] */
  carries?: readonly string[]
  /** 目标页仅超管可访问 */
  exclusive?: boolean
}

/**
 * 悬停文案。只给拿到链接的人看：普通 admin 侧不渲染链接、也不渲染本文案，
 * 「仅超管可访问」这层信息只在 superadmin 侧出现，避免两套说法。
 */
export function linkHintTitle(
  target: LinkHintTarget,
  { detail, carries, exclusive }: LinkHintOptions = {},
): string {
  const label = detail ? `${TARGETS[target].label} · ${detail}` : TARGETS[target].label
  const parts = [`点击前往「${label}」`]
  if (exclusive) parts.push('（超级管理员专属）')
  if (carries && carries.length > 0) parts.push(`，会带上 ${carries.join('、')}`)
  return parts.join('')
}
