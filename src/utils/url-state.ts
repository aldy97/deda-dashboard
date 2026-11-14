import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import { fmt } from './date-range'
import type { DayRange } from './date-range'

/**
 * 全站「可跳转契约」的地基。
 *
 * 约定：页面的筛选条件、当前 tab、打开的抽屉都要能被 URL 表达。这样跨页下钻才能
 * 把上下文一起带过去（而不是跳到一张没筛选的空表），刷新与分享也才能还原现场。
 *
 * 写入统一走 patchParams：只改被点名的键，值为 null / undefined / 空串时删键——
 * 各页面共用一条 query（如 /messages 同时有筛选与抽屉的 messageId），
 * 谁写自己的键都不该把别人的抹掉。
 */

/** 一次写入多个查询参数；值为 null / undefined / '' 的键会被删除 */
export type QueryPatch = Record<
  string,
  string | number | boolean | null | undefined
>

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

export function patchParams(
  prev: URLSearchParams,
  patch: QueryPatch,
): URLSearchParams {
  const next = new URLSearchParams(prev)
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined || value === '') {
      next.delete(key)
    } else {
      next.set(key, String(value))
    }
  }
  return next
}

/** 读一个键：缺失与纯空白都算「未设置」，避免 ?deviceId=%20 变成一次真实过滤 */
export function readParam(
  searchParams: URLSearchParams,
  key: string,
): string | null {
  const value = searchParams.get(key)
  if (value === null) return null
  return value.trim() === '' ? null : value
}

/**
 * 读枚举型键（tab / scene / mode…）：命中白名单才用，非法值回退默认值。
 * 分享的链接里塞了旧值或手打错字时，页面照常渲染而不是白屏。
 */
export function readEnumParam<T extends string>(
  searchParams: URLSearchParams,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = searchParams.get(key)
  if (value !== null && (allowed as readonly string[]).includes(value)) {
    return value as T
  }
  return fallback
}

/** 只认 YYYY-MM-DD 且能原样格式化回去的日期，挡掉 ISO 串与 2026-13-40 这类脏值 */
function parseDay(value: string | null): dayjs.Dayjs | null {
  if (value === null || !DATE_ONLY.test(value)) return null
  const parsed = dayjs(value)
  if (!parsed.isValid() || parsed.format('YYYY-MM-DD') !== value) return null
  return parsed.startOf('day')
}

/**
 * 读区间参数（startDate / endDate，闭区间）。
 * 只给一端、格式非法、区间倒挂都返回 null＝「未设置」，由调用方落回自己的默认区间。
 */
export function readRangeParams(
  searchParams: URLSearchParams,
  startKey = 'startDate',
  endKey = 'endDate',
): DayRange | null {
  const start = parseDay(searchParams.get(startKey))
  const end = parseDay(searchParams.get(endKey))
  if (!start || !end || start.isAfter(end, 'day')) return null
  return [start, end]
}

/** 写区间参数的 patch；传 null 表示清掉区间（回到「全部时间」或页面默认） */
export function rangePatch(
  range: DayRange | null,
  startKey = 'startDate',
  endKey = 'endDate',
): QueryPatch {
  if (!range) return { [startKey]: null, [endKey]: null }
  return { [startKey]: fmt(range[0]), [endKey]: fmt(range[1]) }
}

/**
 * URL 查询状态的读写对。
 *
 * replace 由调用方选：筛选条件用 { replace: true }（连续改筛选不该堆一长串历史），
 * 抽屉/tab 用默认的 push（浏览器后退＝关掉抽屉，符合直觉）。
 */
export function useUrlQuery() {
  const [searchParams, setSearchParams] = useSearchParams()

  const setQuery = useCallback(
    (patch: QueryPatch, options?: { replace?: boolean }) => {
      setSearchParams((prev) => patchParams(prev, patch), {
        replace: options?.replace ?? false,
      })
    },
    [setSearchParams],
  )

  return { searchParams, setQuery }
}
