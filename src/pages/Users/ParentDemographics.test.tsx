import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { chartOptions } from '../../test/echartsOptions'
import ParentDemographics from './ParentDemographics'
import type { ParentDemographicsResponse } from '../../types/analytics'

const DATA: ParentDemographicsResponse = {
  totalUsers: 100,
  genderSplit: { male: 30, female: 55, unset: 15 },
  ageDistribution: [
    { range: '<18', users: 0 },
    { range: '18-24', users: 10 },
    { range: '25-34', users: 45 },
    { range: '35-44', users: 30 },
    { range: '45+', users: 5 },
    { range: 'unknown', users: 10 },
  ],
}

describe('ParentDemographics', () => {
  it('渲染家长性别与年龄段两张图，并标注统计单位', () => {
    render(<ParentDemographics data={DATA} />)

    expect(screen.getByText(/家长性别分布/)).toBeTruthy()
    expect(screen.getByText(/家长年龄段分布/)).toBeTruthy()
    expect(screen.getAllByText(/统计单位：家长账号/).length).toBe(2)

    const [genderOption, ageOption] = chartOptions as any[]
    expect(genderOption.series[0].data).toEqual([
      { name: '爸爸', value: 30 },
      { name: '妈妈', value: 55 },
      { name: '未设置', value: 15 },
    ])
    expect(ageOption.xAxis.data).toEqual([
      '<18 岁',
      '18-24 岁',
      '25-34 岁',
      '35-44 岁',
      '45 岁以上',
      '未知',
    ])
    expect(ageOption.series[0].data).toEqual([0, 10, 45, 30, 5, 10])
  })

  it('没有家长时给空态', () => {
    render(
      <ParentDemographics
        data={{
          totalUsers: 0,
          genderSplit: { male: 0, female: 0, unset: 0 },
          ageDistribution: [],
        }}
      />,
    )

    expect(screen.getByText('暂无家长画像数据')).toBeTruthy()
  })
})
