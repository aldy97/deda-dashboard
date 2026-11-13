import type {
  IntentSummaryResponse,
  SafetySummaryResponse,
} from '../../types/analytics'

/**
 * 判定质量（安全拦截 + 意图路由）的静态元数据与派生口径。
 * 与 scenes.ts 的分工：那边解释「模型调用健康吗」的场景枚举，
 * 这边解释「模型的判定可信吗」的来源/类别枚举。
 *
 * 后端只下发 key，中文名、着色与业务语义由前端维护（沿用 scenes.ts 的既有约定）。
 * 契约见 deda-server docs/analytics-api.md「判定质量监控（decisions）」。
 */

export interface SafetySourceMeta {
  label: string
  /** antd Tag color */
  color: string
  /** 该来源的结果是「放行」（未阻断本轮对话） */
  passes: boolean
  /** 静默降级：不报错、走兜底判定，升高说明小模型在退化或不可用 */
  silentDegrade: boolean
  /** 已知盲区：编排上根本没走到 L2 */
  blindSpot: boolean
  description: string
}

/**
 * 键顺序即看板展示顺序，勿随意调整。
 * 这五项覆盖全部 safetySource 取值（DB 列默认值 "none" 不会出现：
 * recorder 恒定解析成 not_evaluated 兜底）。
 */
export const SAFETY_SOURCE_META: Record<string, SafetySourceMeta> = {
  l1_regex: {
    label: 'L1 正则命中',
    color: 'red',
    passes: false,
    silentDegrade: false,
    blindSpot: false,
    description:
      '关键词/正则闸直接拦下，未调小模型。量突增先看 safetyMatched 是否误伤孩子的气话。',
  },
  l2_model: {
    label: 'L2 小模型判定',
    color: 'blue',
    passes: false,
    silentDegrade: false,
    blindSpot: false,
    description:
      '小模型给出了契约内的合法标签（含 safe），是唯一「真审过」的来源。是否放行取决于类别。',
  },
  l2_invalid_label: {
    label: 'L2 非法标签放行',
    color: 'volcano',
    passes: true,
    silentDegrade: true,
    blindSpot: false,
    description:
      '小模型有响应，但标签不在契约内（含把 unsafe/not safe 判成放行的反向陷阱）→ 放行。' +
      '静默降级，升高=prompt 退化或模型漂移。',
  },
  l2_fail_open: {
    label: 'L2 调用异常放行',
    color: 'orange',
    passes: true,
    silentDegrade: true,
    blindSpot: false,
    description:
      '小模型调用超时/异常 → 放行，仅靠 L3 大模型 system prompt 兜底。' +
      '静默降级，升高=模型不可用，可与「性能监控」tab 的 safety_l2 成功率按 turnId 对照。',
  },
  not_evaluated: {
    label: '未做 L2（冒险接管）',
    color: 'default',
    passes: true,
    silentDegrade: false,
    blindSpot: true,
    description:
      '编排顺序是 L1 → 冒险接管 → Promise.all([L2, intent])，所以冒险互动轮次完全绕过 L2，' +
      '只有 L1 正则兜着。已知盲区，本期只监控不改行为。',
  },
}

/** 键顺序 = 后端 CATEGORY_SEVERITY_ORDER（按严重度排，不按计数）；null 单列 */
export const SAFETY_CATEGORY_META: Record<string, { label: string; color: string }> = {
  sexual: { label: '涉性', color: 'magenta' },
  self_harm: { label: '自伤', color: 'red' },
  violence: { label: '暴力', color: 'volcano' },
  emotional_harm: { label: '情绪伤害', color: 'gold' },
  safe: { label: '安全', color: 'green' },
}

/** 七标签，与 deda-server ConversationIntent 对齐 */
export const INTENT_META: Record<string, { label: string; color: string }> = {
  free_chat: { label: '自由聊天', color: 'blue' },
  adventure_story: { label: '冒险故事', color: 'purple' },
  english_story: { label: '英语故事', color: 'cyan' },
  idiom_story: { label: '成语故事', color: 'geekblue' },
  sleep_story: { label: '哄睡故事', color: 'default' },
  free_story: { label: '自由故事', color: 'lime' },
  sleep_config: { label: '哄睡设置', color: 'gold' },
}

export interface IntentSourceMeta {
  label: string
  color: string
  /** 该来源根本没走到意图路由（被拦截 / 被冒险接管 / 匿名链路） */
  notRouted: boolean
  description: string
}

/** 十项：7 条决策出口 + 3 条编排层来源 */
export const INTENT_SOURCE_META: Record<string, IntentSourceMeta> = {
  model: {
    label: '小模型判定',
    color: 'green',
    notRouted: false,
    description: '小模型输出了契约内的合法意图标签，是唯一「模型真判过」的来源。',
  },
  fallback_invalid_label: {
    label: '兜底·标签非法',
    color: 'volcano',
    notRouted: false,
    description:
      '小模型有响应但标签非法 → 关键词兜底。升高=prompt 退化，与 fallbackRate 一起告警。',
  },
  fallback_error: {
    label: '兜底·调用异常',
    color: 'orange',
    notRouted: false,
    description:
      '小模型超时/异常 → 关键词兜底。可按 turnId 与 llm_usage_logs.failureReason 拼接定位原因。',
  },
  pre_filter_skip: {
    label: '正则未命中·直接闲聊',
    color: 'cyan',
    notRouted: false,
    description:
      'isRoutingCandidate 正则未命中，直接判 free_chat 不调模型。占比过高=词表覆盖不足，' +
      '孩子说了想听故事却进不了故事模式。',
  },
  continuation: {
    label: '会话续接',
    color: 'blue',
    notRouted: false,
    description: '活跃会话内按 continuation 规则接管，沿用当前模式，不调模型。',
  },
  session_sticky: {
    label: '会话粘滞',
    color: 'geekblue',
    notRouted: false,
    description: '会话 TTL 内保持既有模式（英语/成语/哄睡故事），不调模型。',
  },
  explicit_exit: {
    label: '显式退出',
    color: 'purple',
    notRouted: false,
    description: '孩子明确说要退出当前模式 → free_chat，不调模型。',
  },
  not_routed: {
    label: '未路由·被安全拦截',
    color: 'red',
    notRouted: true,
    description: '本轮被 L1/L2 拦下，根本没走到意图分类。intent 恒为 null。',
  },
  adventure_takeover: {
    label: '冒险接管',
    color: 'default',
    notRouted: true,
    description:
      '冒险状态机在编排上早于意图路由接管本轮。与 safetySource=not_evaluated 是同一批轮次。',
  },
  no_device: {
    label: '匿名链路',
    color: 'gold',
    notRouted: true,
    description:
      '请求不带 user 字段，无会话状态可依赖，恒定 free_chat。属联调/异常流量，正常量应接近 0。',
  },
}

/** pivotIntentMatrix 中 source 为 null 时的占位键，避免与真实来源撞名 */
export const NULL_BUCKET = '__null__'

/**
 * 图表专用色值。与上面各 META 的 color 刻意分开：那是 antd Tag 的预设色名
 * （volcano / geekblue 等），不是合法 CSS 颜色，echarts 无法直接使用。
 * 色相与 Tag 保持同一语义（红=拦截、橙=静默降级、灰=盲区、绿=正常）。
 */
export const SAFETY_SOURCE_CHART_COLOR: Record<string, string> = {
  l1_regex: '#cf1322',
  l2_model: '#1677ff',
  l2_invalid_label: '#fa541c',
  l2_fail_open: '#fa8c16',
  not_evaluated: '#8c8c8c',
}

export const SAFETY_CATEGORY_CHART_COLOR: Record<string, string> = {
  sexual: '#eb2f96',
  self_harm: '#f5222d',
  violence: '#fa541c',
  emotional_harm: '#faad14',
  safe: '#52c41a',
}

/** 未能判定（category=null）在图表里的颜色，与 safe 的绿色严格区分 */
export const SAFETY_UNKNOWN_CHART_COLOR = '#bfbfbf'

/**
 * 意图来源图表色：绿=模型真判过，青/蓝/紫=规则接管（正常，不调模型），
 * 橙红=兜底（结果不可信），红=被拦截，灰=冒险接管盲区，金=匿名链路（应接近 0）。
 */
export const INTENT_SOURCE_CHART_COLOR: Record<string, string> = {
  model: '#52c41a',
  fallback_invalid_label: '#fa541c',
  fallback_error: '#fa8c16',
  pre_filter_skip: '#13c2c2',
  continuation: '#1677ff',
  session_sticky: '#2f54eb',
  explicit_exit: '#722ed1',
  not_routed: '#f5222d',
  adventure_takeover: '#8c8c8c',
  no_device: '#faad14',
}

export const safetySourceLabel = (source: string | null): string => {
  if (source === null) return '未知来源'
  return SAFETY_SOURCE_META[source]?.label ?? source
}

export const safetyCategoryLabel = (category: string | null): string => {
  // null 与 safe 严格区分：null 是「没判出来」，safe 是「判过且安全」
  if (category === null) return '未能判定'
  return SAFETY_CATEGORY_META[category]?.label ?? category
}

export const intentLabel = (intent: string | null): string => {
  if (intent === null) return '未走到路由'
  return INTENT_META[intent]?.label ?? intent
}

export const intentSourceLabel = (source: string | null): string => {
  if (source === null) return '未知来源'
  return INTENT_SOURCE_META[source]?.label ?? source
}

/** 静默降级：小模型该出结论却没出（非法标签 / 调用异常），不报错只放行 */
export const isSilentDegradeSource = (source: string | null): boolean =>
  source !== null && (SAFETY_SOURCE_META[source]?.silentDegrade ?? false)

/**
 * 未审计放行：结果是「放行」但 L2 实际没给出可信结论。
 * 比静默降级多含 not_evaluated（编排盲区）——这三类是安全看板的真正暴露面。
 */
export const isUnauditedPassSource = (source: string | null): boolean => {
  if (source === null) return false
  const meta = SAFETY_SOURCE_META[source]
  return !!meta && meta.passes && (meta.silentDegrade || meta.blindSpot)
}

export const silentDegradeCount = (summary: SafetySummaryResponse): number =>
  summary.failOpenCount + summary.invalidLabelCount

export const unauditedPassCount = (summary: SafetySummaryResponse): number =>
  summary.failOpenCount + summary.invalidLabelCount + summary.notEvaluatedCount

/** 分母 0 返回 null：「没数据」和「比率为 0」在看板上必须是两件事 */
export const unauditedPassRate = (
  summary: SafetySummaryResponse,
): number | null =>
  summary.total > 0 ? unauditedPassCount(summary) / summary.total : null

/**
 * 判定比率格式化。刻意不复用 scenes.ts 的 formatRate（一位小数）：
 * 拦截率常态低于 0.1%，一位小数会把 0.02% 和 0% 渲染成同一个「0.0%」，
 * 而这两者在安全语义上完全不同。
 */
export const formatDecisionRate = (rate: number | null): string =>
  rate === null ? '—' : `${(rate * 100).toFixed(2)}%`

export interface IntentStage {
  key: 'total' | 'routed' | 'model' | 'rule' | 'fallback'
  label: string
  count: number
  /** 相对 total 的占比；total 为 0 时 null */
  rate: number | null
  description: string
}

/** 未调模型但确实走到了意图路由的来源（规则/会话状态机接管） */
const RULE_SOURCES = [
  'pre_filter_skip',
  'continuation',
  'session_sticky',
  'explicit_exit',
]

/** 根本没走到意图路由的来源 */
const NOT_ROUTED_SOURCES = ['not_routed', 'adventure_takeover', 'no_device']

function countSources(
  summary: IntentSummaryResponse,
  wanted: string[],
): number {
  return summary.bySource.reduce(
    (sum, item) =>
      item.source !== null && wanted.includes(item.source)
        ? sum + item.count
        : sum,
    0,
  )
}

/**
 * 决策路径分层。从 bySource 现算而非直接用 notRoutedCount/adventureTakeoverCount：
 * 后端只单列了这两项，no_device 必须一并扣掉，否则 routed 会虚高。
 * 恒等式 routed = model + rule + fallback，测试锁死这条不变量。
 */
export function buildIntentStages(
  summary: IntentSummaryResponse,
): IntentStage[] {
  const total = summary.total
  const notRouted = countSources(summary, NOT_ROUTED_SOURCES)
  const rule = countSources(summary, RULE_SOURCES)
  const model = summary.modelInvokedCount
  const fallback = summary.fallbackCount
  const routed = Math.max(total - notRouted, 0)
  const rate = (count: number) => (total > 0 ? count / total : null)

  return [
    {
      key: 'total',
      label: '判定轮次',
      count: total,
      rate: rate(total),
      description:
        '有判定记录的轮次数。注意 ≤ 对话轮次数：埋点在每个 return 之前而非 finally，未捕获异常中断的轮次没有记录。',
    },
    {
      key: 'routed',
      label: '进入意图路由',
      count: routed,
      rate: rate(routed),
      description:
        '扣掉被安全拦截（not_routed）、冒险接管（adventure_takeover）、匿名链路（no_device）三类后，真正参与意图分类的轮次。',
    },
    {
      key: 'model',
      label: '小模型给出结论',
      count: model,
      rate: rate(model),
      description: 'source=model。这一层跌了说明小模型在失效，是最该盯的一条线。',
    },
    {
      key: 'rule',
      label: '规则/会话接管',
      count: rule,
      rate: rate(rule),
      description:
        '正则未命中直接闲聊、会话续接、会话粘滞、显式退出——四类都不调模型。pre_filter_skip 占比过高=路由词表覆盖不足。',
    },
    {
      key: 'fallback',
      label: '关键词兜底',
      count: fallback,
      rate: rate(fallback),
      description:
        '模型标签非法或调用异常后走关键词兜底，结果不可信。健康状态应接近 0。',
    },
  ]
}

export interface IntentMatrixRow {
  intent: string | null
  total: number
  /** key 为 source（null 来源用 NULL_BUCKET）；缺组合不出键，由组件渲染「—」 */
  counts: Record<string, number>
}

/**
 * intent × source 交叉透视。行列都按总计数倒序（与后端 matrix 的排序口径一致），
 * 排查「孩子说要听故事却在闲聊」时，看 sleep_story 那一行的 pre_filter_skip 列。
 */
export function pivotIntentMatrix(
  matrix: Array<{ intent: string | null; source: string | null; count: number }>,
): { sources: string[]; rows: IntentMatrixRow[] } {
  const sourceTotals = new Map<string, number>()
  const intentTotals = new Map<string | null, number>()
  const cells = new Map<string | null, Record<string, number>>()

  for (const cell of matrix) {
    const sourceKey = cell.source ?? NULL_BUCKET
    sourceTotals.set(sourceKey, (sourceTotals.get(sourceKey) ?? 0) + cell.count)
    intentTotals.set(cell.intent, (intentTotals.get(cell.intent) ?? 0) + cell.count)
    const row = cells.get(cell.intent) ?? {}
    row[sourceKey] = (row[sourceKey] ?? 0) + cell.count
    cells.set(cell.intent, row)
  }

  const sources = Array.from(sourceTotals.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([source]) => source)

  const rows = Array.from(intentTotals.entries())
    .sort(
      (a, b) =>
        b[1] - a[1] || String(a[0] ?? '').localeCompare(String(b[0] ?? '')),
    )
    .map(([intent, total]) => ({
      intent,
      total,
      counts: cells.get(intent) ?? {},
    }))

  return { sources, rows }
}
