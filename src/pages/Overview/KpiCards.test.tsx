import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import KpiCards from './KpiCards'
import { PAGE_LABELS, kpiDefs } from './kpi-defs'
import type { OverviewResponse } from '../../types/analytics'

/**
 * KPI 卡跨页出口契约。
 *
 * 每张卡整卡即出口：外层 <a> 包住卡片，可访问名 =「指标名，前往目标页」，
 * 卡片右上角的箭头只是视觉提示，链接语义不依赖它。
 */

function overview(): OverviewResponse {
  return {
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
}

function renderCards() {
  return render(
    <MemoryRouter initialEntries={['/overview']}>
      <Routes>
        <Route path="/overview" element={<KpiCards data={overview()} />} />
        <Route path="/fleet" element={<div>设备舰队页</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('KpiCards 跨页出口', () => {
  it('每张卡整卡即出口，链接指向语义正确的页面', () => {
    renderCards()
    for (const def of kpiDefs(overview())) {
      const link = screen.getByRole('link', {
        name: `${def.title}，前往${PAGE_LABELS[def.href]}`,
      })
      expect(link).toHaveAttribute('href', def.href)
      expect(link.querySelector('.ant-card')).toBeTruthy()
      expect(link.querySelector('.kpi-card-arrow')).toBeTruthy()
    }
  })

  it('没有卡片以外的散落链接（出口数量 = 卡片数量）', () => {
    renderCards()
    expect(screen.getAllByRole('link')).toHaveLength(kpiDefs(overview()).length)
  })

  it('点击指标说明图标只弹说明，不触发跳转', async () => {
    const user = userEvent.setup()
    const { container } = renderCards()
    const icon = container.querySelector('.anticon-question-circle')
    expect(icon).toBeTruthy()

    await user.click(icon as Element)

    expect(screen.getByText('累计激活设备')).toBeTruthy()
    expect(screen.queryByText('设备舰队页')).toBeNull()
  })

  it('拖选文字后松手不触发跳转', async () => {
    const user = userEvent.setup()
    const selection = vi
      .spyOn(window, 'getSelection')
      .mockReturnValue({ toString: () => '累计激活设备' } as unknown as Selection)
    try {
      renderCards()
      await user.click(screen.getByText('累计激活设备'))
      expect(screen.getByText('累计激活设备')).toBeTruthy()
      expect(screen.queryByText('设备舰队页')).toBeNull()
    } finally {
      selection.mockRestore()
    }
  })
})

describe('KpiCards 附加信息', () => {
  function renderWith(today: Partial<OverviewResponse['today']>) {
    const base = overview()
    render(
      <MemoryRouter>
        <KpiCards data={{ ...base, today: { ...base.today, ...today } }} />
      </MemoryRouter>,
    )
  }

  it('环比为正时绿色加号', () => {
    renderWith({ dauDeltaPct: 5.2 })
    expect(screen.getByText(/环比 \+5\.2%/)).toBeTruthy()
  })

  it('环比为负时带减号', () => {
    renderWith({ dauDeltaPct: -50 })
    expect(screen.getByText(/环比 -50\.0%/)).toBeTruthy()
  })

  it('环比为 null 或 0 时显示持平', () => {
    renderWith({ dauDeltaPct: null })
    expect(screen.getAllByText('环比持平')).toHaveLength(1)
  })

  it('时长卡标注估算口径', () => {
    renderWith({})
    expect(screen.getByText('估算口径')).toBeTruthy()
  })
})
