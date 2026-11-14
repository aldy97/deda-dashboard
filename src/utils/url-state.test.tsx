import { describe, expect, it } from 'vitest'
import { renderHook, act, screen, render } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  patchParams,
  rangePatch,
  readEnumParam,
  readParam,
  readRangeParams,
  useUrlQuery,
} from './url-state'

/**
 * 全站「可跳转契约」的地基：页面的筛选条件、当前 tab、打开的抽屉都必须能被 URL
 * 表达，否则跨页下钻跳过去就是一张没带条件的空表，刷新与分享也会丢状态。
 *
 * 考核四件事：
 * 1. patchParams 只改被点名的键，且 null / undefined / '' 一律删键（不写 ?mode=）；
 * 2. 读取侧对脏 URL 免疫：非法枚举回退默认值，非法/倒挂日期区间视为「未设置」；
 * 3. 日期区间以 YYYY-MM-DD 闭区间进出 URL，与 fmt() 同源；
 * 4. useUrlQuery 写回时保留其它键（多个面板共用一条 query 时不互相抹掉）。
 */

function Probe() {
  const location = useLocation()
  return <div data-testid="search">{location.search}</div>
}

function renderQueryHook(initialEntry: string) {
  return renderHook(() => useUrlQuery(), {
    wrapper: ({ children }) => (
      <MemoryRouter initialEntries={[initialEntry]}>
        {children}
        <Probe />
      </MemoryRouter>
    ),
  })
}

describe('patchParams · 增量写键', () => {
  it('只改被点名的键，其余原样保留', () => {
    const next = patchParams(new URLSearchParams('tab=report&page=3'), {
      deviceId: 'dev-1',
    })
    expect(next.toString()).toBe('tab=report&page=3&deviceId=dev-1')
  })

  it('null / undefined / 空串都删键，不留 ?mode= 这种脏参数', () => {
    const prev = new URLSearchParams('mode=free_chat&turnId=t-1&deviceId=d')
    const next = patchParams(prev, { mode: null, turnId: undefined, deviceId: '' })
    expect(next.toString()).toBe('')
  })

  it('数字与布尔转成字符串写入', () => {
    const next = patchParams(new URLSearchParams(), { days: 30, online: true })
    expect(next.get('days')).toBe('30')
    expect(next.get('online')).toBe('true')
  })

  it('不修改传入的原对象', () => {
    const prev = new URLSearchParams('a=1')
    patchParams(prev, { a: '2' })
    expect(prev.get('a')).toBe('1')
  })
})

describe('readParam / readEnumParam · 脏 URL 免疫', () => {
  it('缺失与纯空白都读成 null', () => {
    const params = new URLSearchParams('blank=%20%20')
    expect(readParam(params, 'missing')).toBeNull()
    expect(readParam(params, 'blank')).toBeNull()
  })

  it('合法值原样读出', () => {
    expect(readParam(new URLSearchParams('deviceId=dev-1'), 'deviceId')).toBe(
      'dev-1',
    )
  })

  it('枚举命中才用，非法值回退默认值', () => {
    const allowed = ['perf', 'cost', 'safety'] as const
    expect(
      readEnumParam(new URLSearchParams('tab=safety'), 'tab', allowed, 'perf'),
    ).toBe('safety')
    expect(
      readEnumParam(new URLSearchParams('tab=bogus'), 'tab', allowed, 'perf'),
    ).toBe('perf')
    expect(readEnumParam(new URLSearchParams(), 'tab', allowed, 'perf')).toBe(
      'perf',
    )
  })
})

describe('readRangeParams / rangePatch · 日期区间进出 URL', () => {
  it('YYYY-MM-DD 闭区间读成 DayRange', () => {
    const range = readRangeParams(
      new URLSearchParams('startDate=2026-11-01&endDate=2026-11-07'),
    )
    expect(range).not.toBeNull()
    expect(range?.[0].format('YYYY-MM-DD')).toBe('2026-11-01')
    expect(range?.[1].format('YYYY-MM-DD')).toBe('2026-11-07')
  })

  it('只给一端、格式非法、日期非法、区间倒挂都视为未设置', () => {
    expect(readRangeParams(new URLSearchParams('startDate=2026-11-01'))).toBeNull()
    expect(
      readRangeParams(new URLSearchParams('startDate=2026/11/01&endDate=2026-11-07')),
    ).toBeNull()
    expect(
      readRangeParams(new URLSearchParams('startDate=2026-13-40&endDate=2026-11-07')),
    ).toBeNull()
    expect(
      readRangeParams(new URLSearchParams('startDate=2026-11-07&endDate=2026-11-01')),
    ).toBeNull()
  })

  it('带时间的 ISO 串不当作日期区间（避免与后端 ISO 口径混淆）', () => {
    expect(
      readRangeParams(
        new URLSearchParams(
          'startDate=2026-11-01T00:00:00.000Z&endDate=2026-11-07T00:00:00.000Z',
        ),
      ),
    ).toBeNull()
  })

  it('rangePatch 写区间、传 null 清区间', () => {
    const range = [
      dayjs('2026-11-01').startOf('day'),
      dayjs('2026-11-07').startOf('day'),
    ] as [dayjs.Dayjs, dayjs.Dayjs]
    expect(patchParams(new URLSearchParams(), rangePatch(range)).toString()).toBe(
      'startDate=2026-11-01&endDate=2026-11-07',
    )
    expect(
      patchParams(
        new URLSearchParams('startDate=2026-11-01&endDate=2026-11-07&mode=x'),
        rangePatch(null),
      ).toString(),
    ).toBe('mode=x')
  })
})

describe('useUrlQuery · 写回保留其它键', () => {
  it('setQuery 只覆盖点名的键，其余键与顺序不变', () => {
    const { result } = renderQueryHook('/messages?deviceId=dev-1&tab=x')
    act(() => {
      result.current.setQuery({ mode: 'free_chat' })
    })
    expect(result.current.searchParams.get('deviceId')).toBe('dev-1')
    expect(result.current.searchParams.get('mode')).toBe('free_chat')
    expect(screen.getByTestId('search').textContent).toBe(
      '?deviceId=dev-1&tab=x&mode=free_chat',
    )
  })

  it('传 null 删键', () => {
    const { result } = renderQueryHook('/messages?deviceId=dev-1&mode=free_chat')
    act(() => {
      result.current.setQuery({ mode: null })
    })
    expect(screen.getByTestId('search').textContent).toBe('?deviceId=dev-1')
  })

  it('replace 模式不新增历史记录（筛选条件用 replace，抽屉用 push）', () => {
    const { result } = renderQueryHook('/messages')
    act(() => {
      result.current.setQuery({ page: 2 }, { replace: true })
    })
    expect(result.current.searchParams.get('page')).toBe('2')
  })

  it('无查询串时也能写入', () => {
    const { result } = renderQueryHook('/fleet')
    act(() => {
      result.current.setQuery({ deviceId: 'dev-9' })
    })
    expect(screen.getByTestId('search').textContent).toBe('?deviceId=dev-9')
  })

  it('初始无参数时 searchParams 为空对象而非 null', () => {
    const { result } = renderQueryHook('/fleet')
    expect(result.current.searchParams.toString()).toBe('')
  })
})

describe('useUrlQuery · 渲染期读取', () => {
  it('同一组件内读到的是当前 URL 的值', () => {
    function Reader() {
      const { searchParams } = useUrlQuery()
      return <span data-testid="device">{readParam(searchParams, 'deviceId')}</span>
    }
    render(
      <MemoryRouter initialEntries={['/fleet?deviceId=dev-3']}>
        <Reader />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('device').textContent).toBe('dev-3')
  })
})
