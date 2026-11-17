import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { apiClient } from '../../api/client'
import Content from './index'
import type {
  ContentAdventureResponse,
  ContentLearningResponse,
  QualityConversationResponse,
} from '../../types/analytics'

vi.mock('../../api/client', () => ({
  apiClient: { get: vi.fn() },
  TOKEN_KEY: 'deda_dashboard_token',
}))

const mockGet = apiClient.get as unknown as ReturnType<typeof vi.fn>

const ADVENTURE_RESPONSE: ContentAdventureResponse = {
  startedDevices: 10,
  completedEpisodes: 50,
  completionRate: 0.8,
  avgStarsPerEpisode: 4.2,
  topEpisodes: [
    {
      episodeId: 'ep-1',
      title: '第一章',
      completions: 20,
      avgStars: 4.5,
    },
  ],
}

const LEARNING_RESPONSE: ContentLearningResponse = {
  totalNewWords: 100,
  avgNewWordsPerActiveDevice: 5,
  speakCountTotal: 200,
  habitPlansActive: 3,
  habitCompletionRate: 0.75,
}

const QUALITY_RESPONSE: QualityConversationResponse = {
  granularity: 'day',
  series: [
    {
      date: '2026-11-10',
      totalTurns: 100,
      failedTurns: 5,
      failureRate: 0.05,
      safetyBlockedTurns: 2,
      safetyRate: 0.02,
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
        <Content />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('内容与质量页 · 归位', () => {
  beforeEach(() => {
    mockGet.mockReset()
  })

  it('不渲染家长报告卡片', async () => {
    mockGet.mockResolvedValue({ data: ADVENTURE_RESPONSE })

    renderPage()

    await screen.findByText('冒险故事')
    expect(screen.queryByText('生成报告数')).toBeNull()
    expect(screen.queryByText('生成失败数')).toBeNull()
    expect(screen.queryByText('收到反馈数')).toBeNull()
  })

  it('对话质量趋势卡片有口径说明（InfoTip）', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/analytics/content/adventure') return Promise.resolve({ data: ADVENTURE_RESPONSE })
      if (url === '/analytics/content/learning') return Promise.resolve({ data: LEARNING_RESPONSE })
      if (url === '/analytics/quality/conversation') return Promise.resolve({ data: QUALITY_RESPONSE })
      return Promise.resolve({ data: null })
    })

    renderPage()

    // 等待所有数据加载完成
    expect(await screen.findByText('新学单词总数')).toBeTruthy()

    // 检查对话质量卡片标题存在
    expect(screen.getByText(/对话质量/)).toBeTruthy()

    // InfoTip 存在
    const infoIcons = document.querySelectorAll('[aria-label="question-circle"]')
    expect(infoIcons.length).toBeGreaterThan(0)
  })

  it('对话质量趋势卡片有 /llm?tab=perf 和 /llm?tab=safety 出口', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/analytics/content/adventure') return Promise.resolve({ data: ADVENTURE_RESPONSE })
      if (url === '/analytics/content/learning') return Promise.resolve({ data: LEARNING_RESPONSE })
      if (url === '/analytics/quality/conversation') return Promise.resolve({ data: QUALITY_RESPONSE })
      return Promise.resolve({ data: null })
    })

    renderPage()

    expect(await screen.findByText('新学单词总数')).toBeTruthy()

    const perfLink = screen.getByText(/模型监控.*性能/)
    expect(perfLink.tagName).toBe('A')
    expect(perfLink.getAttribute('href')).toBe('/llm?tab=perf')

    const safetyLink = screen.getByText(/模型监控.*安全/)
    expect(safetyLink.tagName).toBe('A')
    expect(safetyLink.getAttribute('href')).toBe('/llm?tab=safety')
  })

  it('学习数据卡片有英语对话和故事消息出口', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/analytics/content/adventure') return Promise.resolve({ data: ADVENTURE_RESPONSE })
      if (url === '/analytics/content/learning') return Promise.resolve({ data: LEARNING_RESPONSE })
      if (url === '/analytics/quality/conversation') return Promise.resolve({ data: QUALITY_RESPONSE })
      return Promise.resolve({ data: null })
    })

    renderPage()

    expect(await screen.findByText('新学单词总数')).toBeTruthy()

    const engChatLink = screen.getByText(/英语对话消息/)
    expect(engChatLink.tagName).toBe('A')
    expect(engChatLink.getAttribute('href')).toContain('mode=english_chat')

    const engStoryLink = screen.getByText(/英语故事消息/)
    expect(engStoryLink.tagName).toBe('A')
    expect(engStoryLink.getAttribute('href')).toContain('mode=english_story')
  })
})
