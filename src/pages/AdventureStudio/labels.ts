import dayjs from 'dayjs'
import type {
  AdventureInteractionType,
  ImportAction,
  RecoveryCode,
  SegmentKind,
  VersionStatus,
} from '../../types/adventureAdmin'
import { AUDIT_ACTIONS } from '../../types/adventureAdmin'

/**
 * 纯展示映射：服务端下发英文枚举，这里只负责翻译成内容创作者看得懂的中文。
 *
 * 枚举的**取值范围**不在这里定义——那是 GET capabilities 的职责。前端不硬编码
 * 「有哪些交互原语 / 有哪些 IP」，否则服务端新增一项，前端下拉框就会静默少一项，
 * 而且不会有任何报错。这里的映射只用于「已知的值怎么显示」，未知值一律原样透出
 * 并配 default 色，宁可显示得丑，也不要显示得错。
 */

interface Meta {
  label: string
  color: string
}

const FALLBACK_COLOR = 'default'

export const CHARACTER_LABELS: Record<string, string> = {
  elly: '小象 Elly',
  polly: '小马 Polly',
}

export function characterLabel(key: string): string {
  return CHARACTER_LABELS[key] ?? key
}

const INTERACTION_LABELS: Record<AdventureInteractionType, string> = {
  open_question: '开放问答',
  two_choice: '二选一',
  repeat_after_me: '跟我念',
  reward: '奖励',
}

export function interactionLabel(type: string | null | undefined): string {
  if (!type) return '—'
  return INTERACTION_LABELS[type as AdventureInteractionType] ?? type
}

const SEGMENT_KIND_LABELS: Record<SegmentKind, string> = {
  narration: '旁白',
  interaction: '互动',
}

export function segmentKindLabel(kind: string): string {
  return SEGMENT_KIND_LABELS[kind as SegmentKind] ?? kind
}

const VERSION_STATUS_META: Record<VersionStatus, Meta> = {
  draft: { label: '草稿', color: 'gold' },
  published: { label: '当前发布版', color: 'green' },
  superseded: { label: '历史版本', color: 'default' },
  discarded: { label: '已作废', color: 'red' },
}

export function versionStatusMeta(status: string): Meta {
  return VERSION_STATUS_META[status as VersionStatus] ?? {
    label: status,
    color: FALLBACK_COLOR,
  }
}

/**
 * 审计动作的配色跟着「可逆性」走，不是跟着词性走：
 * - 绿：让内容面对孩子（publish / restore）
 * - 蓝：只动草稿，随时可丢（create / create_draft / update_draft / discard_draft）
 * - 橙：改的是线上播放内容或整批搬运（revert / import / export）
 * - 红：会收走孩子进度或永久占用业务键（retire / discard）
 * - 红底：系统自检发现问题（self_check_failed）
 */
const AUDIT_ACTION_META: Record<string, Meta> = {
  create: { label: '新建故事集', color: 'blue' },
  create_draft: { label: '新建草稿', color: 'blue' },
  update_draft: { label: '保存草稿', color: 'blue' },
  publish: { label: '发布', color: 'green' },
  revert: { label: '快速回滚', color: 'orange' },
  retire: { label: '下架', color: 'red' },
  restore: { label: '恢复上架', color: 'green' },
  discard_draft: { label: '丢弃草稿', color: 'blue' },
  discard: { label: '作废整集', color: 'red' },
  export: { label: '导出 bundle', color: 'orange' },
  import: { label: '导入', color: 'orange' },
  import_noop: { label: '导入（无变更）', color: 'default' },
  self_check_failed: { label: '发布自检漂移', color: 'red' },
  recovery_sweep: { label: '手动巡检', color: 'purple' },
  recovery_breaker_reset: { label: '解除熔断', color: 'purple' },
}

export function auditActionMeta(action: string): Meta {
  return AUDIT_ACTION_META[action] ?? { label: action, color: FALLBACK_COLOR }
}

/** 审计筛选下拉框的选项：取值来自服务端会写入的全集，不靠人回忆 */
export const AUDIT_ACTION_OPTIONS = AUDIT_ACTIONS.map((action) => ({
  value: action,
  label: auditActionMeta(action).label,
}))

const IMPORT_ACTION_META: Record<ImportAction, Meta> = {
  add: { label: '新增', color: 'green' },
  replace: { label: '替换', color: 'orange' },
  already_up_to_date: { label: '内容一致，跳过', color: 'default' },
  reject: { label: '拒绝', color: 'red' },
}

export function importActionMeta(action: string): Meta {
  return IMPORT_ACTION_META[action as ImportAction] ?? {
    label: action,
    color: FALLBACK_COLOR,
  }
}

/**
 * 巡检病态码。`effect` 一栏是给运维看的处置口径，与
 * docs/analytics-api.md 的 detector 表逐行对齐——巡检的安全边界是
 * 「绝不改写内容、绝不烧掉孩子的当日额度」，所以一半的码是**仅告警**，
 * 面板上必须让人一眼看出哪些会动数据、哪些不会。
 */
const RECOVERY_CODE_META: Record<RecoveryCode, { label: string; effect: string }> =
  {
    STALE_AWAITING_REPLY: {
      label: '长时间等待孩子回答',
      effect: '默认关闭（off/alert/exit 可配）',
    },
    AWAITING_NON_INTERACTION: {
      label: '等待态但当前段不是互动点',
      effect: '修复：进度 → exited',
    },
    VERSION_ROW_MISSING: {
      label: '版本快照行缺失',
      effect: '仅告警（引擎已回落段落表）',
    },
    VERSION_PAYLOAD_UNUSABLE: {
      label: '版本快照内容不可用',
      effect: '仅告警（引擎已回落段落表）',
    },
    SEGMENT_ORDER_OVERFLOW: {
      label: '段号越过段落总数',
      effect: '等待态修复 → exited；在播态仅告警',
    },
    DAILY_PROGRESS_STATE_CONFLICT: {
      label: '当日记录与进度状态冲突',
      effect: '修复：当日记录镜像进度终态',
    },
    RETIRED_STALE_DAILY: {
      label: '已下架集的跨天在播记录',
      effect: '修复：当日记录与进度 → abandoned',
    },
    SEGMENT_TABLE_DRIFT: {
      label: '段落表与快照漂移',
      effect: '仅告警（绝不改写内容）',
    },
    DAILY_WITHOUT_PLAYABLE_PROGRESS: {
      label: '有当日记录但无可播进度',
      effect: '仅告警（下次开机自愈）',
    },
  }

export function recoveryCodeMeta(code: string): { label: string; effect: string } {
  return RECOVERY_CODE_META[code as RecoveryCode] ?? { label: code, effect: '—' }
}

// ---- 时间格式化 ----
// 全站时区已由 utils/date-range 统一设为 Asia/Shanghai，这里直接用 dayjs 格式化。

export function fmtDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const parsed = dayjs(value)
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm:ss') : String(value)
}

export function fmtDate(value: string | null | undefined): string {
  if (!value) return '—'
  const parsed = dayjs(value)
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : String(value)
}

export function fmtDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '—'
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(1)} s`
}

/** 内容哈希只用于「两份内容是不是同一份」，展示前 12 位足够，全量哈希没有可读性 */
export function shortHash(hash: string | null | undefined): string {
  if (!hash) return '—'
  return hash.length > 12 ? `${hash.slice(0, 12)}…` : hash
}

/** 把秒数说成人话：试播时长估算用 */
export function fmtSeconds(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) {
    return '—'
  }
  const total = Math.round(seconds)
  if (total < 60) return `${total} 秒`
  return `${Math.floor(total / 60)} 分 ${total % 60} 秒`
}
