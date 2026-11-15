import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import FunnelChart from './FunnelChart'
import type { OverviewResponse } from '../../types/analytics'

/**
 * 激活漏斗的跨页出口契约。
 *
 * 漏斗只有累计三级（出货一期恒 null），看到「7 日留存」掉下去的人下一步一定是去
 * 留存页查 cohort，所以出口固定指向 /retention。
 */

const FUNNEL: OverviewResponse['funnel'] = {
  shipped: null,
  activated: 800,
  firstConversation: 750,
  active7d: 400,
}

function renderChart(funnel: OverviewResponse['funnel'] = FUNNEL) {
  return render(
    <MemoryRouter>
      <FunnelChart funnel={funnel} />
    </MemoryRouter>,
  )
}

describe('FunnelChart · 跨页出口', () => {
  it('卡片右上角是到 /retention 的链接', () => {
    renderChart()
    const link = screen.getByRole('link', { name: /留存与激活/ })
    expect(link.getAttribute('href')).toBe('/retention')
  })

  it('shipped 为 null 时该级不进图，只画有值的三级', () => {
    renderChart()
    // echarts 替身把 option 挂在 data-option 上（见 src/test/setup.tsx）
    const chart = screen.getByTestId('echarts-mock')
    const option = JSON.parse(chart.getAttribute('data-option') ?? '{}')
    const names: string[] = (option.series?.[0]?.data ?? []).map(
      (d: { name?: string }) => d?.name ?? '',
    )
    expect(names).not.toContain('出货')
    expect(names).toContain('绑定激活')
    expect(names).toContain('首次对话')
    expect(names).toContain('7 日留存')
  })
})
