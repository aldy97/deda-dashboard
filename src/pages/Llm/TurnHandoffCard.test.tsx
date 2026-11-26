import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TurnHandoffCard from './TurnHandoffCard'
import { useLlmTurnHandoff } from '../../api/queries'
import type { LlmTurnHandoffResponse } from '../../types/analytics'

vi.mock('../../api/queries', () => ({
  useLlmTurnHandoff: vi.fn(),
}))

const mockHandoff = useLlmTurnHandoff as unknown as ReturnType<typeof vi.fn>

function handoff(
  overrides: Partial<LlmTurnHandoffResponse> = {},
): LlmTurnHandoffResponse {
  return {
    turnsWithChat: 100,
    turnsWithBoth: 80,
    turnsMissingFiller: 20,
    turnsUnknown: 0,
    gapThresholdMs: 300,
    gapP50Ms: 120.4,
    gapP90Ms: 1500.6,
    gapRate: 0.1234,
    topGaps: [
      {
        turnId: 'turn-abcdef123456',
        gapMs: 2200,
        createdAt: '2026-11-20T10:00:00.000Z',
      },
    ],
    ...overrides,
  }
}

function renderCard() {
  return render(
    <MemoryRouter>
      <TurnHandoffCard startDate="2026-11-14" endDate="2026-11-20" />
    </MemoryRouter>,
  )
}

describe('TurnHandoffCard 指标', () => {
  it('空窗轮占比保留一位小数，gap 分位数按 formatMs 取整', () => {
    mockHandoff.mockReturnValue({
      data: handoff(),
      isLoading: false,
      error: null,
    })
    renderCard()

    expect(screen.getByText('空窗轮占比')).toBeInTheDocument()
    expect(screen.getByText('12.3%')).toBeInTheDocument()
    expect(screen.getByText('120 ms')).toBeInTheDocument()
    expect(screen.getByText('1.50 s')).toBeInTheDocument()
    expect(screen.getByText('20 / 100')).toBeInTheDocument()
  })

  it('gapRate 为 null 时显示「—」，不是 0%', () => {
    mockHandoff.mockReturnValue({
      data: handoff({ gapRate: null, gapP50Ms: null, gapP90Ms: null }),
      isLoading: false,
      error: null,
    })
    renderCard()

    // 三处 null（占比 / P50 / P90）
    expect(screen.getAllByText('—')).toHaveLength(3)
    expect(screen.queryByText('0%')).not.toBeInTheDocument()
  })

  it('topGaps 行可跳消息明细，时间按格式渲染不硬编码钟点', () => {
    mockHandoff.mockReturnValue({
      data: handoff(),
      isLoading: false,
      error: null,
    })
    renderCard()

    const link = screen.getByRole('link', { name: /turn-abc…/ })
    expect(link.getAttribute('href')).toBe('/messages?turnId=turn-abcdef123456')
    expect(screen.getByText('2.20 s')).toBeInTheDocument()
    expect(screen.getByText(/^2026-11-20 \d{2}:00:00$/)).toBeInTheDocument()
  })

  it('无双样本轮次时给空态文案', () => {
    mockHandoff.mockReturnValue({
      data: handoff({ topGaps: [], turnsWithBoth: 0 }),
      isLoading: false,
      error: null,
    })
    renderCard()

    expect(screen.getByText('所选区间暂无双样本轮次')).toBeInTheDocument()
  })
})

describe('TurnHandoffCard 加载与异常', () => {
  it('无数据时不渲染任何内容（不占位空卡片）', () => {
    mockHandoff.mockReturnValue({ data: null, isLoading: true, error: null })
    const { container } = renderCard()

    expect(container.innerHTML).toBe('')
  })

  it('Error 对象展示 message', () => {
    mockHandoff.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('handoff down'),
    })
    renderCard()

    expect(screen.getByText('轮次衔接数据加载失败')).toBeInTheDocument()
    expect(screen.getByText('handoff down')).toBeInTheDocument()
  })

  it('非 Error 异常降级为「加载失败」', () => {
    mockHandoff.mockReturnValue({ data: null, isLoading: false, error: 'boom' })
    renderCard()

    expect(screen.getByText('加载失败')).toBeInTheDocument()
  })

  it('请求参数透传区间并只调一个接口', () => {
    mockHandoff.mockReturnValue({
      data: handoff(),
      isLoading: false,
      error: null,
    })
    renderCard()

    expect(mockHandoff).toHaveBeenCalledWith({
      startDate: '2026-11-14',
      endDate: '2026-11-20',
    })
  })
})
