import { describe, expect, it } from 'vitest'
import { modeLabel } from './labels'
import {
  MODE_PROMPT_REFS,
  PRIMARY_PROMPT_KEY,
  isCharacterKey,
  isMappedMode,
  promptsEditorLink,
  promptsPersonaLink,
  resolveModePrompts,
} from './mode-prompts'

/** 与服务端 MODE_LABELS 同源的现行 mode；legacy 不在其中 */
const CURRENT_MODES = [
  'free_chat',
  'english_chat',
  'english_story',
  'idiom_story',
  'sleep_story',
  'adventure_story',
  'free_story',
] as const

/** deda-server prompt-keys.ts 的 PROMPT_KEYS 全集（16 项） */
const REGISTERED_PROMPT_KEYS = [
  'safety_l2_system',
  'intent_classify_system',
  'memory_extract_system',
  'sleep_config_extract_system',
  'adventure_interaction_system',
  'adventure_choice_match_system',
  'main_english_tutor_rules',
  'main_free_chat_rules',
  'main_story_mode_rules',
  'story_prompt_english',
  'story_prompt_idiom',
  'story_prompt_sleep',
  'story_prompt_free',
  'story_favorite_type_suffix',
  'persona_elly',
  'persona_polly',
]

describe('mode → 提示词组映射', () => {
  it('七个现行 mode 都有映射，且落点主提示词在清单内', () => {
    for (const mode of CURRENT_MODES) {
      expect(isMappedMode(mode)).toBe(true)
      expect(MODE_PROMPT_REFS[mode].length).toBeGreaterThan(0)
      expect(MODE_PROMPT_REFS[mode].map((r) => r.key)).toContain(
        PRIMARY_PROMPT_KEY[mode],
      )
    }
  })

  it('映射的 key 都是服务端已登记的可编辑 prompt，避免拼错 key 变成死链', () => {
    for (const refs of Object.values(MODE_PROMPT_REFS)) {
      for (const ref of refs) {
        expect(REGISTERED_PROMPT_KEYS).toContain(ref.key)
        expect(ref.note.length).toBeGreaterThan(0)
      }
    }
    expect(Object.keys(PRIMARY_PROMPT_KEY).sort()).toEqual(
      Object.keys(MODE_PROMPT_REFS).sort(),
    )
  })

  it('映射里没有不是现行 mode 的键（防止把 legacy 误挂上去）', () => {
    for (const mode of Object.keys(MODE_PROMPT_REFS)) {
      expect(modeLabel(mode)).not.toBe(mode)
    }
  })

  it('legacy / 未知 / 空 mode 一律不可映射', () => {
    const legacy = [
      'free_chat_casual',
      'free_chat_roleplay',
      'free_chat_qa',
      'daily_adventure',
      'adventure',
      'story',
      'sleep',
      'bedtime',
      'music',
      'device_control',
      'unknown',
    ]
    for (const mode of legacy) expect(isMappedMode(mode)).toBe(false)
    expect(isMappedMode('brand_new_mode')).toBe(false)
    expect(isMappedMode(null)).toBe(false)
    expect(isMappedMode(undefined)).toBe(false)
    expect(isMappedMode('')).toBe(false)
  })

  it('主模型规则段 / 故事话术按服务端实际拼装关系落位', () => {
    expect(MODE_PROMPT_REFS.free_chat.map((r) => r.key)).toEqual([
      'main_free_chat_rules',
    ])
    expect(MODE_PROMPT_REFS.english_chat.map((r) => r.key)).toEqual([
      'main_english_tutor_rules',
    ])
    expect(MODE_PROMPT_REFS.english_story.map((r) => r.key)).toEqual([
      'story_prompt_english',
      'story_favorite_type_suffix',
      'main_story_mode_rules',
    ])
    expect(MODE_PROMPT_REFS.idiom_story.map((r) => r.key)).toContain(
      'story_prompt_idiom',
    )
    expect(MODE_PROMPT_REFS.sleep_story.map((r) => r.key)).toContain(
      'story_prompt_sleep',
    )
    // adventure_story / free_story 共用降级话术 story_prompt_free
    expect(MODE_PROMPT_REFS.adventure_story.map((r) => r.key)).toEqual([
      'story_prompt_free',
      'story_favorite_type_suffix',
      'main_story_mode_rules',
      'adventure_interaction_system',
      'adventure_choice_match_system',
    ])
    expect(MODE_PROMPT_REFS.free_story.map((r) => r.key)).toEqual([
      'story_prompt_free',
      'story_favorite_type_suffix',
      'main_story_mode_rules',
    ])
  })
})

describe('promptsEditorLink / promptsPersonaLink', () => {
  it('模式链接把 mode、主提示词与角色一起带上，落点直接开编辑器', () => {
    expect(promptsEditorLink('free_chat', 'elly')).toBe(
      '/prompts?mode=free_chat&key=main_free_chat_rules&characterKey=elly',
    )
    expect(promptsEditorLink('english_story', 'polly')).toBe(
      '/prompts?mode=english_story&key=story_prompt_english&characterKey=polly',
    )
  })

  it('角色缺失或非法时不带 characterKey，链接依然可用', () => {
    expect(promptsEditorLink('free_chat', null)).toBe(
      '/prompts?mode=free_chat&key=main_free_chat_rules',
    )
    expect(promptsEditorLink('free_chat', 'Bad Key')).toBe(
      '/prompts?mode=free_chat&key=main_free_chat_rules',
    )
    expect(promptsEditorLink('free_chat', '')).toBe(
      '/prompts?mode=free_chat&key=main_free_chat_rules',
    )
  })

  it('legacy / 未知 / 空 mode 不生成链接（宁可不点，也不链错）', () => {
    expect(promptsEditorLink('music', 'elly')).toBeNull()
    expect(promptsEditorLink('brand_new_mode', 'elly')).toBeNull()
    expect(promptsEditorLink(null, 'elly')).toBeNull()
  })

  it('产品行人设链接只带 key；角色非法时不可点', () => {
    expect(promptsPersonaLink('elly')).toBe('/prompts?key=persona_elly')
    expect(promptsPersonaLink('momo-2')).toBe('/prompts?key=persona_momo-2')
    expect(promptsPersonaLink(null)).toBeNull()
    expect(promptsPersonaLink('Elly')).toBeNull()
    expect(promptsPersonaLink('a')).toBeNull()
    expect(promptsPersonaLink('')).toBeNull()
  })

  it('characterKey 规则与服务端 CHARACTER_KEY_PATTERN 一致（2-32 位小写开头）', () => {
    expect(isCharacterKey('elly')).toBe(true)
    expect(isCharacterKey('a1')).toBe(true)
    expect(isCharacterKey('a'.repeat(32))).toBe(true)
    expect(isCharacterKey('a'.repeat(33))).toBe(false)
    expect(isCharacterKey('1abc')).toBe(false)
    expect(isCharacterKey('ab c')).toBe(false)
    expect(isCharacterKey(null)).toBe(false)
  })
})

describe('resolveModePrompts（Prompts 页过滤与横幅）', () => {
  const catalog = new Set([
    'persona_elly',
    'persona_polly',
    'main_free_chat_rules',
    'main_story_mode_rules',
    'story_prompt_english',
    'story_prompt_free',
    'story_favorite_type_suffix',
    'adventure_interaction_system',
    'adventure_choice_match_system',
  ])

  it('人设按运行时顺序排在最前，其余按拼接顺序', () => {
    const resolved = resolveModePrompts('english_story', 'elly', catalog)
    expect(resolved?.refs.map((r) => r.key)).toEqual([
      'persona_elly',
      'story_prompt_english',
      'story_favorite_type_suffix',
      'main_story_mode_rules',
    ])
    expect(resolved?.persona).toEqual({
      key: 'persona_elly',
      fallback: false,
      missing: false,
    })
    expect(resolved?.refs.every((r) => r.missing === false)).toBe(true)
  })

  it('动态角色人设存在时直接用它', () => {
    const resolved = resolveModePrompts('free_chat', 'polly', catalog)
    expect(resolved?.persona?.key).toBe('persona_polly')
    expect(resolved?.refs[0].key).toBe('persona_polly')
  })

  it('角色未登记人设时按服务端真相回落 elly，并在说明里讲清楚', () => {
    const resolved = resolveModePrompts('free_chat', 'momo', catalog)
    expect(resolved?.persona).toEqual({
      key: 'persona_elly',
      fallback: true,
      missing: false,
    })
    expect(resolved?.refs[0].key).toBe('persona_elly')
    expect(resolved?.refs[0].note).toContain('回落')
  })

  it('角色与 elly 人设都不存在时标记缺失，不谎报已生效', () => {
    const resolved = resolveModePrompts('free_chat', 'momo', new Set())
    expect(resolved?.persona).toEqual({
      key: 'persona_momo',
      fallback: false,
      missing: true,
    })
    expect(resolved?.refs[0]).toMatchObject({
      key: 'persona_momo',
      missing: true,
    })
    expect(resolved?.refs[0].note).toContain('尚未创建')
  })

  it('没有角色信息时不展示人设项', () => {
    const resolved = resolveModePrompts('free_chat', null, catalog)
    expect(resolved?.persona).toBeNull()
    expect(resolved?.refs.map((r) => r.key)).toEqual(['main_free_chat_rules'])
  })

  it('非人设 key 缺失也标 missing，方便页面给出数据异常提示', () => {
    const resolved = resolveModePrompts('free_chat', 'elly', new Set(['persona_elly']))
    expect(resolved?.refs.find((r) => r.key === 'main_free_chat_rules'))
      .toMatchObject({ missing: true })
  })

  it('不可映射的 mode 返回 null，页面据此忽略参数', () => {
    expect(resolveModePrompts('music', 'elly', catalog)).toBeNull()
    expect(resolveModePrompts(null, 'elly', catalog)).toBeNull()
  })
})
