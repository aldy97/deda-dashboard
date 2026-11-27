import type { LlmTurnCall } from '../../types/analytics'

const round2 = (value: number) => Math.round(value * 100) / 100

/**
 * 调用开始时刻。
 *
 * `createdAt` 由数据库在插入时取默认值，而埋点在调用结束（非流式在响应返回后、
 * 流式在 finally）才写库，所以它表示的是**结束时刻**，开始时刻要减去 latencyMs。
 * 若将来服务端显式返回 startedAt，只需改这里与对应测试夹具。
 */
export function callStartMs(call: LlmTurnCall): number | null {
  const endMs = Date.parse(call.createdAt)
  if (Number.isNaN(endMs)) return null
  if (call.latencyMs === null || call.latencyMs < 0) return null
  return endMs - call.latencyMs
}

export interface TurnChainRow {
  call: LlmTurnCall
  durationMs: number | null
  /** 相对最早调用开始的偏移；耗时未知时为 null，结束点仍可定位 */
  startOffsetMs: number | null
  endOffsetMs: number | null
  /** 时间轴上的位置与宽度（%）；无法定位时为 null */
  leftPct: number | null
  widthPct: number | null
  /** 首包在时间轴上的位置（%）；非流式或耗时未知时为 null */
  ttftPct: number | null
  /** 与本行区间相交（真并行）的调用 id */
  parallelWith: string[]
}

export interface TurnChainLayout {
  /** 最早一次调用的开始时刻；全部不可定位时为 null */
  originIso: string | null
  totalMs: number
  rows: TurnChainRow[]
  unknownDurationCount: number
}

/**
 * 把一轮调用排成横向时间轴：零点 = 最早一次调用的开始，比例 = 真实毫秒。
 * 并发关系一律由区间相交推导，不按 scene 写死分组——服务端两条链路的调用组合
 * 并不相同（例如记忆抽取在 L2/意图之后才触发，与主回答并行）。
 */
export function buildTurnChainLayout(calls: LlmTurnCall[]): TurnChainLayout {
  const endMsList = calls.map((call) => {
    const parsed = Date.parse(call.createdAt)
    return Number.isNaN(parsed) ? null : parsed
  })
  const startMsList = calls.map((call, index) => {
    const end = endMsList[index]
    if (end === null) return null
    if (call.latencyMs === null || call.latencyMs < 0) return null
    return end - call.latencyMs
  })

  const starts = startMsList.filter((value): value is number => value !== null)
  const ends = endMsList.filter((value): value is number => value !== null)
  const origin =
    starts.length > 0
      ? Math.min(...starts)
      : ends.length > 0
        ? Math.min(...ends)
        : null
  const maxEnd = ends.length > 0 ? Math.max(...ends) : (origin ?? 0)
  const totalMs = origin === null ? 1 : Math.max(1, maxEnd - origin)

  const rows: TurnChainRow[] = calls.map((call, index) => {
    const end = endMsList[index]
    const start = startMsList[index]

    if (origin === null || end === null) {
      return {
        call,
        durationMs: null,
        startOffsetMs: null,
        endOffsetMs: null,
        leftPct: null,
        widthPct: null,
        ttftPct: null,
        parallelWith: [],
      }
    }

    const endOffset = end - origin
    if (start === null) {
      return {
        call,
        durationMs: null,
        startOffsetMs: null,
        endOffsetMs: endOffset,
        leftPct: round2((endOffset / totalMs) * 100),
        widthPct: 0,
        ttftPct: null,
        parallelWith: [],
      }
    }

    const duration = end - start
    const startOffset = start - origin
    const clampedTtft =
      call.firstTokenMs === null
        ? null
        : Math.min(Math.max(call.firstTokenMs, 0), duration)

    return {
      call,
      durationMs: duration,
      startOffsetMs: startOffset,
      endOffsetMs: endOffset,
      leftPct: round2((startOffset / totalMs) * 100),
      widthPct: round2((duration / totalMs) * 100),
      ttftPct:
        clampedTtft === null
          ? null
          : round2(((startOffset + clampedTtft) / totalMs) * 100),
      parallelWith: [],
    }
  })

  for (const row of rows) {
    const rowStart = row.startOffsetMs
    const rowEnd = row.endOffsetMs
    if (rowStart === null || rowEnd === null) continue
    row.parallelWith = rows
      .filter((other) => {
        if (
          other === row ||
          other.startOffsetMs === null ||
          other.endOffsetMs === null
        ) {
          return false
        }
        return rowStart < other.endOffsetMs && other.startOffsetMs < rowEnd
      })
      .map((other) => other.call.id)
  }

  rows.sort((a, b) => {
    const aStart = a.startOffsetMs ?? a.endOffsetMs ?? Number.POSITIVE_INFINITY
    const bStart = b.startOffsetMs ?? b.endOffsetMs ?? Number.POSITIVE_INFINITY
    if (aStart !== bStart) return aStart - bStart
    const aEnd = a.endOffsetMs ?? Number.POSITIVE_INFINITY
    const bEnd = b.endOffsetMs ?? Number.POSITIVE_INFINITY
    if (aEnd !== bEnd) return aEnd - bEnd
    return a.call.id.localeCompare(b.call.id)
  })

  return {
    originIso: origin === null ? null : new Date(origin).toISOString(),
    totalMs,
    rows,
    unknownDurationCount: startMsList.filter((value) => value === null).length,
  }
}

/**
 * filler 收尾 → 主回答首包的「防死空气」gap。
 * filler 已于 2026-11 下线，只有历史轮次算得出来。
 */
export function fillerAnswerGapMs(calls: LlmTurnCall[]): number | null {
  const filler = calls.find(
    (call) =>
      call.scene === 'filler' && call.success && call.latencyMs !== null,
  )
  const answer = calls.find(
    (call): call is LlmTurnCall & { firstTokenMs: number } =>
      call.scene === 'chat_main' && call.firstTokenMs !== null,
  )
  if (!filler || !answer) return null

  const fillerEndMs = Date.parse(filler.createdAt)
  const answerStartMs = callStartMs(answer)
  if (Number.isNaN(fillerEndMs) || answerStartMs === null) return null
  return answerStartMs + answer.firstTokenMs - fillerEndMs
}
