import { describe, expect, it } from 'vitest'
import { messagesModeLink, uniqueModes } from './mode-links'
import type { ModeUsageResponse } from '../../types/analytics'

const DATA: ModeUsageResponse = {
  series: [
    {
      date: '2026-11-01',
      modes: [
        { mode: 'free_chat', turns: 10, devices: 3 },
        { mode: 'adventure_story', turns: 4, devices: 2 },
      ],
    },
    {
      date: '2026-11-02',
      modes: [
        // free_chat 重复出现，链接只该有一条
        { mode: 'free_chat', turns: 7, devices: 2 },
        { mode: 'sleep_story', turns: 1, devices: 1 },
      ],
    },
  ],
}

describe('uniqueModes · 去重保序', () => {
  it('同一 mode 跨天重复只保留一条，顺序按首次出现', () => {
    expect(uniqueModes(DATA)).toEqual([
      'free_chat',
      'adventure_story',
      'sleep_story',
    ])
  })

  it('data 为 null 时返回空数组（图表没数据就不渲染链接）', () => {
    expect(uniqueModes(null)).toEqual([])
  })

  it('series 为空时返回空数组', () => {
    expect(uniqueModes({ series: [] })).toEqual([])
  })

  it('某天 modes 为空数组时跳过，不报错', () => {
    expect(uniqueModes({ series: [{ date: '2026-11-01', modes: [] }] })).toEqual([])
  })
})

describe('messagesModeLink · 下钻链接', () => {
  it('带上 mode 与闭区间，跳到消息明细不会丢上下文', () => {
    expect(messagesModeLink('english_chat', '2026-11-01', '2026-11-14')).toBe(
      '/messages?mode=english_chat&startDate=2026-11-01&endDate=2026-11-14',
    )
  })

  it('mode 里的特殊字符会被转义，不破坏 query', () => {
    expect(messagesModeLink('a&b=c', '2026-11-01', '2026-11-14')).toBe(
      '/messages?mode=a%26b%3Dc&startDate=2026-11-01&endDate=2026-11-14',
    )
  })
})
