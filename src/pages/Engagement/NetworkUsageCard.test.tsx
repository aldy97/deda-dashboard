import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import NetworkUsageCard from './NetworkUsageCard'
import { chartOptions } from '../../test/echartsOptions'
import type { NetworkUsageResponse } from '../../types/analytics'

function usage(
  overrides: Partial<NetworkUsageResponse> = {},
): NetworkUsageResponse {
  return {
    startDate: '2026-11-26',
    endDate: '2026-11-27',
    totalTurns: 5,
    knownTurns: 3,
    unknownTurns: 2,
    coverage: 0.6,
    deviceCount: 2,
    firstTrackedDate: '2026-11-26',
    wifi: {
      turns: 2,
      devices: 1,
      shareOfKnown: 0.6667,
      shareOfTotal: 0.4,
    },
    fourG: {
      turns: 1,
      devices: 1,
      shareOfKnown: 0.3333,
      shareOfTotal: 0.2,
    },
    unknown: { turns: 2, devices: 2, shareOfTotal: 0.4 },
    series: [
      {
        date: '2026-11-26',
        wifiTurns: 1,
        fourGTurns: 0,
        unknownTurns: 0,
        wifiShareOfKnown: 1,
        fourGShareOfKnown: 0,
      },
      {
        date: '2026-11-27',
        wifiTurns: 1,
        fourGTurns: 1,
        unknownTurns: 2,
        wifiShareOfKnown: 0.5,
        fourGShareOfKnown: 0.5,
      },
    ],
    ...overrides,
  }
}

type PieOption = {
  series: Array<{ data: Array<{ name: string; value: number }> }>
}
type BarOption = {
  xAxis: { data: string[] }
  series: Array<{ name: string; data: number[] }>
}

describe('NetworkUsageCard', () => {
  it('展示已知占比、覆盖率与设备数', () => {
    render(<NetworkUsageCard data={usage()} />)

    expect(screen.getByText('66.7%')).toBeInTheDocument()
    expect(screen.getByText('33.3%')).toBeInTheDocument()
    expect(screen.getByText('60.0%')).toBeInTheDocument()
    expect(screen.getByText(/已归因 3 \/ 5 轮/)).toBeInTheDocument()
    expect(screen.getByText(/未知 2 轮/)).toBeInTheDocument()
    expect(screen.getByText(/涉及 2 台设备/)).toBeInTheDocument()
  })

  it('环形图只画 WiFi 与 4G（已知轮次）', () => {
    render(<NetworkUsageCard data={usage()} />)

    const option = chartOptions[0] as PieOption
    expect(option.series[0].data).toEqual([
      { name: 'WiFi', value: 2 },
      { name: '4G', value: 1 },
    ])
  })

  it('按日 100% 堆叠柱把 WiFi/4G/未知换算成占比', () => {
    render(<NetworkUsageCard data={usage()} />)

    const option = chartOptions[1] as BarOption
    expect(option.xAxis.data).toEqual(['11-26', '11-27'])
    expect(option.series.map((s) => s.name)).toEqual(['WiFi', '4G', '未知'])
    expect(option.series[0].data).toEqual([100, 25])
    expect(option.series[1].data).toEqual([0, 25])
    expect(option.series[2].data).toEqual([0, 50])
  })

  it('空区间显示 Empty，不渲染 0%', () => {
    render(<NetworkUsageCard data={usage({ totalTurns: 0 })} />)

    expect(screen.getByText('所选区间暂无对话数据')).toBeInTheDocument()
    expect(screen.queryByText('0.0%')).not.toBeInTheDocument()
  })

  it('全部未知时提示老固件/上线前，不显示 0%/0%', () => {
    render(
      <NetworkUsageCard
        data={usage({
          knownTurns: 0,
          wifi: {
            turns: 0,
            devices: 0,
            shareOfKnown: null,
            shareOfTotal: null,
          },
          fourG: {
            turns: 0,
            devices: 0,
            shareOfKnown: null,
            shareOfTotal: null,
          },
          unknown: { turns: 5, devices: 2, shareOfTotal: 1 },
          coverage: 0,
          series: [],
        })}
      />,
    )

    expect(
      screen.getByText('暂无网络归属数据（老固件/上线前）'),
    ).toBeInTheDocument()
    expect(screen.queryByText('0.0%')).not.toBeInTheDocument()
  })
})
