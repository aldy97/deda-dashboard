import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { chartOptions } from '../../test/echartsOptions'
import Demographics from './Demographics'
import type { UsersDemographicsResponse } from '../../types/analytics'

const DATA: UsersDemographicsResponse = {
  ageDistribution: [
    { range: '0-3', devices: 2 },
    { range: '3-6', devices: 1 },
    { range: '6-9', devices: 0 },
    { range: '9+', devices: 0 },
    { range: 'unknown', devices: 0 },
  ],
  genderSplit: { male: 2, female: 1, unset: 0 },
  characterKeySplit: [
    { characterKey: 'elly', devices: 2 },
    { characterKey: 'polly', devices: 1 },
  ],
  bindingsPerDevice: [
    { count: 1, devices: 2 },
    { count: '3+', devices: 1 },
  ],
}

describe('Demographics', () => {
  it('按设备口径渲染四张图，标题明确是孩子/设备', () => {
    render(<Demographics data={DATA} />)

    expect(screen.getByText(/孩子年龄段分布/)).toBeTruthy()
    expect(screen.getByText(/孩子性别分布/)).toBeTruthy()
    expect(screen.getByText(/IP 型号分布/)).toBeTruthy()
    expect(screen.getByText(/每台设备绑定家庭数/)).toBeTruthy()
    expect(chartOptions).toHaveLength(4)

    const characterOption = chartOptions[2] as any
    expect(characterOption.series[0].data).toEqual([
      { name: 'elly', value: 2 },
      { name: 'polly', value: 1 },
    ])
    const bindingOption = chartOptions[3] as any
    expect(bindingOption.xAxis.data).toEqual(['1 个家庭', '3+ 个家庭'])
  })

  it('年龄全零但仍有 IP 型号时不判空', () => {
    render(
      <Demographics
        data={{
          ageDistribution: [
            { range: '0-3', devices: 0 },
            { range: '3-6', devices: 0 },
            { range: '6-9', devices: 0 },
            { range: '9+', devices: 0 },
            { range: 'unknown', devices: 0 },
          ],
          genderSplit: { male: 0, female: 0, unset: 0 },
          characterKeySplit: [{ characterKey: 'elly', devices: 1 }],
          bindingsPerDevice: [],
        }}
      />,
    )

    expect(screen.getByText(/IP 型号分布/)).toBeTruthy()
  })

  it('全零时给空态', () => {
    render(
      <Demographics
        data={{
          ageDistribution: [
            { range: '0-3', devices: 0 },
            { range: '3-6', devices: 0 },
            { range: '6-9', devices: 0 },
            { range: '9+', devices: 0 },
            { range: 'unknown', devices: 0 },
          ],
          genderSplit: { male: 0, female: 0, unset: 0 },
          characterKeySplit: [],
          bindingsPerDevice: [],
        }}
      />,
    )

    expect(screen.getByText('暂无设备画像数据')).toBeTruthy()
  })
})
