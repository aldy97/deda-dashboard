import { describe, expect, it } from 'vitest'
import {
  CATEGORY_LABEL,
  categoryLabel,
  resolvePromptState,
  sceneLabel,
  sourceLabel,
} from './labels'

describe('categoryLabel', () => {
  it('四个分类都有中文名', () => {
    expect(CATEGORY_LABEL).toEqual({
      small_model: '小模型',
      main_rules: '主模型规则段',
      story: '故事话术',
      persona: '角色人设',
    })
  })

  it('服务端新增分类时原样透出，不渲染 undefined', () => {
    expect(categoryLabel('brand_new_category')).toBe('brand_new_category')
  })
})

describe('sceneLabel', () => {
  it('null 场景显示破折号（人设、话术后缀不绑定单一场景）', () => {
    expect(sceneLabel(null)).toBe('—')
  })

  it('已知场景复用模型监控的中文名，两处口径一致', () => {
    expect(sceneLabel('chat_main')).toBe('主对话回答')
    expect(sceneLabel('intent_classify')).toBeTruthy()
  })

  it('未知场景原样透出，不吞掉信息', () => {
    expect(sceneLabel('some_new_scene')).toBe('some_new_scene')
  })
})

describe('resolvePromptState', () => {
  it('两个指针都为空 = 未编辑，生效的是代码默认值', () => {
    const state = resolvePromptState({
      publishedRevision: null,
      draftRevision: null,
    })

    expect(state.kind).toBe('unedited')
    expect(state.hasDraft).toBe(false)
    expect(state.hasPublished).toBe(false)
    expect(state.text).toContain('代码默认值')
  })

  it('只有草稿 = 尚未发布，不能让管理员误以为已生效', () => {
    const state = resolvePromptState({
      publishedRevision: null,
      draftRevision: 2,
    })

    expect(state.kind).toBe('draft-only')
    expect(state.text).toBe('草稿 r2（未发布）')
    expect(state.hasDraft).toBe(true)
    expect(state.hasPublished).toBe(false)
  })

  it('只有已发布 = 线上生效中', () => {
    const state = resolvePromptState({
      publishedRevision: 3,
      draftRevision: null,
    })

    expect(state.kind).toBe('published')
    expect(state.text).toBe('已发布 r3')
    expect(state.hasDraft).toBe(false)
    expect(state.hasPublished).toBe(true)
  })

  it('两个指针都有 = 已发布 + 待发布草稿，两个版本号都要显示', () => {
    const state = resolvePromptState({
      publishedRevision: 3,
      draftRevision: 5,
    })

    expect(state.kind).toBe('published-with-draft')
    expect(state.text).toBe('已发布 r3 · 待发布草稿 r5')
    expect(state.hasDraft).toBe(true)
    expect(state.hasPublished).toBe(true)
  })

  it('revision 0 不被当成 null（服务端草稿号从 1 起，0 只用于乐观锁入参）', () => {
    const state = resolvePromptState({ publishedRevision: 0, draftRevision: 0 })

    expect(state.kind).toBe('published-with-draft')
  })
})

describe('sourceLabel', () => {
  it('db 与 default 给出可区分的文案与配色', () => {
    expect(sourceLabel('db')).toEqual({ text: 'DB 已发布', color: 'blue' })
    expect(sourceLabel('default')).toEqual({
      text: '代码默认值',
      color: 'default',
    })
  })
})
