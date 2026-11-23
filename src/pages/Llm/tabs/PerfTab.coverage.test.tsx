import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import PerfTab from './PerfTab'
import { useLlmSummary, useLlmTrend } from '../../../api/queries'
import type { LlmSceneSummary } from '../../../types/analytics'

// 子组件与告警阈值已有 PerfTab.test.tsx 覆盖；这里只补区间变更与异常兜底
vi.mock('../SceneSummaryTable', () => ({
  default: () => <div data-testid="scene-summary-table" />,
}))
vi.mock('../LlmTrendChart', () => ({
  default: () => <div data-testid="llm-trend-chart" />,
}))
vi.mock('../TurnHandoffCard', () => ({
  default: (props: { startDate: string; endDate: string }) => (
    <div
      data-testid="turn-handoff-card"
      data-start={props.startDate}
      data-end={props.endDate}
    />
  ),
}))
vi.mock('../RecentFailuresTable', () => ({
  default: () => <div data-testid="recent-failures" />,
}))
vi.mock('../SlowCallsTable', () => ({
  default: () => <div data-testid="slow-calls" />,
}))

vi.mock('../../../components/AnalyticsRangePicker', async () => {
  const { default: dayjs } = await import('dayjs')
  return {
    default: (props: { onChange: (range: unknown) => void }) => (
      <div>
        <button onClick={() => props.onChange(null)}>clear-range</button>
        <button
          onClick={() =>
            props.onChange([dayjs('2026-10-01'), dayjs('2026-10-10')])
          }
        >
          set-range
        </button>
      </div>
    ),
  }
})

vi.mock('../../../api/queries', () => ({
  useLlmSummary: vi.fn(),
  useLlmTrend: vi.fn(),
}))

const mockSummary = useLlmSummary as unknown as ReturnType<typeof vi.fn>
const mockTrend = useLlmTrend as unknown as ReturnType<typeof vi.fn>

function mockOk() {
  mockSummary.mockReturnValue({
    data: { scenes: [] },
    isLoading: false,
    error: null,
  })
  mockTrend.mockReturnValue({
    data: { granularity: 'day', series: [] },
    isLoading: false,
    error: null,
  })
}

function sceneRow(overrides: Partial<LlmSceneSummary> = {}): LlmSceneSummary {
  return {
    scene: 'chat_main',
    tier: 'main',
    calls: 100,
    successRate: 0.9,
    p50LatencyMs: 1200,
    p90LatencyMs: 3500,
    p50FirstTokenMs: 400,
    p90FirstTokenMs: 1200,
    totalTokens: 5000,
    failureBreakdown: [],
    ...overrides,
  }
}

function renderTab(entry = '/llm') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <PerfTab />
    </MemoryRouter>,
  )
}

describe('PerfTab 区间变更', () => {
  it('选择新区间后，按区间取数的子组件收到新的起止日期', async () => {
    const user = userEvent.setup()
    mockOk()
    renderTab()

    await user.click(screen.getByRole('button', { name: 'set-range' }))

    expect(screen.getByTestId('turn-handoff-card').dataset.start).toBe(
      '2026-10-01',
    )
    expect(screen.getByTestId('turn-handoff-card').dataset.end).toBe(
      '2026-10-10',
    )
    expect(mockSummary).toHaveBeenLastCalledWith({
      startDate: '2026-10-01',
      endDate: '2026-10-10',
    })
    expect(mockTrend).toHaveBeenLastCalledWith({
      startDate: '2026-10-01',
      endDate: '2026-10-10',
      granularity: 'day',
    })
  })

  it('清空日期（onChange 收到 null）时保留原区间', async () => {
    const user = userEvent.setup()
    mockOk()
    renderTab()
    const before = screen.getByTestId('turn-handoff-card').dataset.start

    await user.click(screen.getByRole('button', { name: 'clear-range' }))

    expect(screen.getByTestId('turn-handoff-card').dataset.start).toBe(before)
  })
})

describe('PerfTab 成功率告警阈值', () => {
  it('总调用数 < 20 时不评估，避免小样本误报', () => {
    mockOk()
    mockSummary.mockReturnValue({
      data: { scenes: [sceneRow({ calls: 19, successRate: 0.5 })] },
      isLoading: false,
      error: null,
    })
    renderTab()

    expect(screen.queryByText(/区间内调用成功率/)).not.toBeInTheDocument()
  })

  it('成功率 < 95% 给黄色提醒，< 85% 升级为红色告警', () => {
    mockOk()
    mockSummary.mockReturnValue({
      data: { scenes: [sceneRow({ calls: 100, successRate: 0.9 })] },
      isLoading: false,
      error: null,
    })
    const { unmount } = renderTab()
    expect(screen.getByText(/区间内调用成功率 90\.0%/)).toBeInTheDocument()
    expect(screen.getByText(/低于 95%，请关注下方失败明细/)).toBeInTheDocument()

    unmount()
    mockSummary.mockReturnValue({
      data: { scenes: [sceneRow({ calls: 100, successRate: 0.84 })] },
      isLoading: false,
      error: null,
    })
    renderTab()
    expect(
      screen.getByText(/已低于 85%，请立即排查上游模型与网络/),
    ).toBeInTheDocument()
  })

  it('successRate 为 null 的场景按 0 计入加权', () => {
    mockOk()
    mockSummary.mockReturnValue({
      data: {
        scenes: [
          sceneRow({ scene: 'chat_main', calls: 20, successRate: null }),
          sceneRow({ scene: 'filler', calls: 20, successRate: 1 }),
        ],
      },
      isLoading: false,
      error: null,
    })
    renderTab()

    expect(screen.getByText(/区间内调用成功率 50\.0%/)).toBeInTheDocument()
  })

  it('成功率 ≥ 95% 不告警', () => {
    mockOk()
    mockSummary.mockReturnValue({
      data: { scenes: [sceneRow({ successRate: 0.95 })] },
      isLoading: false,
      error: null,
    })
    renderTab()

    expect(screen.queryByText(/区间内调用成功率/)).not.toBeInTheDocument()
  })
})

describe('PerfTab 场景筛选联动 URL', () => {
  it('?scene=chat_main 时趋势查询带场景', () => {
    mockOk()
    renderTab('/llm?scene=chat_main')

    expect(mockTrend).toHaveBeenLastCalledWith(
      expect.objectContaining({ scene: 'chat_main' }),
    )
  })

  it('清除场景后趋势查询不再带 scene', async () => {
    const user = userEvent.setup()
    mockOk()
    renderTab('/llm?scene=chat_main')

    const clearBtn = document.querySelector('.ant-select-clear')
    expect(clearBtn).not.toBeNull()
    await user.click(clearBtn as HTMLElement)

    expect(mockTrend).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ scene: expect.anything() }),
    )
  })

  it('从下拉选场景后 URL 写入 ?scene=，趋势查询同步带上', async () => {
    const user = userEvent.setup()
    mockOk()
    renderTab()

    const placeholder = screen.getByText('全部场景')
    await user.click(placeholder.closest('.ant-select') as HTMLElement)
    await user.click(
      await screen.findByText('主对话回答', {
        selector: '.ant-select-item-option-content',
      }),
    )

    expect(mockTrend).toHaveBeenLastCalledWith(
      expect.objectContaining({ scene: 'chat_main' }),
    )
  })
})

describe('PerfTab 异常兜底', () => {
  it('非 Error 异常降级为「加载失败」，Error 对象展示 message', () => {
    mockSummary.mockReturnValue({ data: null, isLoading: false, error: 'boom' })
    mockTrend.mockReturnValue({ data: null, isLoading: false, error: null })
    const { unmount } = renderTab()

    expect(screen.getByText('模型监控数据加载失败')).toBeInTheDocument()
    expect(screen.getByText('加载失败')).toBeInTheDocument()

    unmount()
    mockSummary.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('perf down'),
    })
    renderTab()
    expect(screen.getByText('perf down')).toBeInTheDocument()
  })
})
