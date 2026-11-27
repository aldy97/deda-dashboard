/**
 * 对话模式 → 运行时提示词组的映射。
 *
 * 真相来源在服务端，本文件只是看板的只读镜像，服务端改映射必须同步这里：
 * - 主模型规则段按 mode 三选一：deda-server `src/modules/llm/llm.service.ts`
 *   （free_chat → main_free_chat_rules；五个故事 mode → main_story_mode_rules；
 *   其余 → main_english_tutor_rules）。
 * - 故事话术：deda-server `src/modules/prompt-registry/prompt-registry.service.ts`
 *   的 STORY_PROMPT_KEY_BY_INTENT（adventure_story / free_story 共用 story_prompt_free）。
 * - 人设恒在 system prompt 首位，未知角色回落 elly（同文件 DEFAULT_PERSONA_KEY）。
 *
 * 服务端将来新增 mode 时这里不会自动跟进：isMappedMode 返回 false，
 * 抽屉保持纯文本、不生成死链。宁可少一个入口，也不能链错提示词。
 */

export interface ModePromptRef {
  key: string
  /** 横幅里说明这段提示词在运行时的位置与影响面 */
  note: string
  /** true = 这段提示词被多个 mode 共用，改动影响面大于当前模式 */
  shared?: boolean
}

/** mode → 主模型提示词，按 system prompt 内的实际拼接顺序（人设由 resolve 动态插入最前） */
export const MODE_PROMPT_REFS: Record<string, readonly ModePromptRef[]> = {
  free_chat: [{ key: 'main_free_chat_rules', note: '自由对话规则段' }],
  english_chat: [
    { key: 'main_english_tutor_rules', note: '英语陪练规则段' },
  ],
  english_story: [
    { key: 'story_prompt_english', note: '英语故事话术' },
    {
      key: 'story_favorite_type_suffix',
      note: '孩子有偏好故事类型时追加',
    },
    {
      key: 'main_story_mode_rules',
      note: '故事模式通用规则段（改动影响所有故事模式）',
      shared: true,
    },
  ],
  idiom_story: [
    { key: 'story_prompt_idiom', note: '成语故事话术' },
    {
      key: 'story_favorite_type_suffix',
      note: '孩子有偏好故事类型时追加',
    },
    {
      key: 'main_story_mode_rules',
      note: '故事模式通用规则段（改动影响所有故事模式）',
      shared: true,
    },
  ],
  sleep_story: [
    { key: 'story_prompt_sleep', note: '哄睡故事话术' },
    {
      key: 'story_favorite_type_suffix',
      note: '孩子有偏好故事类型时追加',
    },
    {
      key: 'main_story_mode_rules',
      note: '故事模式通用规则段（改动影响所有故事模式）',
      shared: true,
    },
  ],
  adventure_story: [
    {
      key: 'story_prompt_free',
      note: '未真正进入冒险时的自由创作话术（与 free_story 共用）',
      shared: true,
    },
    {
      key: 'story_favorite_type_suffix',
      note: '孩子有偏好故事类型时追加',
    },
    {
      key: 'main_story_mode_rules',
      note: '故事模式通用规则段（改动影响所有故事模式）',
      shared: true,
    },
    {
      key: 'adventure_interaction_system',
      note: '冒险剧情互动反馈（独立小模型调用）',
    },
    {
      key: 'adventure_choice_match_system',
      note: '冒险二选一判定（受开关控制，默认关）',
    },
  ],
  free_story: [
    {
      key: 'story_prompt_free',
      note: '自由创作话术（与 adventure_story 共用）',
      shared: true,
    },
    {
      key: 'story_favorite_type_suffix',
      note: '孩子有偏好故事类型时追加',
    },
    {
      key: 'main_story_mode_rules',
      note: '故事模式通用规则段（改动影响所有故事模式）',
      shared: true,
    },
  ],
}

/**
 * 点击模式后直接打开的编辑器。
 * 取「这条消息由主模型哪段提示词生成」：聊天模式是规则段，故事模式是话术。
 */
export const PRIMARY_PROMPT_KEY: Record<string, string> = {
  free_chat: 'main_free_chat_rules',
  english_chat: 'main_english_tutor_rules',
  english_story: 'story_prompt_english',
  idiom_story: 'story_prompt_idiom',
  sleep_story: 'story_prompt_sleep',
  adventure_story: 'story_prompt_free',
  free_story: 'story_prompt_free',
}

/** 与 deda-server CHARACTER_KEY_PATTERN 一致：小写字母开头，2-32 位 */
const CHARACTER_KEY_PATTERN = /^[a-z][a-z0-9_-]{1,31}$/

const PERSONA_KEY_PREFIX = 'persona_'
const DEFAULT_PERSONA_KEY = 'persona_elly'

export function isMappedMode(mode: string | null | undefined): mode is string {
  return (
    typeof mode === 'string' &&
    Object.prototype.hasOwnProperty.call(MODE_PROMPT_REFS, mode)
  )
}

export function isCharacterKey(
  value: string | null | undefined,
): value is string {
  return typeof value === 'string' && CHARACTER_KEY_PATTERN.test(value)
}

/** 模式 → 提示词编辑器深链；legacy / 未知 mode 返回 null（不可点） */
export function promptsEditorLink(
  mode: string | null | undefined,
  characterKey: string | null | undefined,
): string | null {
  if (!isMappedMode(mode)) return null
  const params = new URLSearchParams({
    mode,
    key: PRIMARY_PROMPT_KEY[mode],
  })
  if (isCharacterKey(characterKey)) {
    params.set('characterKey', characterKey)
  }
  return `/prompts?${params.toString()}`
}

/** 产品（角色）→ 人设编辑器深链；角色 key 非法时返回 null */
export function promptsPersonaLink(
  characterKey: string | null | undefined,
): string | null {
  if (!isCharacterKey(characterKey)) return null
  return `/prompts?key=${PERSONA_KEY_PREFIX}${characterKey}`
}

export interface ResolvedModePromptRef {
  key: string
  note: string
  /** true = 跨模式共享，改动影响面大于当前模式 */
  shared?: boolean
  /** 目录里没有这个 key：页面应提示数据异常，而不是假装已生效 */
  missing: boolean
}

export interface ResolvedPersona {
  /** 实际展示/链接用的 key（未登记角色时可能是 persona_elly） */
  key: string
  /** true = 该角色未登记人设，运行时回落 elly */
  fallback: boolean
  /** true = 目录里既没有该角色人设也没有 elly */
  missing: boolean
}

export interface ResolvedModePrompts {
  /** 人设恒在最前，其后按 system prompt 内的拼接顺序 */
  refs: ResolvedModePromptRef[]
  /** null = 消息没有角色信息 */
  persona: ResolvedPersona | null
}

function resolvePersona(
  characterKey: string | null | undefined,
  catalogKeys: ReadonlySet<string>,
): ResolvedPersona | null {
  if (!isCharacterKey(characterKey)) return null
  const ownKey = `${PERSONA_KEY_PREFIX}${characterKey}`
  if (catalogKeys.has(ownKey)) {
    return { key: ownKey, fallback: false, missing: false }
  }
  if (catalogKeys.has(DEFAULT_PERSONA_KEY)) {
    return { key: DEFAULT_PERSONA_KEY, fallback: true, missing: false }
  }
  return { key: ownKey, fallback: false, missing: true }
}

function personaNote(persona: ResolvedPersona): string {
  if (persona.missing) return '角色人设（尚未创建，运行时暂无可编辑正文）'
  if (persona.fallback) return '角色人设（该角色未登记人设，运行时回落 elly）'
  return '角色人设（恒在 system prompt 首位）'
}

/** mode 不可映射时返回 null，调用方据此忽略 URL 参数 */
export function resolveModePrompts(
  mode: string | null | undefined,
  characterKey: string | null | undefined,
  catalogKeys: ReadonlySet<string>,
): ResolvedModePrompts | null {
  if (!isMappedMode(mode)) return null

  const persona = resolvePersona(characterKey, catalogKeys)
  const refs: ResolvedModePromptRef[] = MODE_PROMPT_REFS[mode].map((ref) => ({
    ...ref,
    missing: !catalogKeys.has(ref.key),
  }))
  if (persona) {
    refs.unshift({
      key: persona.key,
      note: personaNote(persona),
      missing: persona.missing,
    })
  }
  return { refs, persona }
}
