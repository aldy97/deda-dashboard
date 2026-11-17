import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import SafetyTab from './SafetyTab'
import { useSafetySummary, useSafetyTrend } from '../../../api/queries'
import { fmt, today } from '../../../utils/date-range'
import type {
  SafetySummaryResponse,
  SafetyTrendResponse,
} from '../../../types/analytics'

// 复核队列有独立测试文件，这里替身掉，避免两个测试互相牵连
vi.mock('../ReviewQueueTable', () => ({
  default: () => <div data-testid="review-queue-stub" />,
}))

vi.mock('../../../api/queries', () => ({
  useSafetySummary: vi.fn(),
  useSafetyTrend: vi.fn(),
}))

const mockSummary = useSafetySummary as unknown as ReturnType<typeof vi.fn>
const mockTrend = useSafetyTrend as unknown as ReturnType<typeof vi.fn>

function summary(
  overrides: Partial<SafetySummaryResponse> = {},
): SafetySummaryResponse {
  return {
    total: 1000,
    blockedCount: 20,
    blockRate: 0.02,
    byCategory: [
      { category: 'self_harm', count: 5, blockedCount: 5 },
      { category: 'safe', count: 900, blockedCount: 0 },
      { category: null, count: 12, blockedCount: 0 },
    ],
    byLayer: [
      { layer: 'L1', count: 8 },
      { layer: 'L2', count: 12 },
    ],
    bySource: [
      { source: 'l2_model', count: 960 },
      { source: 'l1_regex', count: 8 },
      { source: 'l2_fail_open', count: 12 },
      { source: 'l2_invalid_label', count: 5 },
      { source: 'not_evaluated', count: 15 },
    ],
    failOpenCount: 12,
    invalidLabelCount: 5,
    notEvaluatedCount: 15,
    emotionalHarmCount: 3,
    reviewableCount: 25,
    ...overrides,
  }
}

const trend: SafetyTrendResponse = {
  granularity: 'day',
  series: [
    {
      date: '2026-11-11',
      total: 500,
      blockedCount: 10,
      blockRate: 0.02,
      failOpenCount: 6,
      invalidLabelCount: 2,
      notEvaluatedCount: 8,
      emotionalHarmCount: 1,
    },
    {
      date: '2026-11-12',
      total: 0,
      blockedCount: 0,
      blockRate: null,
      failOpenCount: 0,
      invalidLabelCount: 0,
      notEvaluatedCount: 0,
      emotionalHarmCount: 0,
    },
  ],
}

function renderTab() {
  return render(
    <MemoryRouter>
      <SafetyTab />
    </MemoryRouter>,
  )
}

function optionOf(index: number) {
  const charts = screen.getAllByTestId('echarts-mock')
  return JSON.parse(charts[index].getAttribute('data-option') ?? 'null')
}

describe('SafetyTab 概览', () => {
  it('渲染八项概览指标，计数与后端一致', () => {
    mockSummary.mockReturnValue({ data: summary(), isLoading: false, error: null })
    mockTrend.mockReturnValue({ data: trend, isLoading: false, error: null })
    renderTab()

    expect(screen.getByText('判定轮次')).toBeInTheDocument()
    expect(screen.getByText('1,000')).toBeInTheDocument()
    expect(screen.getByText('拦截率')).toBeInTheDocument()
    expect(screen.getByText('2.00%')).toBeInTheDocument()
    expect(screen.getByText('未审计放行')).toBeInTheDocument()
    // failOpen 12 + invalidLabel 5 + notEvaluated 15
    expect(screen.getByText('32')).toBeInTheDocument()
    expect(screen.getByText('情绪伤害')).toBeInTheDocument()
    expect(screen.getByText('可复核')).toBeInTheDocument()
  })

  it('blockRate 为 null 时渲染「—」，绝不渲染成 0.00%', () => {
    mockSummary.mockReturnValue({
      data: summary({ total: 0, blockedCount: 0, blockRate: null }),
      isLoading: false,
      error: null,
    })
    mockTrend.mockReturnValue({ data: trend, isLoading: false, error: null })
    renderTab()

    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    expect(screen.queryByText('0.00%')).not.toBeInTheDocument()
  })

  it('页面写明「判定记录数 ≤ 对话轮次数」的口径警示', () => {
    mockSummary.mockReturnValue({ data: summary(), isLoading: false, error: null })
    mockTrend.mockReturnValue({ data: trend, isLoading: false, error: null })
    renderTab()

    expect(screen.getByText(/判定记录数 ≤ 对话轮次数/)).toBeInTheDocument()
  })

  it('存在静默降级时给出 warning 告警，并点明两类成因的条数', () => {
    mockSummary.mockReturnValue({ data: summary(), isLoading: false, error: null })
    mockTrend.mockReturnValue({ data: trend, isLoading: false, error: null })
    renderTab()

    const alert = screen.getByText(/小模型安全分类存在静默降级/)
    expect(alert).toBeInTheDocument()
    expect(alert.textContent).toContain('12')
    expect(alert.textContent).toContain('5')
  })

  it('静默降级为 0 时不制造噪音告警', () => {
    mockSummary.mockReturnValue({
      data: summary({ failOpenCount: 0, invalidLabelCount: 0 }),
      isLoading: false,
      error: null,
    })
    mockTrend.mockReturnValue({ data: trend, isLoading: false, error: null })
    renderTab()

    expect(screen.queryByText(/静默降级：/)).not.toBeInTheDocument()
  })

  it('未评估盲区恒有说明（冒险接管绕过 L2 是设计而非故障）', () => {
    mockSummary.mockReturnValue({ data: summary(), isLoading: false, error: null })
    mockTrend.mockReturnValue({ data: trend, isLoading: false, error: null })
    renderTab()

    expect(screen.getByText(/冒险互动轮次绕过 L2/)).toBeInTheDocument()
  })

  it('接口报错时展示错误 Alert', () => {
    mockSummary.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('boom'),
    })
    mockTrend.mockReturnValue({ data: null, isLoading: false, error: null })
    renderTab()

    expect(screen.getByText('安全判定数据加载失败')).toBeInTheDocument()
    expect(screen.getByText('boom')).toBeInTheDocument()
  })

  it('加载中不渲染概览卡片', () => {
    mockSummary.mockReturnValue({ data: null, isLoading: true, error: null })
    mockTrend.mockReturnValue({ data: null, isLoading: true, error: null })
    renderTab()

    expect(screen.queryByText('安全判定概览')).not.toBeInTheDocument()
  })
})

describe('SafetyTab 分桶图表', () => {
  it('第一张图按 safetySource 分桶（纪律：不能按 category 分桶）', () => {
    mockSummary.mockReturnValue({ data: summary(), isLoading: false, error: null })
    mockTrend.mockReturnValue({ data: trend, isLoading: false, error: null })
    renderTab()

    const option = optionOf(0)
    const axis = JSON.stringify(option.xAxis)
    expect(axis).toContain('L2 小模型判定')
    expect(axis).toContain('L1 正则命中')
    expect(axis).toContain('L2 调用异常放行')
    expect(axis).toContain('未做 L2（冒险接管）')
    // 来源图里不应出现类别名，证明没有按 category 分桶
    expect(axis).not.toContain('自伤')
  })

  it('第二张图按 category 分桶，null 显示「未能判定」且与 safe 分开', () => {
    mockSummary.mockReturnValue({ data: summary(), isLoading: false, error: null })
    mockTrend.mockReturnValue({ data: trend, isLoading: false, error: null })
    renderTab()

    const option = optionOf(1)
    const axis = JSON.stringify(option.xAxis)
    expect(axis).toContain('自伤')
    expect(axis).toContain('安全')
    expect(axis).toContain('未能判定')
    // 后端已按严重度排序，前端不得重排
    const categories = option.xAxis.data as string[]
    expect(categories).toEqual(['自伤', '安全', '未能判定'])
  })

  it('趋势图渲染拦截率与三类未审计放行，null 比率留空不补零', () => {
    mockSummary.mockReturnValue({ data: summary(), isLoading: false, error: null })
    mockTrend.mockReturnValue({ data: trend, isLoading: false, error: null })
    renderTab()

    const option = optionOf(2)
    const names = (option.series as Array<{ name: string }>).map((s) => s.name)
    expect(names).toContain('判定轮次')
    expect(names).toContain('拦截率')
    expect(names).toContain('调用异常放行')
    expect(names).toContain('非法标签放行')
    expect(names).toContain('未做 L2')

    const rateSeries = (
      option.series as Array<{ name: string; data: Array<number | null> }>
    ).find((s) => s.name === '拦截率')
    // 第二个桶 total=0 → blockRate=null，必须留 null（补 0 会画成「拦截率跌到 0」）
    expect(rateSeries?.data).toEqual([2, null])
  })

  it('趋势无数据时给空态而不是空图', () => {
    mockSummary.mockReturnValue({ data: summary(), isLoading: false, error: null })
    mockTrend.mockReturnValue({
      data: { granularity: 'day', series: [] },
      isLoading: false,
      error: null,
    })
    renderTab()

    expect(screen.getByText('所选区间暂无判定记录')).toBeInTheDocument()
  })
})

function openPicker(container: HTMLElement): HTMLElement {
  const picker = container.querySelector('.ant-picker')
  if (picker === null) throw new Error('未渲染日期区间控件')
  return picker as HTMLElement
}

describe('SafetyTab 查询参数', () => {
  it('切换统计粒度只影响趋势接口，概览不接受 granularity', async () => {
    const user = userEvent.setup()
    mockSummary.mockReturnValue({ data: summary(), isLoading: false, error: null })
    mockTrend.mockReturnValue({ data: trend, isLoading: false, error: null })
    renderTab()

    await user.click(screen.getByRole('combobox', { name: '统计粒度' }))
    await user.click(
      await screen.findByText('按月', {
        selector: '.ant-select-item-option-content',
      }),
    )

    expect(mockTrend).toHaveBeenLastCalledWith(
      expect.objectContaining({ granularity: 'month' }),
    )
    expect(mockSummary).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ granularity: expect.anything() }),
    )
  })

  it('改日期区间后概览与趋势都换成新的闭区间', async () => {
    const user = userEvent.setup()
    mockSummary.mockReturnValue({ data: summary(), isLoading: false, error: null })
    mockTrend.mockReturnValue({ data: trend, isLoading: false, error: null })
    const { container } = renderTab()

    // 默认区间是近 7 天，选「今日」预设后闭区间应收敛成同一天
    await user.click(openPicker(container))
    await user.click(await screen.findByText('今日'))

    const expected = fmt(today())
    expect(mockSummary).toHaveBeenLastCalledWith({
      startDate: expected,
      endDate: expected,
    })
    expect(mockTrend).toHaveBeenLastCalledWith(
      expect.objectContaining({ startDate: expected, endDate: expected }),
    )
  })
})
