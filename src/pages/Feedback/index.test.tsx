import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { apiClient } from '../../api/client'
import Feedback from './index'

vi.mock('../../api/client', () => ({
  apiClient: { get: vi.fn() },
  TOKEN_KEY: 'deda_dashboard_token',
}))

const mockGet = apiClient.get as unknown as ReturnType<typeof vi.fn>

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="search">{location.search}</div>
}

function renderPage(entry = '/feedback') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <Feedback />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function search(): string {
  return screen.getByTestId('search').textContent ?? ''
}

describe('用户反馈页 · 三 tab', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockGet.mockImplementation(() => Promise.resolve({ data: null }))
  })

  it('渲染三个 tab：日报反馈、使用反馈、家长报告', async () => {
    renderPage()
    expect(screen.getByText('日报反馈')).toBeTruthy()
    expect(screen.getByText('使用反馈')).toBeTruthy()
    expect(screen.getByText('家长报告')).toBeTruthy()
  })

  it('?tab=parentReport 直接打开家长报告 tab', async () => {
    renderPage('/feedback?tab=parentReport')
    // 检查家长报告面板渲染了（有它的 AnalyticsRangePicker）
    expect(await screen.findByText('家长报告')).toBeTruthy()
    // tab 在 URL 中
    expect(search()).toContain('tab=parentReport')
  })

  it('?tab=report 默认打开日报反馈 tab', async () => {
    renderPage('/feedback?tab=report')
    expect(await screen.findByText('日报反馈')).toBeTruthy()
    expect(search()).toContain('tab=report')
  })

  it('?tab=user 打开使用反馈 tab', async () => {
    renderPage('/feedback?tab=user')
    expect(await screen.findByText('使用反馈')).toBeTruthy()
    expect(search()).toContain('tab=user')
  })

  it('非法 tab 读时回退到 report，不重写 URL', async () => {
    renderPage('/feedback?tab=bogus')
    expect(await screen.findByText('日报反馈')).toBeTruthy()
    // 与 /llm、/adventure 一致：非法值只在读取时兜底，URL 原样保留
    expect(search()).toBe('?tab=bogus')
  })

  it('无 tab 参数默认 report，不往 URL 里塞默认值', async () => {
    renderPage()
    expect(await screen.findByText('日报反馈')).toBeTruthy()
    expect(search()).toBe('')
  })

  it('点 tab 把 ?tab= 写进 URL', async () => {
    renderPage()
    await screen.findByText('日报反馈')
    fireEvent.click(screen.getByText('家长报告'))
    await waitFor(() => {
      expect(search()).toContain('tab=parentReport')
    })
  })

  it('点击刷新重新拉取三个 tab 的查询', async () => {
    renderPage()
    await screen.findByText('日报反馈')
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve, 0))

    const callsBefore = mockGet.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: /刷新/ }))

    await waitFor(() =>
      expect(mockGet.mock.calls.length).toBeGreaterThan(callsBefore),
    )
  })
})
