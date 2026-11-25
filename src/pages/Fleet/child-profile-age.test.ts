import { describe, expect, it } from 'vitest'
import { calcAge } from './child-profile-age'

// 固定 now：2026-11-25T12:00:00Z = Asia/Shanghai 当日 20:00（生日判断按上海日历日）
const NOW = new Date('2026-11-25T12:00:00.000Z')

describe('calcAge', () => {
  it('当年生日已过：返回周岁', () => {
    expect(calcAge('2018-05-20', NOW)).toBe(8)
  })

  it('当年生日未到：减一岁', () => {
    expect(calcAge('2018-12-01', NOW)).toBe(7)
  })

  it('当天正好是生日（按 Asia/Shanghai 已过生日）：不减岁', () => {
    expect(calcAge('2018-11-25', NOW)).toBe(8)
  })

  it('上海时区次日零点 UTC 仍算前一天：UTC 与本地口径一致', () => {
    // 2026-11-25T16:00:00Z = 上海 11-26 00:00，按上海日历已过生日
    expect(calcAge('2018-11-25', new Date('2026-11-25T16:00:00.000Z'))).toBe(
      8,
    )
    // 2026-11-24T16:00:00Z = 上海 11-25 00:00，当天也算已过生日
    expect(calcAge('2018-11-25', new Date('2026-11-24T16:00:00.000Z'))).toBe(
      8,
    )
  })

  it('非法格式返回 null', () => {
    expect(calcAge('abc', NOW)).toBeNull()
    expect(calcAge('2018/05/20', NOW)).toBeNull()
    expect(calcAge('2018-13-01', NOW)).toBeNull()
    expect(calcAge('2018-02-30', NOW)).toBeNull()
  })

  it('未来生日返回 null', () => {
    expect(calcAge('2030-01-01', NOW)).toBeNull()
  })
})
