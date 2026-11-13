import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import IntentTab from './IntentTab'
import { useIntentSummary, useIntentTrend } from '../../../api/queries'
import { fmt, today } from '../../../utils/date-range'
import type {
  IntentSummaryResponse,
  IntentTrendResponse,
} from '../../../types/analytics'

vi.mock('../../../api/queries', () => ({
  useIntentSummary: vi.fn(),
  useIntentTrend: vi.fn(),
}))

const mockSummary = useIntentSummary as unknown as ReturnType<typeof vi.fn>
const mockTrend = useIntentTrend as unknown as ReturnType<typeof vi.fn>

/**
 * 自洽的样例数据：total 1000 = 未走路由 170（not_routed 100 + adventure_takeover 60
 * + no_device 10）+ model 300 + rule 510（pre_filter_skip 500 + continuation 10）
 * + fallback 20。intent 分布 free_chat 730 / sleep_story 100 / null 170。
 */
const summary: IntentSummaryResponse = {
  total: 1000,
  byIntent: [
    { intent: 'free_chat', count: 730 },
    { intent: null, count: 170 },
    { intent: 'sleep_story', count: 100 },
  ],
  bySource: [
    { source: 'pre_filter_skip', count: 500 },
    { source: 'model', count: 300 },
    { source: 'not_routed', count: 100 },
    { source: 'adventure_takeover', count: 60 },
    { source: 'fallback_error', count: 20 },
    { source: 'continuation', count: 10 },
    { source: 'no_device', count: 10 },
  ],
  modelInvokedCount: 300,
  modelInvokedRate: 0.3,
  fallbackCount: 20,
  fallbackRate: 0.02,
  notRoutedCount: 100,
  adventureTakeoverCount: 60,
  matrix: [
    { intent: 'free_chat', source: 'pre_filter_skip', count: 500 },
    { intent: 'free_chat', source: 'model', count: 200 },
    { intent: 'free_chat', source: 'fallback_error', count: 20 },
    { intent: 'free_chat', source: 'continuation', count: 10 },
    { intent: 'sleep_story', source: 'model', count: 100 },
    { intent: null, source: 'not_routed', count: 100 },
    { intent: null, source: 'adventure_takeover', count: 60 },
    { intent: null, source: 'no_device', count: 10 },
  ],
}

const trend: IntentTrendResponse = {
  granularity: 'day',
  series: [
    {
      date: '2026-11-11',
      total: 600,
      modelInvoked: 200,
      fallbackCount: 12,
      byIntent: [{ intent: 'free_chat', count: 600 }],
    },
    {
      date: '2026-11-12',
      total: 400,
      modelInvoked: 100,
      fallbackCount: 8,
      byIntent: [{ intent: 'free_chat', count: 400 }],
    },
  ],
}

function renderTab() {
  return render(
    <MemoryRouter>
      <IntentTab />
    </MemoryRouter>,
  )
}

function optionOf(index: number) {
  const charts = screen.getAllByTestId('echarts-mock')
  return JSON.parse(charts[index].getAttribute('data-option') ?? 'null')
}

describe('IntentTab 概览', () => {
  it('概览给出判定轮次与三类未走路由的计数', () => {
    mockSummary.mockReturnValue({ data: summary, isLoading: false, error: null })
    mockTrend.mockReturnValue({ data: trend, isLoading: false, error: null })
    renderTab()

    expect(screen.getByText('判定轮次')).toBeInTheDocument()
    expect(screen.getByText('1,000')).toBeInTheDocument()
    expect(screen.getByText('未路由·被拦截')).toBeInTheDocument()
    // 「冒险接管」「匿名链路」同时是概览指标名与交叉表列名，故用 getAllByText
    expect(screen.getAllByText('冒险接管').length).toBeGreaterThan(1)
    expect(screen.getAllByText('匿名链路').length).toBeGreaterThan(1)
  })

  it('模型判定率与兜底率由决策路径承载，rate 为 null 时渲染「—」而不是 0.00%', () => {
    mockSummary.mockReturnValue({
      data: { ...summary, total: 0, modelInvokedRate: null, fallbackRate: null },
      isLoading: false,
      error: null,
    })
    mockTrend.mockReturnValue({ data: trend, isLoading: false, error: null })
    renderTab()

    expect(screen.getByTestId('intent-stage-rate-model').textContent).toBe('—')
    expect(screen.getByTestId('intent-stage-rate-fallback').textContent).toBe('—')
    expect(screen.queryByText('0.00%')).not.toBeInTheDocument()
  })

  it('模型判定率与兜底率在健康数据下按两位小数呈现', () => {
    mockSummary.mockReturnValue({ data: summary, isLoading: false, error: null })
    mockTrend.mockReturnValue({ data: trend, isLoading: false, error: null })
    renderTab()

    expect(screen.getByTestId('intent-stage-rate-model').textContent).toBe('30.00%')
    expect(screen.getByTestId('intent-stage-rate-fallback').textContent).toBe('2.00%')
  })

  it('出现关键词兜底时告警', () => {
    mockSummary.mockReturnValue({ data: summary, isLoading: false, error: null })
    mockTrend.mockReturnValue({ data: trend, isLoading: false, error: null })
    renderTab()

    expect(screen.getByText(/意图分类存在关键词兜底/)).toBeInTheDocument()
  })

  it('兜底为 0 时不制造噪音告警', () => {
    mockSummary.mockReturnValue({
      data: { ...summary, fallbackCount: 0 },
      isLoading: false,
      error: null,
    })
    mockTrend.mockReturnValue({ data: trend, isLoading: false, error: null })
    renderTab()

    expect(screen.queryByText(/意图分类存在关键词兜底/)).not.toBeInTheDocument()
  })

  it('接口报错时展示错误 Alert', () => {
    mockSummary.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('intent down'),
    })
    mockTrend.mockReturnValue({ data: null, isLoading: false, error: null })
    renderTab()

    expect(screen.getByText('意图判定数据加载失败')).toBeInTheDocument()
    expect(screen.getByText('intent down')).toBeInTheDocument()
  })
})

describe('IntentTab 决策路径', () => {
  it('四层路径的计数满足 routed = model + rule + fallback', () => {
    mockSummary.mockReturnValue({ data: summary, isLoading: false, error: null })
    mockTrend.mockReturnValue({ data: trend, isLoading: false, error: null })
    renderTab()

    // 交叉表单元格里也有 20（free_chat × fallback_error），故按 stage 容器定位
    const counts = Object.fromEntries(
      (['routed', 'model', 'rule', 'fallback'] as const).map((key) => [
        key,
        Number(
          screen.getByTestId(`intent-stage-count-${key}`).textContent?.replaceAll(',', ''),
        ),
      ]),
    )
    expect(counts).toEqual({ routed: 830, model: 300, rule: 510, fallback: 20 })
    expect(counts.routed).toBe(counts.model + counts.rule + counts.fallback)

    expect(screen.getByText('进入意图路由')).toBeInTheDocument()
    expect(screen.getByText('小模型给出结论')).toBeInTheDocument()
    expect(screen.getByText('规则/会话接管')).toBeInTheDocument()
    expect(screen.getByText('关键词兜底')).toBeInTheDocument()
    expect(screen.getByTestId('intent-stage-rate-routed').textContent).toBe('83.00%')
  })

  it('每层都写明业务含义，供运营自行判读', () => {
    mockSummary.mockReturnValue({ data: summary, isLoading: false, error: null })
    mockTrend.mockReturnValue({ data: trend, isLoading: false, error: null })
    renderTab()

    expect(screen.getByTestId('intent-stage-desc-rule').textContent).toContain(
      '正则未命中直接闲聊',
    )
    expect(screen.getByTestId('intent-stage-desc-model').textContent).toContain(
      '小模型在失效',
    )
  })

  it('total 层不在漏斗里重复渲染（概览已有判定轮次），但其口径说明保留在页面', () => {
    mockSummary.mockReturnValue({ data: summary, isLoading: false, error: null })
    mockTrend.mockReturnValue({ data: trend, isLoading: false, error: null })
    renderTab()

    expect(screen.queryByTestId('intent-stage-count-total')).not.toBeInTheDocument()
    expect(screen.getByText(/判定记录数 ≤ 对话轮次数/)).toBeInTheDocument()
  })
})

describe('IntentTab 分布与交叉表', () => {
  it('第一张图按意图分桶，null 显示「未走到路由」', () => {
    mockSummary.mockReturnValue({ data: summary, isLoading: false, error: null })
    mockTrend.mockReturnValue({ data: trend, isLoading: false, error: null })
    renderTab()

    const axis = JSON.stringify(optionOf(0).xAxis)
    expect(axis).toContain('自由聊天')
    expect(axis).toContain('哄睡故事')
    expect(axis).toContain('未走到路由')
  })

  it('第二张图按来源分桶，用中文名而非原始 key', () => {
    mockSummary.mockReturnValue({ data: summary, isLoading: false, error: null })
    mockTrend.mockReturnValue({ data: trend, isLoading: false, error: null })
    renderTab()

    const axis = JSON.stringify(optionOf(1).xAxis)
    expect(axis).toContain('正则未命中·直接闲聊')
    expect(axis).toContain('小模型判定')
    expect(axis).toContain('未路由·被安全拦截')
    expect(axis).not.toContain('pre_filter_skip')
  })

  it('交叉表行列按计数倒序，缺组合渲染「—」', () => {
    mockSummary.mockReturnValue({ data: summary, isLoading: false, error: null })
    mockTrend.mockReturnValue({ data: trend, isLoading: false, error: null })
    renderTab()

    // 行首列是意图
    expect(screen.getByText('自由聊天')).toBeInTheDocument()
    expect(screen.getByText('730')).toBeInTheDocument()
    // free_chat × model = 200
    expect(screen.getByText('200')).toBeInTheDocument()
    // sleep_story 行只有 model 有值，其余全为 —
    expect(screen.getAllByText('—').length).toBeGreaterThan(10)
  })

  it('趋势图给出总数、模型判定数与兜底数三条序列', () => {
    mockSummary.mockReturnValue({ data: summary, isLoading: false, error: null })
    mockTrend.mockReturnValue({ data: trend, isLoading: false, error: null })
    renderTab()

    const option = optionOf(2)
    const names = (option.series as Array<{ name: string }>).map((s) => s.name)
    expect(names).toEqual(['判定轮次', '小模型判定', '关键词兜底'])
    const fallback = (
      option.series as Array<{ name: string; data: number[] }>
    ).find((s) => s.name === '关键词兜底')
    expect(fallback?.data).toEqual([12, 8])
  })

  it('趋势无数据时给空态', () => {
    mockSummary.mockReturnValue({ data: summary, isLoading: false, error: null })
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

describe('IntentTab 查询参数', () => {
  it('切换统计粒度只影响趋势接口，概览不接受 granularity', async () => {
    const user = userEvent.setup()
    mockSummary.mockReturnValue({ data: summary, isLoading: false, error: null })
    mockTrend.mockReturnValue({ data: trend, isLoading: false, error: null })
    renderTab()

    await user.click(screen.getByRole('combobox', { name: '统计粒度' }))
    await user.click(
      await screen.findByText('按周', {
        selector: '.ant-select-item-option-content',
      }),
    )

    expect(mockTrend).toHaveBeenLastCalledWith(
      expect.objectContaining({ granularity: 'week' }),
    )
    expect(mockSummary).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ granularity: expect.anything() }),
    )
  })

  it('改日期区间后概览与趋势都换成新的闭区间', async () => {
    const user = userEvent.setup()
    mockSummary.mockReturnValue({ data: summary, isLoading: false, error: null })
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
