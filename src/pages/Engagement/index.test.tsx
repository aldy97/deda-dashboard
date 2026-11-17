import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { apiClient } from '../../api/client'
import Engagement from './index'
import type {
  EngagementSummaryResponse,
  ModeUsageResponse,
  HourlyHeatmapResponse,
  DurationDistributionResponse,
  FeatureAdoptionResponse,
} from '../../types/analytics'
import { fmt, defaultRange } from '../../utils/date-range'

vi.mock('../../api/client', () => ({
  apiClient: { get: vi.fn() },
  TOKEN_KEY: 'deda_dashboard_token',
}))

const mockGet = apiClient.get as unknown as ReturnType<typeof vi.fn>

const ENGAGEMENT_SUMMARY: EngagementSummaryResponse = {
  activeDevices: 100,
  avgDurationSecondsPerDevice: 300,
  durationP50Seconds: 250,
  durationP90Seconds: 500,
  avgTurnsPerDevice: 10,
  turnsP50: 8,
  avgActiveDaysPerDevice: 5,
  totalTurns: 1000,
}

const HEATMAP: HourlyHeatmapResponse = {
  grid: Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0)),
  maxValue: 0,
}

const DISTRIBUTION: DurationDistributionResponse = {
  date: '2026-11-15',
  buckets: [],
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
        <Engagement />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('使用行为页 · 跨页下钻出口', () => {
  const range = defaultRange(7)
  const startDate = fmt(range[0])
  const endDate = fmt(range[1])

  beforeEach(() => {
    mockGet.mockReset()
  })

  describe('模式分布卡下方下钻链接', () => {
    const MODE_USAGE: ModeUsageResponse = {
      series: [
        {
          date: '2026-11-10',
          modes: [
            { mode: 'free_chat', turns: 100, devices: 50 },
            { mode: 'adventure_story', turns: 30, devices: 20 },
          ],
        },
        {
          date: '2026-11-11',
          modes: [{ mode: 'free_chat', turns: 120, devices: 55 }],
        },
      ],
    }

    const ADOPTION_EMPTY: FeatureAdoptionResponse = {
      date: '2026-11-15',
      features: [],
    }

    beforeEach(() => {
      mockGet.mockImplementation((url: string) => {
        if (url === '/analytics/engagement/summary')
          return Promise.resolve({ data: ENGAGEMENT_SUMMARY })
        if (url === '/analytics/engagement/mode-usage')
          return Promise.resolve({ data: MODE_USAGE })
        if (url === '/analytics/engagement/hourly-heatmap')
          return Promise.resolve({ data: HEATMAP })
        if (url === '/analytics/engagement/duration-distribution')
          return Promise.resolve({ data: DISTRIBUTION })
        if (url === '/analytics/engagement/feature-adoption')
          return Promise.resolve({ data: ADOPTION_EMPTY })
        return Promise.resolve({ data: null })
      })
    })

    it('渲染每个出现过的 mode 一条链接（去重保序）', async () => {
      renderPage()

      // 等待页面数据加载完成
      expect(await screen.findByText('自由对话')).toBeTruthy()

      // 两个 mode 都出现了
      const freeChatElements = screen.getAllByText('自由对话')
      expect(freeChatElements).toHaveLength(1)
      expect(freeChatElements[0].tagName).toBe('A')

      const adventureElements = screen.getAllByText('冒险故事')
      expect(adventureElements).toHaveLength(1)
      expect(adventureElements[0].tagName).toBe('A')
    })

    it('链接 href 包含正确的 mode 和日期区间', async () => {
      renderPage()

      expect(await screen.findByText('自由对话')).toBeTruthy()

      const freeChatLink = screen.getByText('自由对话').closest('a')
      expect(freeChatLink?.getAttribute('href')).toBe(
        `/messages?mode=free_chat&startDate=${startDate}&endDate=${endDate}`,
      )

      const adventureLink = screen.getByText('冒险故事').closest('a')
      expect(adventureLink?.getAttribute('href')).toBe(
        `/messages?mode=adventure_story&startDate=${startDate}&endDate=${endDate}`,
      )
    })
  })

  describe('FeatureAdoptionTable 收到区间 props', () => {
    const MODE_USAGE_EMPTY: ModeUsageResponse = {
      series: [],
    }

    const ADOPTION: FeatureAdoptionResponse = {
      date: '2026-11-15',
      features: [
        {
          key: 'english' as const,
          label: '英语学习',
          penetrationRate: 0.35,
          activeDevices: 280,
        },
        {
          key: 'sleep_mode' as const,
          label: '哄睡模式',
          penetrationRate: 0.4,
          enabledDevices: 320,
        },
      ],
    }

    beforeEach(() => {
      mockGet.mockImplementation((url: string) => {
        if (url === '/analytics/engagement/summary')
          return Promise.resolve({ data: ENGAGEMENT_SUMMARY })
        if (url === '/analytics/engagement/mode-usage')
          return Promise.resolve({ data: MODE_USAGE_EMPTY })
        if (url === '/analytics/engagement/hourly-heatmap')
          return Promise.resolve({ data: HEATMAP })
        if (url === '/analytics/engagement/duration-distribution')
          return Promise.resolve({ data: DISTRIBUTION })
        if (url === '/analytics/engagement/feature-adoption')
          return Promise.resolve({ data: ADOPTION })
        return Promise.resolve({ data: null })
      })
    })

    it('英语学习链接 href 带正确的 startDate 和 endDate', async () => {
      renderPage()

      // 等待渗透率表渲染——英语学习是一个链接
      expect(await screen.findByText('英语学习')).toBeTruthy()

      const link = screen.getByText('英语学习').closest('a')
      expect(link?.getAttribute('href')).toBe(
        `/messages?mode=english_chat&startDate=${startDate}&endDate=${endDate}`,
      )
    })
  })
})