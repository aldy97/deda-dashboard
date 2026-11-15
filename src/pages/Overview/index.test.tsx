import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { apiClient } from '../../api/client'
import Overview from './index'
import type { OverviewResponse } from '../../types/analytics'

/**
 * 总览页的跨页出口契约。
 *
 * 总览是登录后的落地页，它的职责是「把人的注意力分发到该去的页面」：
 * KPI 卡按指标语义分别指向设备舰队 / 用户画像 / 使用行为 / 留存与激活，
 * 趋势卡指向使用行为，漏斗指向留存。这里只考核出口，不重复考核子组件内部。
 */
vi.mock('../../api/client', () => ({
  apiClient: { get: vi.fn() },
  TOKEN_KEY: 'deda_dashboard_token',
}))

const mockGet = apiClient.get as unknown as ReturnType<typeof vi.fn>

const OVERVIEW: OverviewResponse = {
  date: '2026-11-14',
  totals: {
    devicesRegistered: 1200,
    devicesActivated: 800,
    usersRegistered: 600,
    activationRate: 0.667,
  },
  today: {
    dau: 120,
    dauDeltaPct: 5.2,
    avgDurationSecondsPerActiveDevice: 1800,
    avgTurnsPerActiveDevice: 12,
    devicesPoweredOn: 200,
    powerOnRate: 0.25,
    onlineNow: 15,
  },
  retention: { d1: 0.55, d7: 0.35, d30: null },
  funnel: {
    shipped: null,
    activated: 800,
    firstConversation: 750,
    active7d: 400,
  },
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/overview']}>
        <Overview />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** 按卡片标题定位卡片，避免写死卡片顺序 */
function cardOf(title: string): HTMLElement {
  const card = screen.getByText(title).closest('.ant-card')
  expect(card).toBeTruthy()
  return card as HTMLElement
}

describe('总览页 · 跨页出口', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockGet.mockImplementation((url: string) => {
      if (url === '/analytics/overview') {
        return Promise.resolve({ data: OVERVIEW })
      }
      // 趋势接口不关心：这里只考核出口链接，不考核图表
      return Promise.resolve({ data: null })
    })
  })

  it('核心指标趋势卡右上角有到 /engagement 的出口', async () => {
    renderPage()
    await screen.findByText('核心指标趋势')
    expect(
      cardOf('核心指标趋势').querySelector('a[href="/engagement"]'),
    ).toBeTruthy()
  })

  it('激活漏斗卡有到 /retention 的出口', async () => {
    renderPage()
    // 等 overview 数据到位：KPI 卡渲染出来才说明接口回来了
    await screen.findByText('累计激活设备')
    const links = screen.getAllByRole('link', { name: /留存与激活/ })
    // 一条来自 KPI 卡的留存指标，一条来自激活漏斗卡，两者都该指向留存页
    expect(links).toHaveLength(2)
    expect(
      links.every((a) => a.getAttribute('href') === '/retention'),
    ).toBe(true)
  })

  it('KPI 卡渲染出来，设备类指标指向 /fleet', async () => {
    renderPage()
    expect(await screen.findByText('累计激活设备')).toBeTruthy()
    expect(
      cardOf('累计激活设备').querySelector('a[href="/fleet"]'),
    ).toBeTruthy()
  })
})
