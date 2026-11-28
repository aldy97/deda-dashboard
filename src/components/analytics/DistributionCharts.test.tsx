import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { chartOptions } from '../../test/echartsOptions'
import {
  DistributionBar,
  DistributionPie,
} from './DistributionCharts'

describe('DistributionCharts', () => {
  it('饼图按传入单位渲染 tooltip 与数据', () => {
    render(
      <DistributionPie
        caption="家长性别分布"
        seriesName="性别"
        unit="人"
        items={[
          { name: '爸爸', value: 3 },
          { name: '妈妈', value: 7 },
        ]}
      />,
    )

    expect(screen.getByText('家长性别分布')).toBeTruthy()
    const option = chartOptions[0] as any
    expect(option.tooltip.formatter).toBe('{b}: {c} 人（{d}%）')
    expect(option.series[0].data).toEqual([
      { name: '爸爸', value: 3 },
      { name: '妈妈', value: 7 },
    ])
  })

  it('柱图使用对应单位作为 y 轴名称', () => {
    render(
      <DistributionBar
        caption="家长年龄段分布"
        categories={['18-24', '25-34']}
        values={[2, 8]}
        unit="人"
      />,
    )

    expect(screen.getByText('家长年龄段分布')).toBeTruthy()
    const option = chartOptions[0] as any
    expect(option.yAxis.name).toBe('人数')
    expect(option.xAxis.data).toEqual(['18-24', '25-34'])
    expect(option.series[0].data).toEqual([2, 8])
  })

  it('设备口径用「台」作单位', () => {
    render(
      <DistributionBar
        caption="孩子年龄段分布"
        categories={['0-3']}
        values={[1]}
        unit="台"
      />,
    )

    const option = chartOptions[0] as any
    expect(option.yAxis.name).toBe('台数')
  })
})
