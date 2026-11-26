import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CostDailyTable from './CostDailyTable'
import type {
  LlmCostReconciliation,
  LlmCostResponse,
  LlmCostSeriesItem,
} from '../../types/analytics'

function point(overrides: Partial<LlmCostSeriesItem> = {}): LlmCostSeriesItem {
  return {
    date: '2026-11-20',
    smallCny: 0.1,
    mainCny: 0.2,
    otherCny: 0,
    totalCny: 0.3,
    smallTokens: 1000,
    mainTokens: 2000,
    smallCnyPerMillionTokens: 100,
    mainCnyPerMillionTokens: 100,
    smallSource: 'bill',
    mainSource: 'estimated',
    mainAccuracy: 'exact',
    settled: true,
    ...overrides,
  }
}

function data(overrides: {
  series?: LlmCostSeriesItem[]
  reconciliation?: LlmCostReconciliation
  unpricedRows?: number
  unpricedTokens?: number
  noTokenRows?: number
} = {}): LlmCostResponse {
  return {
    currency: 'CNY',
    pricing: { version: '2026-11', peakNote: '', lines: [] },
    range: {
      startDate: '2026-11-01',
      endDate: '2026-11-20',
      requestedStartDate: '2026-11-01',
      requestedEndDate: '2026-11-20',
      clamped: false,
      days: 20,
    },
    sources: {
      aliyun: {
        status: 'ok',
        kind: 'bill',
        latestBillDate: '2026-11-20',
        latestFetchedAt: null,
        modelSplit: true,
        daysWithData: 20,
        message: null,
      },
      deepseek: {
        status: 'ok',
        kind: 'estimated',
        pricingVersion: '2026-11',
        rows: 1,
        pricedRows: 1,
        cacheHitRows: 0,
        upperBoundRows: 0,
        cacheTokenAvailable: true,
      },
    },
    series: overrides.series ?? [point()],
    totals: {
      smallCny: 0.1,
      mainCny: 0.2,
      otherCny: 0,
      totalCny: 0.3,
      partial: false,
      days: 20,
      unpricedRows: overrides.unpricedRows ?? 0,
      noTokenRows: overrides.noTokenRows ?? 0,
      unpricedTokens: overrides.unpricedTokens ?? 0,
    },
    month: {
      cycle: '2026-11',
      daysInCycle: 30,
      daysWithData: 20,
      toDateCny: 0.3,
      toDateSmallCny: 0.1,
      toDateMainCny: 0.2,
      projectedEndCny: 0.5,
      prevSamePeriodCny: null,
      deltaPct: null,
      partial: false,
    },
    unitEconomics: [],
    reconciliation: overrides.reconciliation ?? {
      status: 'insufficient',
      days: 0,
      smallEstimatedCny: 0,
      smallBilledCny: 0,
      deltaPct: null,
    },
  }
}

describe('CostDailyTable 对账条', () => {
  it('尚无终账账单日时说明暂无法对账', () => {
    render(<CostDailyTable data={data()} />)

    expect(
      screen.getByText('尚无已终账账单日（终账在次月 3 日 12 点后），暂无法对账'),
    ).toBeInTheDocument()
  })

  it('账单真值为 0 时给出「无法计算偏差」而不是 ±100%', () => {
    render(
      <CostDailyTable
        data={data({
          reconciliation: {
            status: 'ok',
            days: 10,
            smallEstimatedCny: 12.5,
            smallBilledCny: 0,
            deltaPct: null,
          },
        })}
      />,
    )

    expect(screen.getByText(/小模型估算 ¥12\.50 vs 账单真值/)).toBeInTheDocument()
    expect(screen.getByText('账单真值为 0，无法计算偏差')).toBeInTheDocument()
  })

  it('偏差在 ±15% 以内只显示数值，不告警', () => {
    render(
      <CostDailyTable
        data={data({
          reconciliation: {
            status: 'ok',
            days: 10,
            smallEstimatedCny: 10,
            smallBilledCny: 9,
            deltaPct: -3.2,
          },
        })}
      />,
    )

    expect(screen.getByText(/偏差 -3\.2%/)).toBeInTheDocument()
    expect(screen.queryByText(/偏差超过 ±15%/)).not.toBeInTheDocument()
  })

  it('偏差超过 15% 时给出排查建议 Alert', () => {
    render(
      <CostDailyTable
        data={data({
          reconciliation: {
            status: 'ok',
            days: 10,
            smallEstimatedCny: 10,
            smallBilledCny: 20,
            deltaPct: 100,
          },
        })}
      />,
    )

    expect(screen.getByText(/偏差 \+100\.0%/)).toBeInTheDocument()
    expect(screen.getByText(/偏差超过 ±15%/)).toBeInTheDocument()
  })
})

describe('CostDailyTable 表格内容', () => {
  it('金额按 formatCny 渲染，缺值显示「—」', () => {
    render(
      <CostDailyTable
        data={data({
          series: [
            point({
              date: '2026-11-20',
              smallCny: 1,
              mainCny: 0.5,
              otherCny: null,
              totalCny: 1.5,
            }),
          ],
        })}
      />,
    )

    expect(screen.getByText('¥1.00')).toBeInTheDocument()
    expect(screen.getByText('¥0.5000')).toBeInTheDocument()
    expect(screen.getByText('¥1.50')).toBeInTheDocument()
    // otherCny=null 渲染「—」
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('来源 Tag 区分账单/估算与无数据源', () => {
    render(
      <CostDailyTable
        data={data({
          series: [
            point({ date: '2026-11-20' }),
            point({
              date: '2026-11-19',
              smallSource: 'none',
              mainSource: 'none',
            }),
          ],
        })}
      />,
    )

    expect(screen.getAllByText('账单')).toHaveLength(1)
    expect(screen.getAllByText('估算')).toHaveLength(1)
    // 第二行两个来源都是「—」
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2)
  })

  it('终账状态三种取值：已终账 / 暂估 / —', () => {
    render(
      <CostDailyTable
        data={data({
          series: [
            point({ date: '2026-11-20', settled: true }),
            point({ date: '2026-11-19', settled: false }),
            point({ date: '2026-11-18', settled: null }),
          ],
        })}
      />,
    )

    expect(screen.getByText('已终账')).toBeInTheDocument()
    expect(screen.getByText('暂估')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('合计缺源的日期打星号，并在表尾用文字说明缺失天数', () => {
    render(
      <CostDailyTable
        data={data({
          series: [
            point({ date: '2026-11-20', settled: true }),
            point({ date: '2026-11-19', smallCny: null }),
            point({ date: '2026-11-18', totalCny: null }),
          ],
        })}
      />,
    )

    // 只有小模型缺源的那一天带 *
    expect(screen.getAllByText('*')).toHaveLength(1)
    expect(screen.getByText(/\* 1 天合计不完整/)).toBeInTheDocument()
  })

  it('表尾列出未计价与无 token 行数', () => {
    render(
      <CostDailyTable
        data={data({ unpricedRows: 2, unpricedTokens: 1234, noTokenRows: 3 })}
      />,
    )

    const footer = document.querySelector('.ant-table-footer')
    expect(footer).not.toBeNull()
    expect(footer!.textContent).toContain('未计价 2 行')
    expect(footer!.textContent).toContain('无 token 3 行')
    // 千分位随运行环境 locale 变化，兼容 1,234 / 1234
    expect(footer!.textContent).toMatch(/1[,.]?234/)
  })

  it('没有缺源、未计价与无 token 行时不渲染表尾说明', () => {
    render(<CostDailyTable data={data()} />)

    expect(document.querySelector('.ant-table-footer')).toBeNull()
  })

  it('金额列可排序：点击表头触发升/降序不抛异常', async () => {
    const user = userEvent.setup()
    render(
      <CostDailyTable
        data={data({
          series: [
            point({ date: '2026-11-20', smallCny: 0.2, mainCny: 0.2 }),
            point({ date: '2026-11-19', smallCny: 0.1, mainCny: 0.1 }),
            // 全空行：排序器的 (x ?? 0) 兜底分支
            point({
              date: '2026-11-18',
              smallCny: null,
              mainCny: null,
              otherCny: null,
              totalCny: null,
            }),
          ],
        })}
      />,
    )

    for (const title of ['小模型 ¥', '主模型 ¥', '其他 ¥', '合计 ¥', '日期']) {
      const header = screen.getAllByText(title)[0].closest('th')
      expect(header).not.toBeNull()
      // 升序与降序各点一次：排序器两个比较参数都会走到
      await user.click(header!)
      await user.click(header!)
    }

    expect(screen.getByText('2026-11-20')).toBeInTheDocument()
    expect(screen.getByText('2026-11-19')).toBeInTheDocument()
    expect(screen.getByText('2026-11-18')).toBeInTheDocument()
  })
})
