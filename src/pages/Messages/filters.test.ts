import { describe, expect, it } from 'vitest'
import dayjs from 'dayjs'
import { EMPTY_FILTERS, filtersFromUrl, filtersToPatch } from './filters'
import { patchParams } from '../../utils/url-state'

/**
 * 消息明细的筛选条件 ↔ URL 映射。
 *
 * 这一层是全站下钻的落点契约：记忆版本时间线、用户详情、安全复核队列、慢调用
 * 都往 /messages 带条件跳，参数名与「空值即删键」的行为必须钉死，
 * 否则跳转方各自拼字符串，改一处就会静默失效。
 */
describe('filtersFromUrl · 读', () => {
  it('全量条件读进 Filters', () => {
    const filters = filtersFromUrl(
      new URLSearchParams(
        'deviceId=dev-9&role=user&status=failed&keyword=故事&mode=free_chat&startDate=2026-11-01&endDate=2026-11-07',
      ),
    )
    expect(filters.deviceId).toBe('dev-9')
    expect(filters.role).toBe('user')
    expect(filters.status).toBe('failed')
    expect(filters.keyword).toBe('故事')
    expect(filters.mode).toBe('free_chat')
    expect(filters.range?.[0].format('YYYY-MM-DD')).toBe('2026-11-01')
    expect(filters.range?.[1].format('YYYY-MM-DD')).toBe('2026-11-07')
  })

  it('空 URL 得到空条件（range 为 null 表示「全部时间」）', () => {
    expect(filtersFromUrl(new URLSearchParams())).toEqual(EMPTY_FILTERS)
  })

  it('非法 role / status 被丢弃，不拿脏值去查后端', () => {
    const filters = filtersFromUrl(
      new URLSearchParams('role=admin&status=bogus'),
    )
    expect(filters.role).toBeUndefined()
    expect(filters.status).toBeUndefined()
  })

  it('legacy mode 原样保留（前端不做 mode 白名单）', () => {
    expect(
      filtersFromUrl(new URLSearchParams('mode=free_chat_casual')).mode,
    ).toBe('free_chat_casual')
  })

  it('纯空白的 deviceId / keyword 视为未填写', () => {
    const filters = filtersFromUrl(
      new URLSearchParams('deviceId=%20%20&keyword=%20'),
    )
    expect(filters.deviceId).toBe('')
    expect(filters.keyword).toBe('')
  })
})

describe('filtersToPatch · 写', () => {
  it('空条件把所有筛选键删干净，不留 ?role= 这种假筛选', () => {
    const prev = new URLSearchParams(
      'deviceId=dev-9&role=user&status=failed&keyword=x&mode=free_chat&startDate=2026-11-01&endDate=2026-11-07&turnId=t-1',
    )
    expect(patchParams(prev, filtersToPatch(EMPTY_FILTERS)).toString()).toBe(
      'turnId=t-1',
    )
  })

  it('两端首尾空白被裁掉后才写进 URL', () => {
    const patch = filtersToPatch({
      ...EMPTY_FILTERS,
      deviceId: '  dev-7  ',
      keyword: '  山  ',
    })
    const next = patchParams(new URLSearchParams(), patch)
    expect(next.get('deviceId')).toBe('dev-7')
    expect(next.get('keyword')).toBe('山')
  })

  it('区间写成 YYYY-MM-DD 闭区间', () => {
    const patch = filtersToPatch({
      ...EMPTY_FILTERS,
      range: [
        dayjs('2026-11-01').startOf('day'),
        dayjs('2026-11-07').startOf('day'),
      ],
    })
    expect(patchParams(new URLSearchParams(), patch).toString()).toBe(
      'startDate=2026-11-01&endDate=2026-11-07',
    )
  })

  it('读写往返一致：写进去的条件读回来一模一样', () => {
    const original = {
      ...EMPTY_FILTERS,
      deviceId: 'dev-9',
      role: 'assistant' as const,
      status: 'interrupted' as const,
      keyword: '故事',
      mode: 'adventure_story',
      range: [
        dayjs('2026-11-01').startOf('day'),
        dayjs('2026-11-07').startOf('day'),
      ] as [dayjs.Dayjs, dayjs.Dayjs],
    }
    const url = patchParams(new URLSearchParams(), filtersToPatch(original))
    const roundTripped = filtersFromUrl(url)
    expect(roundTripped.deviceId).toBe(original.deviceId)
    expect(roundTripped.role).toBe(original.role)
    expect(roundTripped.status).toBe(original.status)
    expect(roundTripped.keyword).toBe(original.keyword)
    expect(roundTripped.mode).toBe(original.mode)
    expect(roundTripped.range?.[0].format('YYYY-MM-DD')).toBe('2026-11-01')
    expect(roundTripped.range?.[1].format('YYYY-MM-DD')).toBe('2026-11-07')
  })
})
