import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { apiClient } from '../../api/client'
import Users from './index'
import type {
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
}

const DEMOGRAPHICS: UsersDemographicsResponse = {
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
      <MemoryRouter>
        <Users />
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
      return Promise.resolve({ data: null })
    })

    renderPage()

    expect(await screen.findByText('手机品牌数据加载失败')).toBeTruthy()
    expect(screen.getByText('注册家长总数')).toBeTruthy()
  })
})
