import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import PhoneBrandChart from './PhoneBrandChart'
import type { PhoneBrandsResponse } from '../../types/analytics'

function brands(
  overrides: Partial<PhoneBrandsResponse> = {},
): PhoneBrandsResponse {
  return {
    totalUsers: 10,
    reportedUsers: 8,
    unknownUsers: 2,
    coverage: 0.8,
    firstReportedAt: '2026-11-27T01:00:00.000Z',
    brands: [
      {
        makerKey: 'apple',
        makerLabel: 'Apple',
        users: 4,
        shareOfReported: 0.5,
        shareOfTotal: 0.4,
        rawBrands: [{ brand: 'Apple', users: 4 }],
      },
      {
        makerKey: 'xiaomi',
        makerLabel: '小米',
        users: 3,
        shareOfReported: 0.375,
        shareOfTotal: 0.3,
        rawBrands: [
          { brand: 'Redmi', users: 1 },
          { brand: 'Xiaomi', users: 2 },
        ],
      },
      {
        makerKey: 'other',
        makerLabel: '其他',
        users: 1,
        shareOfReported: 0.125,
        shareOfTotal: 0.1,
        rawBrands: [{ brand: 'BrandX', users: 1 }],
      },
    ],
    ...overrides,
  }
}

describe('PhoneBrandChart', () => {
  it('展示覆盖率、厂商人数与占已上报比例，并为每个厂商渲染 logo', () => {
    render(<PhoneBrandChart data={brands()} />)

    expect(
      screen.getByText(/已上报 8 \/ 10 位家长/),
    ).toBeInTheDocument()
    expect(screen.getByText(/80\.0%/)).toBeInTheDocument()

    expect(screen.getByAltText('Apple logo')).toBeInTheDocument()
    expect(screen.getByAltText('小米 logo')).toBeInTheDocument()
    expect(screen.getByAltText('其他 logo')).toBeInTheDocument()

    expect(
      screen.getByText('4 人 · 50.0%（占已上报）'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('3 人 · 37.5%（占已上报）'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('1 人 · 12.5%（占已上报）'),
    ).toBeInTheDocument()
  })

  it('未知单独一行，按占总人数展示，并使用通用兜底 logo', () => {
    render(<PhoneBrandChart data={brands()} />)

    expect(screen.getByAltText('未知品牌 logo')).toBeInTheDocument()
    expect(
      screen.getByText('2 人 · 20.0%（占总人数）'),
    ).toBeInTheDocument()
  })

  it('全部未上报时显示空态与覆盖率，不渲染空 bar', () => {
    render(
      <PhoneBrandChart
        data={brands({
          reportedUsers: 0,
          unknownUsers: 10,
          coverage: 0,
          brands: [],
        })}
      />,
    )

    expect(
      screen.getByText('暂无手机品牌数据（小程序新版本上线后开始采集）'),
    ).toBeInTheDocument()
    expect(screen.getByText(/已上报 0 \/ 10 位家长/)).toBeInTheDocument()
    expect(screen.queryByAltText('Apple logo')).not.toBeInTheDocument()
  })
})
