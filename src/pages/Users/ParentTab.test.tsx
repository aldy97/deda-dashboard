import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import dayjs from 'dayjs'
import ParentTab from './ParentTab'

vi.mock('../../api/queries', () => ({
  useUsersSummary: () => ({
    data: {
      totalUsers: 10,
      newUsersInRange: 2,
      usersWithBoundDevice: 8,
      avgDevicesPerUser: 1.5,
      multiChildFamilies: 1,
      multiDeviceFamilies: 2,
    },
    isLoading: false,
    error: null,
  }),
  useParentDemographics: () => ({
    data: {
      totalUsers: 10,
      genderSplit: { male: 3, female: 6, unset: 1 },
      ageDistribution: [{ range: '25-34', users: 10 }],
    },
    isLoading: false,
    error: null,
  }),
  usePhoneBrands: () => ({ data: null, isLoading: false, error: null }),
}))

describe('ParentTab', () => {
  it('渲染家长概览与画像', () => {
    const range: [dayjs.Dayjs, dayjs.Dayjs] = [
      dayjs('2026-11-01'),
      dayjs('2026-11-28'),
    ]

    render(<ParentTab range={range} />)

    expect(screen.getByText('注册家长总数')).toBeTruthy()
    expect(screen.getByText('区间新增家长')).toBeTruthy()
    expect(screen.getByText(/家长性别分布/)).toBeTruthy()
  })
})
