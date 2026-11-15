import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import dayjs from 'dayjs'
import AdventureSection from './AdventureSection'
import type { ContentAdventureResponse } from '../../types/analytics'
import type { DayRange } from '../../utils/date-range'

// Mock useAdventureCapabilities
const mockUseAdventureCapabilities = vi.fn()
vi.mock('../../api/queries', () => ({
  useAdventureCapabilities: () => mockUseAdventureCapabilities(),
}))

const DATA: ContentAdventureResponse = {
  startedDevices: 10,
  completedEpisodes: 50,
  completionRate: 0.8,
  avgStarsPerEpisode: 4.2,
  topEpisodes: [
    {
      episodeId: 'ep-001',
      title: '森林冒险',
      completions: 20,
      avgStars: 4.5,
    },
    {
      episodeId: 'ep-002',
      title: '海底世界',
      completions: 15,
      avgStars: 3.8,
    },
  ],
}

const RANGE: DayRange = [dayjs('2026-11-01'), dayjs('2026-11-14')]

function renderSection() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdventureSection data={DATA} range={RANGE} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AdventureSection · 下钻出口', () => {
  beforeEach(() => {
    mockUseAdventureCapabilities.mockReset()
  })

  describe('权限已确认（capabilities 成功）', () => {
    beforeEach(() => {
      mockUseAdventureCapabilities.mockReturnValue({
        data: { authoring: true },
        isPending: false,
        error: null,
      })
    })

    it('剧集列链接指向 /adventure?tab=episodes&episodeId=<id>', async () => {
      renderSection()

      const epLink = screen.getByText('森林冒险')
      expect(epLink.tagName).toBe('A')
      expect(epLink.getAttribute('href')).toBe('/adventure?tab=episodes&episodeId=ep-001')

      const ep2Link = screen.getByText('海底世界')
      expect(ep2Link.getAttribute('href')).toBe('/adventure?tab=episodes&episodeId=ep-002')
    })

    it('卡片级出口「冒险内容工作台 →」指向 /adventure?tab=episodes', async () => {
      renderSection()

      const workbenchLink = screen.getByText(/冒险内容工作台/)
      expect(workbenchLink.tagName).toBe('A')
      expect(workbenchLink.getAttribute('href')).toBe('/adventure?tab=episodes')
    })

    it('「看冒险对话消息 →」链接带 mode=adventure_story', async () => {
      renderSection()

      const msgLink = screen.getByText(/看冒险对话消息/)
      expect(msgLink.tagName).toBe('A')
      expect(msgLink.getAttribute('href')).toContain('mode=adventure_story')
    })
  })

  describe('403 无权限（content scope 缺失）', () => {
    beforeEach(() => {
      const error = new Error('Forbidden') as Error & { status: number }
      error.status = 403
      mockUseAdventureCapabilities.mockReturnValue({
        data: undefined,
        isPending: false,
        error,
      })
    })

    it('剧集列链接渲染为禁用态且出现 scope 说明', async () => {
      renderSection()

      // 链接应该是禁用态（Button type="link" disabled）
      const epBtn = screen.getByText('森林冒险')
      expect(epBtn.closest('button')).toBeTruthy()
      expect((epBtn.closest('button') as HTMLButtonElement).disabled).toBe(true)

      // scope 说明文案
      expect(screen.getByText(/adventure-content scope/)).toBeTruthy()
    })

    it('「冒险内容工作台 →」为禁用态', async () => {
      renderSection()

      const workbenchBtn = screen.getByText(/冒险内容工作台/)
      expect(workbenchBtn.closest('button')).toBeTruthy()
      expect((workbenchBtn.closest('button') as HTMLButtonElement).disabled).toBe(true)
    })

    it('「看冒险对话消息 →」仍然可点（不需要权限）', async () => {
      renderSection()

      const msgLink = screen.getByText(/看冒险对话消息/)
      expect(msgLink.tagName).toBe('A')
      expect(msgLink.getAttribute('href')).toContain('mode=adventure_story')
    })
  })

  describe('只读环境（有 scope 但 authoring=false）', () => {
    beforeEach(() => {
      mockUseAdventureCapabilities.mockReturnValue({
        data: { authoring: false, profile: 'read_only' },
        isPending: false,
        error: null,
      })
    })

    it('查看入口仍然可点：闸口是 scope 不是 authoring', async () => {
      renderSection()

      const epLink = screen.getByText('森林冒险')
      expect(epLink.tagName).toBe('A')
      expect(epLink.getAttribute('href')).toBe(
        '/adventure?tab=episodes&episodeId=ep-001',
      )
      expect(screen.getByText(/冒险内容工作台/).tagName).toBe('A')
      expect(screen.queryByText(/adventure-content scope/)).toBeNull()
    })
  })

  describe('capabilities 加载中', () => {
    beforeEach(() => {
      mockUseAdventureCapabilities.mockReturnValue({
        data: undefined,
        isPending: true,
        error: null,
      })
    })

    it('权限确认中时链接为禁用态', async () => {
      renderSection()

      const epBtn = screen.getByText('森林冒险')
      expect(epBtn.closest('button')).toBeTruthy()
      expect((epBtn.closest('button') as HTMLButtonElement).disabled).toBe(true)

      expect(screen.getByText(/权限确认中/)).toBeTruthy()
    })
  })
})
