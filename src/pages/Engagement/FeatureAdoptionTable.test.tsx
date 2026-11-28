import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import FeatureAdoptionTable from './FeatureAdoptionTable'
import type { FeatureAdoptionResponse } from '../../types/analytics'

const mockUseAnalyticsMeta = vi.fn()
vi.mock('../../api/meta', () => ({
  useAnalyticsMeta: () => mockUseAnalyticsMeta(),
}))

beforeEach(() => {
  mockUseAnalyticsMeta.mockReturnValue({
    data: { admin: { role: 'superadmin' } },
    isPending: false,
    isError: false,
  })
})

/**
 * 功能渗透率表格的跨页出口契约。
 *
 * 四个功能 key 的「查看」链接 href 必须正确映射，消息类链接必带 startDate/endDate。
 */

function adoption(date?: string, startDate?: string, endDate?: string) {
  return {
    data: {
      date: date ?? '2026-11-14',
      features: [
        { key: 'sleep_mode' as const, label: '哄睡模式', penetrationRate: 0.4, enabledDevices: 320 },
        { key: 'adventure' as const, label: '冒险故事', penetrationRate: 0.5, activeDevices: 400, completionRate: 0.7 },
        { key: 'habit_plan' as const, label: '习惯打卡', penetrationRate: 0.3, enabledDevices: 240, avgCompletionRate: 0.65 },
        { key: 'english' as const, label: '英语学习', penetrationRate: 0.35, activeDevices: 280 },
      ],
    } as FeatureAdoptionResponse,
    startDate: startDate ?? '2026-11-08',
    endDate: endDate ?? '2026-11-14',
  }
}

describe('FeatureAdoptionTable 跨页出口', () => {
  it('adventure → /adventure?tab=episodes', () => {
    render(
      <MemoryRouter>
        <FeatureAdoptionTable data={adoption().data} startDate={adoption().startDate} endDate={adoption().endDate} />
      </MemoryRouter>,
    )
    const link = screen.getByText('冒险故事').closest('a')
    expect(link?.getAttribute('href')).toBe('/adventure?tab=episodes')
  })

  it('english → /messages?mode=english_chat&startDate=&endDate= with range', () => {
    render(
      <MemoryRouter>
        <FeatureAdoptionTable data={adoption().data} startDate="2026-11-08" endDate="2026-11-14" />
      </MemoryRouter>,
    )
    const link = screen.getByText('英语学习').closest('a')
    expect(link?.getAttribute('href')).toBe('/messages?mode=english_chat&startDate=2026-11-08&endDate=2026-11-14')
  })

  it('sleep_mode → /messages?mode=sleep_story&startDate=&endDate= with range', () => {
    render(
      <MemoryRouter>
        <FeatureAdoptionTable data={adoption().data} startDate="2026-11-08" endDate="2026-11-14" />
      </MemoryRouter>,
    )
    const link = screen.getByText('哄睡模式').closest('a')
    expect(link?.getAttribute('href')).toBe('/messages?mode=sleep_story&startDate=2026-11-08&endDate=2026-11-14')
  })

  it('habit_plan → /content', () => {
    render(
      <MemoryRouter>
        <FeatureAdoptionTable data={adoption().data} startDate={adoption().startDate} endDate={adoption().endDate} />
      </MemoryRouter>,
    )
    const link = screen.getByText('习惯打卡').closest('a')
    expect(link?.getAttribute('href')).toBe('/content')
  })
})

describe('FeatureAdoptionTable · 普通 admin', () => {
  it('冒险行退化为纯文本，消息类出口照常可点', () => {
    mockUseAnalyticsMeta.mockReturnValue({
      data: { admin: { role: 'admin' } },
      isPending: false,
      isError: false,
    })

    render(
      <MemoryRouter>
        <FeatureAdoptionTable data={adoption().data} startDate={adoption().startDate} endDate={adoption().endDate} />
      </MemoryRouter>,
    )

    const adventure = screen.getByText('冒险故事')
    expect(adventure.tagName).toBe('SPAN')
    expect(adventure).toHaveAttribute('data-access', 'restricted')
    expect(screen.getByText('英语学习').closest('a')).toBeTruthy()
  })
})
