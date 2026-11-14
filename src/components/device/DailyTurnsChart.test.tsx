import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import DailyTurnsChart from './DailyTurnsChart'
import { chartOptions, tooltipOf } from '../../test/echartsOptions'
import type { DailyTurn } from '../../types/analytics'

/**
 * 单设备对话趋势折线。
 *
 * 考核三件事：
 * 1. 无数据走 Empty，不画一张全 0 的假趋势（会读成「设备一直在用但没说话」）；
 * 2. 横轴只取 MM-DD（区间可达 90 天，带年份会挤成一团），纵轴从 0 起且最小刻度 1
 *    ——对话轮次是整数，0.5 轮的刻度线是假的；
 * 3. tooltip 用回原始数据点，展示完整日期与轮次。
 */
const TURNS: DailyTurn[] = [
  { date: '2026-11-12', turns: 0 },
  { date: '2026-11-13', turns: 8 },
  { date: '2026-11-14', turns: 3 },
]

function option() {
  return chartOptions[0] as {
    xAxis: { data: string[] }
    yAxis: { min: number; minInterval: number }
    series: Array<{ type: string; data: number[] }>
  }
}

describe('DailyTurnsChart', () => {
  it('无数据时渲染空态而不是空图', () => {
    render(<DailyTurnsChart dailyTurns={[]} />)

    expect(screen.getByText('暂无对话数据')).toBeInTheDocument()
    expect(chartOptions).toHaveLength(0)
  })

  it('横轴取 MM-DD、纵轴从 0 起且最小刻度为 1', () => {
    render(<DailyTurnsChart dailyTurns={TURNS} />)

    const chart = option()
    expect(chart.xAxis.data).toEqual(['11-12', '11-13', '11-14'])
    expect(chart.yAxis.min).toBe(0)
    expect(chart.yAxis.minInterval).toBe(1)
  })

  it('折线数据与后端补 0 后的轮次逐项对齐', () => {
    render(<DailyTurnsChart dailyTurns={TURNS} />)

    const chart = option()
    expect(chart.series).toHaveLength(1)
    expect(chart.series[0].type).toBe('line')
    expect(chart.series[0].data).toEqual([0, 8, 3])
  })

  it('tooltip 展示完整日期与轮次', () => {
    render(<DailyTurnsChart dailyTurns={TURNS} />)

    const formatter = tooltipOf(chartOptions[0])
    const text = formatter([
      { name: '11-13', seriesName: '对话轮次', value: 8, dataIndex: 1 },
    ])
    expect(text).toContain('2026-11-13')
    expect(text).toContain('8 轮')
  })

  it('dataIndex 越界时不抛（echarts 在数据变更瞬间可能带旧索引）', () => {
    render(<DailyTurnsChart dailyTurns={TURNS} />)

    const formatter = tooltipOf(chartOptions[0])
    expect(() =>
      formatter([{ name: '', seriesName: '', value: null, dataIndex: 99 }]),
    ).not.toThrow()
  })
})
