import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { apiClient } from '../../api/client'
import Users from './index'
import type {
  ParentDemographicsResponse,
  PhoneBrandsResponse,
  UsersDemographicsResponse,
  UsersSummaryResponse,
} from '../../types/analytics'

vi.mock('../../api/client', () => ({
  apiClient: { get: vi.fn() },
}))

const mockGet = apiClient.get as unknown as ReturnType<typeof vi.fn>

const SUMMARY: UsersSummaryResponse = {
  totalUsers: 100,
  newUsersInRange: 12,
  usersWithBoundDevice: 80,
  avgDevicesPerUser: 1.2,
  multiChildFamilies: 8,
  multiDeviceFamilies: 3,
}

const DEMOGRAPHICS: UsersDemographicsResponse = {
  ageDistribution: [
    { range: '0-3', devices: 1 },
    { range: '3-6', devices: 0 },
    { range: '6-9', devices: 0 },
    { range: '9+', devices: 0 },
    { range: 'unknown', devices: 0 },
  ],
  genderSplit: { male: 1, female: 0, unset: 0 },
  characterKeySplit: [],
  bindingsPerDevice: [],
}

const PARENT_DEMOGRAPHICS: ParentDemographicsResponse = {
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

const PHONE_BRANDS: PhoneBrandsResponse = {
  totalUsers: 100,
  reportedUsers: 80,
  unknownUsers: 20,
  coverage: 0.8,
  firstReportedAt: '2026-11-27T01:00:00.000Z',
  brands: [
    {
      makerKey: 'apple',
      makerLabel: 'Apple',
      users: 50,
      shareOfReported: 0.625,
      shareOfTotal: 0.5,
      rawBrands: [{ brand: 'Apple', users: 50 }],
    },
  ],
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/users']}>
        <Routes>
          <Route path="/users" element={<Users />} />
          <Route
            path="/users/:deviceId"
            element={<div>设备详情桩</div>}
          />
          <Route path="/parents/:userId" element={<div>家长档案桩</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('用户画像页 · 家长手机品牌分布', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockGet.mockImplementation((url: string) => {
      if (url === '/analytics/users/summary')
        return Promise.resolve({ data: SUMMARY })
      if (url === '/analytics/users/demographics')
        return Promise.resolve({ data: DEMOGRAPHICS })
      if (url === '/analytics/users/parent-demographics')
        return Promise.resolve({ data: PARENT_DEMOGRAPHICS })
      if (url === '/analytics/users/phone-brands')
        return Promise.resolve({ data: PHONE_BRANDS })
      return Promise.resolve({ data: null })
    })
  })

  it('渲染覆盖率、Apple 官方彩色 logo 与占已上报比例', async () => {
    renderPage()

    expect(await screen.findByText('注册家长总数')).toBeTruthy()
    expect(await screen.findByText(/已上报 80 \/ 100 位家长/)).toBeTruthy()
    expect(screen.getByText(/80\.0%/)).toBeTruthy()
    expect(screen.getByAltText('Apple logo')).toBeInTheDocument()
    expect(screen.getByText('50 人 · 62.5%（占已上报）')).toBeInTheDocument()
    expect(screen.getByAltText('未知品牌 logo')).toBeInTheDocument()
  })

  it('手机品牌接口失败只影响本卡，用户概览仍渲染', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/analytics/users/phone-brands')
        return Promise.reject(new Error('brands down'))
      if (url === '/analytics/users/summary')
        return Promise.resolve({ data: SUMMARY })
      if (url === '/analytics/users/demographics')
        return Promise.resolve({ data: DEMOGRAPHICS })
      if (url === '/analytics/users/parent-demographics')
        return Promise.resolve({ data: PARENT_DEMOGRAPHICS })
      return Promise.resolve({ data: null })
    })

    renderPage()

    expect(await screen.findByText('手机品牌数据加载失败')).toBeTruthy()
    expect(screen.getByText('注册家长总数')).toBeTruthy()
  })
})

/**
 * 搜索框是「以设备为锚」与「以家长为锚」两个入口的唯一分流点：
 * UUID → 家长档案，其余（业务设备 ID）→ 设备档案。分错了会把用户带到 404。
 */
describe('用户画像页 · 搜索分流与概览卡片', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockGet.mockImplementation((url: string) => {
      if (url === '/analytics/users/summary')
        return Promise.resolve({ data: SUMMARY })
      if (url === '/analytics/users/demographics')
        return Promise.resolve({ data: DEMOGRAPHICS })
      if (url === '/analytics/users/parent-demographics')
        return Promise.resolve({ data: PARENT_DEMOGRAPHICS })
      if (url === '/analytics/users/phone-brands')
        return Promise.resolve({ data: PHONE_BRANDS })
      return Promise.resolve({ data: null })
    })
  })

  async function search(value: string) {
    const user = userEvent.setup()
    const input = await screen.findByPlaceholderText(
      '输入设备 ID 或家长 ID 查看详情',
    )
    await user.type(input, `${value}{enter}`)
  }

  it('UUID（家长 ID）跳家长档案，允许前后空白', async () => {
    renderPage()
    await search('  9f8b7c6d-1a2b-4c3d-8e9f-0a1b2c3d4e5f  ')
    expect(await screen.findByText('家长档案桩')).toBeTruthy()
    expect(screen.queryByText('设备详情桩')).toBeNull()
  })

  it('非 UUID（业务设备 ID）仍跳设备档案', async () => {
    renderPage()
    await search('DEV-001')
    expect(await screen.findByText('设备详情桩')).toBeTruthy()
    expect(screen.queryByText('家长档案桩')).toBeNull()
  })

  it('纯空白输入不跳转，仍留在用户画像页', async () => {
    renderPage()
    await search('   ')
    expect(screen.queryByText('家长档案桩')).toBeNull()
    expect(screen.queryByText('设备详情桩')).toBeNull()
    expect(screen.getByText('注册家长总数')).toBeTruthy()
  })

  it('概览新增「多设备家庭」卡片', async () => {
    renderPage()
    const title = await screen.findByText('多设备家庭')
    expect(title).toBeTruthy()
    expect(title.closest('.ant-statistic')?.textContent).toContain('3')
  })
})

describe('用户画像页 · 家长 / 孩子设备双 tab', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockGet.mockImplementation((url: string) => {
      if (url === '/analytics/users/summary')
        return Promise.resolve({ data: SUMMARY })
      if (url === '/analytics/users/parent-demographics')
        return Promise.resolve({ data: PARENT_DEMOGRAPHICS })
      if (url === '/analytics/users/demographics')
        return Promise.resolve({ data: DEMOGRAPHICS })
      if (url === '/analytics/users/phone-brands')
        return Promise.resolve({ data: PHONE_BRANDS })
      return Promise.resolve({ data: null })
    })
  })

  it('默认落在家长画像，不请求孩子/设备画像接口', async () => {
    renderPage()

    expect(await screen.findByText('注册家长总数')).toBeTruthy()
    expect(screen.getByText(/家长性别分布/)).toBeTruthy()
    expect(mockGet).not.toHaveBeenCalledWith('/analytics/users/demographics')
    expect(screen.getByRole('tab', { name: '家长画像' })).toBeInTheDocument()
    expect(
      screen.getByRole('tab', { name: '孩子 / 设备画像' }),
    ).toBeInTheDocument()
  })

  it('切到孩子/设备画像才请求 demographics，并显示口径说明', async () => {
    renderPage()
    await screen.findByText('注册家长总数')

    const user = userEvent.setup()
    await user.click(screen.getByRole('tab', { name: '孩子 / 设备画像' }))

    expect(await screen.findByText('统计单位：设备与孩子档案')).toBeTruthy()
    expect(mockGet).toHaveBeenCalledWith('/analytics/users/demographics')
    expect(screen.getByText(/孩子年龄段分布/)).toBeTruthy()
  })
})

describe('用户画像页 · header 日期与刷新', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockGet.mockImplementation((url: string) => {
      if (url === '/analytics/users/summary')
        return Promise.resolve({ data: SUMMARY })
      if (url === '/analytics/users/parent-demographics')
        return Promise.resolve({ data: PARENT_DEMOGRAPHICS })
      if (url === '/analytics/users/demographics')
        return Promise.resolve({ data: DEMOGRAPHICS })
      if (url === '/analytics/users/phone-brands')
        return Promise.resolve({ data: PHONE_BRANDS })
      return Promise.resolve({ data: null })
    })
  })

  it('header 同时渲染日期区间与刷新按钮', async () => {
    renderPage()

    expect(await screen.findByText('注册家长总数')).toBeTruthy()
    expect(screen.getByRole('button', { name: /刷新/ })).toBeInTheDocument()
    // 默认区间含今天，TodayOngoingTag 只在 header 的 RangePicker 内渲染
    expect(screen.getByText('今日数据进行中')).toBeTruthy()
  })

  it('点击刷新重新拉取本页数据', async () => {
    renderPage()
    await screen.findByText('注册家长总数')

    const callsBefore = mockGet.mock.calls.length
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /刷新/ }))

    await waitFor(() =>
      expect(mockGet.mock.calls.length).toBeGreaterThan(callsBefore),
    )
    expect(
      mockGet.mock.calls.some(([url]) => url === '/analytics/users/summary'),
    ).toBe(true)
  })
})
