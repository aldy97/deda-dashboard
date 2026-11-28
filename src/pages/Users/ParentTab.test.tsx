import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import dayjs from 'dayjs'
import ParentTab from './ParentTab'

const onRangeChange = vi.fn()

vi.mock('../../components/AnalyticsRangePicker', () => ({
  default: ({ onChange }: { onChange: (value: unknown) => void }) => (
    <div>
      <button onClick={() => onChange(null)}>清空区间</button>
      <button onClick={() => onChange('picked')}>选择区间</button>
    </div>
  ),
}))

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
  it('渲染家长概览与画像，并把区间变化交给上层', async () => {
    const user = userEvent.setup()
    const range: [dayjs.Dayjs, dayjs.Dayjs] = [
      dayjs('2026-11-01'),
      dayjs('2026-11-28'),
    ]

    render(<ParentTab range={range} onRangeChange={onRangeChange} />)

    expect(screen.getByText('注册家长总数')).toBeTruthy()
    expect(screen.getByText('区间新增家长')).toBeTruthy()
    expect(screen.getByText(/家长性别分布/)).toBeTruthy()

    await user.click(screen.getByText('清空区间'))
    expect(onRangeChange).not.toHaveBeenCalled()

    await user.click(screen.getByText('选择区间'))
    expect(onRangeChange).toHaveBeenCalledWith('picked')
  })
})
