import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import ModeUsageChart from './ModeUsageChart'
import { chartOptions } from '../../test/echartsOptions'
import type { ModeUsageResponse } from '../../types/analytics'

/**
 * 模式分布堆叠柱的分组契约。
 *
 * mode 平级化之后服务端不再返回 conversationModeKey，同一 mode 在一天内只会出现一条，
 * 分类标签只认 mode 一个维度。这里考核三件事：
 * 1. series 按 mode 的中文名分组，free_story 现在是真实统计桶（被门禁拦截的冒险/自由故事请求如实落库）；
 * 2. 服务端新增未知 mode 时降级显示原始 key，不渲染 undefined；
 * 3. 空区间走 Empty 而不是画一张空图。
 */
function usage(overrides: Partial<ModeUsageResponse> = {}): ModeUsageResponse {
  return {
    series: [
      {
        date: '2026-11-10',
        modes: [
          { mode: 'free_chat', turns: 30, devices: 4 },
          { mode: 'free_story', turns: 12, devices: 2 },
        ],
      },
      {
        date: '2026-11-11',
        modes: [
          { mode: 'free_chat', turns: 20, devices: 3 },
          { mode: 'sleep_story', turns: 8, devices: 2 },
        ],
      },
    ],
    ...overrides,
  }
}

function option() {
  return chartOptions[0] as {
    xAxis: { data: string[] }
    series: Array<{ name: string; stack: string; data: number[] }>
  }
}

describe('ModeUsageChart 分组', () => {
  it('series 按 mode 中文名分组，保持首次出现顺序', () => {
    render(<ModeUsageChart data={usage()} />)

    expect(option().series.map((s) => s.name)).toEqual([
      '自由对话',
      '自由故事',
      '哄睡故事',
    ])
  })

  it('free_story 作为真实统计桶独立成列，不再被并入自由对话', () => {
    render(<ModeUsageChart data={usage()} />)

    const freeStory = option().series.find((s) => s.name === '自由故事')
    expect(freeStory?.data).toEqual([12, 0])
  })

  it('某天没有该 mode 时补 0，保证堆叠柱各系列等长', () => {
    render(<ModeUsageChart data={usage()} />)

    expect(option().series.find((s) => s.name === '自由对话')?.data).toEqual([
      30, 20,
    ])
    expect(option().series.find((s) => s.name === '哄睡故事')?.data).toEqual([
      0, 8,
    ])
  })

  it('legacy mode 值仍翻译成中文名，历史区间不断档', () => {
    render(
      <ModeUsageChart
        data={usage({
          series: [
            {
              date: '2026-09-01',
              modes: [{ mode: 'free_chat_casual', turns: 5, devices: 1 }],
            },
          ],
        })}
      />,
    )

    expect(option().series.map((s) => s.name)).toEqual(['自由闲聊'])
  })

  it('服务端新增未知 mode 时降级显示原始 key', () => {
    render(
      <ModeUsageChart
        data={usage({
          series: [
            { date: '2026-11-10', modes: [{ mode: 'brand_new', turns: 3, devices: 1 }] },
          ],
        })}
      />,
    )

    expect(option().series.map((s) => s.name)).toEqual(['brand_new'])
  })

  it('x 轴只显示月-日，系列同属一个堆叠', () => {
    render(<ModeUsageChart data={usage()} />)

    expect(option().xAxis.data).toEqual(['11-10', '11-11'])
    expect(new Set(option().series.map((s) => s.stack))).toEqual(
      new Set(['turns']),
    )
  })
})

describe('ModeUsageChart 空态', () => {
  it('区间内无数据时显示空态而不是空图', () => {
    render(<ModeUsageChart data={{ series: [] }} />)

    expect(screen.getByText('所选区间暂无对话数据')).toBeTruthy()
    expect(chartOptions).toHaveLength(0)
  })
})
