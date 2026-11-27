import { Popover } from 'antd'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import type { PresenceDay } from '../../types/analytics'

/**
 * 单设备开机日历（设备舰队抽屉与设备档案页共用）。
 *
 * 后端只返回「有 presence 行的日期」，不补无数据的日期，补齐与按周对齐都在前端做：
 * 先按周一对齐补首行前导空格，再把末行尾部补满，否则最后一周的日期会落到
 * 错误的星期列下（dayjs.day()：0=周日 … 6=周六）。
 *
 * 蓝色 = 当日有 presence 行（开机），浅灰 = 当日无数据（未开机或尚未落库）。
 */

const DAY_NAMES = ['一', '二', '三', '四', '五', '六', '日']
const CELL_WIDTH = 28
const CELL_HEIGHT = 24

type Cell = { date: Dayjs; hasData: boolean } | null

export default function PresenceCalendar({
  presence,
  days,
}: {
  presence: PresenceDay[]
  days: number
}) {
  const endDate = dayjs().startOf('day')
  const startDate = endDate.subtract(days - 1, 'day')

  const presenceDates = new Set(presence.map((p) => p.date))

  const cells: Array<{ date: Dayjs; hasData: boolean }> = []
  let cursor = startDate
  while (cursor.isBefore(endDate) || cursor.isSame(endDate, 'day')) {
    const dateKey = cursor.format('YYYY-MM-DD')
    cells.push({ date: cursor, hasData: presenceDates.has(dateKey) })
    cursor = cursor.add(1, 'day')
  }

  const leading = cells.length > 0 ? (cells[0].date.day() + 6) % 7 : 0
  const padded: Cell[] = [
    ...Array.from({ length: leading }, () => null),
    ...cells,
  ]
  while (padded.length % 7 !== 0) padded.push(null)

  const weeks: Cell[][] = []
  for (let i = 0; i < padded.length; i += 7) {
    weeks.push(padded.slice(i, i + 7))
  }

  return (
    <div
      data-testid="presence-calendar"
      style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
    >
      <div
        data-testid="calendar-weekday-header"
        style={{ display: 'flex', gap: 4 }}
      >
        {DAY_NAMES.map((name) => (
          <div
            key={name}
            style={{
              width: CELL_WIDTH,
              textAlign: 'center',
              fontSize: 11,
              color: '#999',
            }}
          >
            {name}
          </div>
        ))}
      </div>
      {weeks.map((week, weekIndex) => (
        <div
          key={weekIndex}
          data-testid="calendar-week"
          style={{ display: 'flex', gap: 4 }}
        >
          {week.map((cell, cellIndex) =>
            cell === null ? (
              <div
                key={`pad-${cellIndex}`}
                data-cell
                data-pad="true"
                style={{ width: CELL_WIDTH, height: CELL_HEIGHT }}
              />
            ) : (
              <Popover
                key={cell.date.format('YYYY-MM-DD')}
                content={
                  <div style={{ fontSize: 12 }}>
                    <div>{cell.date.format('YYYY-MM-DD')}</div>
                    <div>{cell.hasData ? '已开机' : '无数据'}</div>
                  </div>
                }
              >
                <div
                  data-cell
                  data-date={cell.date.format('YYYY-MM-DD')}
                  data-active={cell.hasData ? '1' : '0'}
                  style={{
                    width: CELL_WIDTH,
                    height: CELL_HEIGHT,
                    borderRadius: 3,
                    backgroundColor: cell.hasData ? '#1677ff' : '#f5f5f5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    color: cell.hasData ? '#fff' : '#bbb',
                    cursor: 'pointer',
                  }}
                >
                  {cell.date.date()}
                </div>
              </Popover>
            ),
          )}
        </div>
      ))}
    </div>
  )
}
