import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import PresenceCalendar from './PresenceCalendar'
import type { PresenceDay } from '../../types/analytics'

/**
 * 开机日历的排布契约。
 *
 * 后端只返回「有 presence 行的日期」，不补齐空缺，所以补齐与按周对齐全在前端：
 * 1. 格子总数恒等于 days，一天不多一天不少（多补一天会让人误读回看窗口）；
 * 2. 按周一对齐——首行前导补空、末行尾部补空，否则最后一周的日期会落到错误的星期列下；
 * 3. 有 presence 行的日期标为已开机，其余为无数据。
 *
 * 用假定时器把「今天」钉在 2026-11-14（周六）：该时刻在 UTC 与 Asia/Shanghai
 * 都是 11-14，本地与 CI（UTC）跑出来的窗口一致，不会一边绿一边红。
 */
const TODAY_NOON_UTC = new Date('2026-11-14T04:00:00.000Z')

function presenceDay(date: string): PresenceDay {
  return {
    date,
    reportCount: 3,
    firstSeenAt: `${date}T01:00:00.000Z`,
    lastSeenAt: `${date}T09:00:00.000Z`,
  }
}

/** 一行 = 7 个格子（补空格 + 日期格），按 DOM 顺序取出 */
function rows(): HTMLElement[][] {
  const grid = screen.getByTestId('presence-calendar')
  return within(grid)
    .getAllByTestId('calendar-week')
    .map((week) => Array.from(week.querySelectorAll<HTMLElement>('[data-cell]')))
}

function dayCells(): HTMLElement[] {
  return rows()
    .flat()
    .filter((cell) => cell.dataset.date !== undefined)
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(TODAY_NOON_UTC)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('PresenceCalendar 补齐与对齐', () => {
  it('days=7 且今日为周六：窗口是 11-08（周日）到 11-14，共 7 个日期格', () => {
    render(<PresenceCalendar presence={[]} days={7} />)

    const cells = dayCells()
    expect(cells).toHaveLength(7)
    expect(cells[0].dataset.date).toBe('2026-11-08')
    expect(cells[6].dataset.date).toBe('2026-11-14')
  })

  it('每行恒为 7 格，首行按周一对齐补 6 个前导空格（窗口首日落在周日列）', () => {
    render(<PresenceCalendar presence={[]} days={7} />)

    const weeks = rows()
    expect(weeks).toHaveLength(2)
    for (const week of weeks) {
      expect(week).toHaveLength(7)
    }
    // 首行：6 个补空格 + 11-08
    expect(weeks[0].slice(0, 6).every((c) => c.dataset.pad !== undefined)).toBe(
      true,
    )
    expect(weeks[0][6].dataset.date).toBe('2026-11-08')
    // 次行：11-09 … 11-14 + 1 个尾部补空格
    expect(weeks[1][0].dataset.date).toBe('2026-11-09')
    expect(weeks[1][5].dataset.date).toBe('2026-11-14')
    expect(weeks[1][6].dataset.pad).toBe('true')
  })

  it('日期格按时间升序排列', () => {
    render(<PresenceCalendar presence={[]} days={30} />)

    const dates = dayCells().map((cell) => cell.dataset.date) as string[]
    expect(dates).toHaveLength(30)
    expect([...dates].sort()).toEqual(dates)
    expect(dates[dates.length - 1]).toBe('2026-11-14')
  })

  it('星期表头是周一到周日', () => {
    render(<PresenceCalendar presence={[]} days={7} />)

    const header = screen.getByTestId('calendar-weekday-header')
    expect(header.textContent).toBe('一二三四五六日')
  })
})

describe('PresenceCalendar 开机标记', () => {
  it('有 presence 行的日期标为已开机，其余为无数据', () => {
    render(
      <PresenceCalendar
        presence={[presenceDay('2026-11-10'), presenceDay('2026-11-14')]}
        days={7}
      />,
    )

    const byDate = new Map(
      dayCells().map((cell) => [cell.dataset.date, cell.dataset.active]),
    )
    expect(byDate.get('2026-11-10')).toBe('1')
    expect(byDate.get('2026-11-14')).toBe('1')
    expect(byDate.get('2026-11-09')).toBe('0')
    expect(byDate.get('2026-11-13')).toBe('0')
  })

  it('窗口外的 presence 行不计入（后端可能返回更早的历史）', () => {
    render(
      <PresenceCalendar
        presence={[presenceDay('2026-10-01'), presenceDay('2026-11-12')]}
        days={7}
      />,
    )

    const active = dayCells().filter((cell) => cell.dataset.active === '1')
    expect(active).toHaveLength(1)
    expect(active[0].dataset.date).toBe('2026-11-12')
  })

  it('同一天多条 presence 行只算一个已开机日', () => {
    render(
      <PresenceCalendar
        presence={[presenceDay('2026-11-11'), presenceDay('2026-11-11')]}
        days={7}
      />,
    )

    const active = dayCells().filter((cell) => cell.dataset.active === '1')
    expect(active).toHaveLength(1)
  })

  it('days=1 只渲染今日一格', () => {
    render(<PresenceCalendar presence={[presenceDay('2026-11-14')]} days={1} />)

    const cells = dayCells()
    expect(cells).toHaveLength(1)
    expect(cells[0].dataset.date).toBe('2026-11-14')
    expect(cells[0].dataset.active).toBe('1')
  })
})
