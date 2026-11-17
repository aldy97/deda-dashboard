/**
 * 记忆槽位元数据：与 deda-server child-memory.registry.ts 白名单对齐，
 * 模型不能创造新槽位，这里也不允许出现白名单外的 key。
 */
export const MEMORY_KEYS = [
  'favorite_color',
  'favorite_animal',
  'favorite_story_type',
  'preferred_interaction',
  'interest_topic',
] as const

export type MemoryKey = (typeof MEMORY_KEYS)[number]

export const MEMORY_KEY_LABELS: Record<MemoryKey, string> = {
  favorite_color: '最喜欢的颜色',
  favorite_animal: '最喜欢的动物',
  favorite_story_type: '最喜欢的故事类型',
  preferred_interaction: '偏好互动方式',
  interest_topic: '兴趣话题',
}

export const memoryKeyLabel = (key: string): string =>
  MEMORY_KEY_LABELS[key as MemoryKey] ?? key

export const CHANGE_TYPE_META: Record<string, { label: string; color: string }> = {
  initial: { label: '初次记录', color: 'blue' },
  supersede: { label: '更新', color: 'orange' },
  retract: { label: '撤回', color: 'red' },
}

export const STATUS_META: Record<string, { label: string; color: string }> = {
  active: { label: '生效中', color: 'green' },
  superseded: { label: '已被更新', color: 'default' },
  retracted: { label: '已撤回', color: 'red' },
}
