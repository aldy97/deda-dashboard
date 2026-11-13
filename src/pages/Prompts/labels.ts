import type {
  PromptCategory,
  PromptVersionItem,
} from '../../types/analytics'
import { SCENE_META } from '../Llm/scenes'

/**
 * prompt 列表/详情的展示口径。
 *
 * 状态不存枚举、完全由 draftRevision / publishedRevision 两个指针派生
 * （服务端就是这么设计的），所以派生逻辑集中在这一处，列表与编辑器共用，
 * 避免两边各写一套判断然后互相矛盾。
 */

export const CATEGORY_LABEL: Record<PromptCategory, string> = {
  small_model: '小模型',
  main_rules: '主模型规则段',
  story: '故事话术',
  persona: '角色人设',
}

export function categoryLabel(category: PromptCategory | string): string {
  return CATEGORY_LABEL[category as PromptCategory] ?? category
}

/** scene 为 null 表示该 prompt 不绑定单一调用场景（如人设、话术后缀） */
export function sceneLabel(scene: string | null): string {
  if (!scene) return '—'
  return SCENE_META[scene]?.label ?? scene
}

export type PromptStateKind =
  | 'unedited'
  | 'draft-only'
  | 'published'
  | 'published-with-draft'

export interface PromptStateView {
  kind: PromptStateKind
  /** 表格里直接渲染的文案 */
  text: string
  color: string
  hasDraft: boolean
  hasPublished: boolean
}

export function resolvePromptState(item: {
  publishedRevision: number | null
  draftRevision: number | null
}): PromptStateView {
  const { publishedRevision, draftRevision } = item
  if (publishedRevision === null && draftRevision === null) {
    return {
      kind: 'unedited',
      text: '未编辑（生效=代码默认值）',
      color: 'default',
      hasDraft: false,
      hasPublished: false,
    }
  }
  if (publishedRevision === null && draftRevision !== null) {
    return {
      kind: 'draft-only',
      text: `草稿 r${draftRevision}（未发布）`,
      color: 'gold',
      hasDraft: true,
      hasPublished: false,
    }
  }
  if (publishedRevision !== null && draftRevision === null) {
    return {
      kind: 'published',
      text: `已发布 r${publishedRevision}`,
      color: 'green',
      hasDraft: false,
      hasPublished: true,
    }
  }
  return {
    kind: 'published-with-draft',
    text: `已发布 r${publishedRevision} · 待发布草稿 r${draftRevision}`,
    color: 'gold',
    hasDraft: true,
    hasPublished: true,
  }
}

/** 生效来源：DB 已发布版本 / 回落到代码默认值 */
export function sourceLabel(source: 'db' | 'default'): {
  text: string
  color: string
} {
  return source === 'db'
    ? { text: 'DB 已发布', color: 'blue' }
    : { text: '代码默认值', color: 'default' }
}

/** 发布 / 回滚 / 恢复默认三个动作的按钮文案与弹窗标题 */
export type PublishActionKind = 'publish' | 'rollback' | 'reset'

export const ACTION_LABEL: Record<PublishActionKind, string> = {
  publish: '发布草稿',
  rollback: '回滚到历史版本',
  reset: '恢复代码默认值',
}

/** 版本行的状态标签：当前生效 / 草稿 / 历史 */
export function versionStateTags(version: PromptVersionItem) {
  if (version.isPublished) return { text: '当前生效', color: 'green' }
  if (version.isDraft) return { text: '草稿', color: 'gold' }
  return { text: '历史', color: 'default' }
}
