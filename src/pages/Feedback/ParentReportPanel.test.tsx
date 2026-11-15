import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { apiClient } from '../../api/client'
import ParentReportPanel from './ParentReportPanel'
import type { ContentParentReportResponse } from '../../types/analytics'

vi.mock('../../api/client', () => ({
  apiClient: { get: vi.fn() },
  TOKEN_KEY: 'deda_dashboard_token',
}))

const mockGet = apiClient.get as unknown as ReturnType<typeof vi.fn>

function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ParentReportPanel />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ParentReportPanel', () => {
  beforeEach(() => {
    mockGet.mockReset()
  })

  const baseResponse: ContentParentReportResponse = {
    generated: 120,
    failed: 8,
    successRate: 0.9375,
    feedbackTotal: 45,
    usefulRate: 0.822,
  }

  it('渲染五个指标：生成报告数、生成失败数、生成成功率、收到反馈数、反馈有用率', async () => {
    mockGet.mockResolvedValue({ data: baseResponse })

    renderPanel()

    expect(await screen.findByText('生成报告数')).toBeTruthy()
    expect(screen.getByText('120')).toBeTruthy()
    expect(screen.getByText('生成失败数')).toBeTruthy()
    expect(screen.getByText('8')).toBeTruthy()
    expect(screen.getByText('生成成功率')).toBeTruthy()
    expect(screen.getByText('93.8%')).toBeTruthy()
    expect(screen.getByText('收到反馈数')).toBeTruthy()
    expect(screen.getByText('45')).toBeTruthy()
    expect(screen.getByText('反馈有用率')).toBeTruthy()
    expect(screen.getByText('82.2%')).toBeTruthy()
  })

  it('null 指标渲染为 —', async () => {
    mockGet.mockResolvedValue({
      data: {
        ...baseResponse,
        successRate: null,
        usefulRate: null,
      },
    })

    renderPanel()

    expect(await screen.findByText('生成成功率')).toBeTruthy()
    expect(screen.getAllByText('—').length).toBe(2)
  })

  it('渲染两个出口链接：日报反馈明细和模型监控', async () => {
    mockGet.mockResolvedValue({ data: baseResponse })

    renderPanel()

    expect(await screen.findByText('生成报告数')).toBeTruthy()

    const reportLink = screen.getByText(/看日报反馈明细/)
    expect(reportLink.tagName).toBe('A')
    expect(reportLink.getAttribute('href')).toContain('tab=report')

    const llmLink = screen.getByText(/模型监控/)
    expect(llmLink.tagName).toBe('A')
    expect(llmLink.getAttribute('href')).toBe('/llm?tab=perf&scene=parent_report')
  })
})
