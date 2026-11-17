import { rangePatch, readOptionalEnumParam, readParam, readRangeParams } from '../../utils/url-state'
import type { QueryPatch } from '../../utils/url-state'
import type { DayRange } from '../../utils/date-range'

/**
 * 消息明细页的筛选条件与 URL 的双向映射。
 *
 * 单独成模块有两个原因：一是纯函数好测（脏 URL、半截区间、空串都要有确定行为），
 * 二是别的页面要往消息明细带条件跳转时，参数名以这里为准，不各自拼字符串。
 */

export const ROLES = ['user', 'assistant'] as const
export const STATUSES = ['completed', 'failed', 'interrupted'] as const

/** 筛选条件（不含分页/排序，那些是视图状态不进 URL） */
export interface Filters {
  range: DayRange | null
  deviceId: string
  role?: 'user' | 'assistant'
  status?: 'completed' | 'failed' | 'interrupted'
  keyword: string
  /** 对话模式（平级 mode，对应服务端 messages.mode 原值） */
  mode?: string
}

export const EMPTY_FILTERS: Filters = {
  range: null,
  deviceId: '',
  role: undefined,
  status: undefined,
  keyword: '',
  mode: undefined,
}

/** 生效条件只从 URL 读：刷新、分享、别的页面带条件跳进来都能还原现场 */
export function filtersFromUrl(searchParams: URLSearchParams): Filters {
  return {
    range: readRangeParams(searchParams),
    deviceId: readParam(searchParams, 'deviceId') ?? '',
    role: readOptionalEnumParam(searchParams, 'role', ROLES),
    status: readOptionalEnumParam(searchParams, 'status', STATUSES),
    keyword: readParam(searchParams, 'keyword') ?? '',
    // mode 全集由服务端下发（含 legacy 值），前端不做白名单，非法值交给后端返回空页
    mode: readParam(searchParams, 'mode') ?? undefined,
  }
}

/** 写回 URL：空值删键，不留 ?role= 这种看起来筛了其实没筛的参数 */
export function filtersToPatch(filters: Filters): QueryPatch {
  return {
    ...rangePatch(filters.range),
    deviceId: filters.deviceId.trim() || null,
    role: filters.role ?? null,
    status: filters.status ?? null,
    keyword: filters.keyword.trim() || null,
    mode: filters.mode ?? null,
  }
}
