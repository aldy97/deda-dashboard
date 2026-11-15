import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import KpiCards from './KpiCards'
import type { OverviewResponse } from '../../types/analytics'

/**
 * KPI 卡跨页出口契约。
 *
 * 每张 KPI 卡都至少有一条出口链接，指向语义正确的内部页面。
 * 断言按卡片标题定位，不写死卡片顺序。
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

describe('KpiCards 跨页出口', () => {
  it('累计激活设备 → /fleet', () => {
    render(
      <MemoryRouter>
        <KpiCards data={overview()} />
      </MemoryRouter>,
    )
    const card = screen.getByText('累计激活设备').closest('.ant-card')
    expect(card).toBeTruthy()
    const link = card!.querySelector('a[href="/fleet"]')
    expect(link).toBeTruthy()
  })

  it('激活率 → /fleet', () => {
    render(
      <MemoryRouter>
        <KpiCards data={overview()} />
      </MemoryRouter>,
    )
    // 激活率标题包含 InfoTip，用正则找
    const card = screen.getByText(/激活率/).closest('.ant-card')
    expect(card).toBeTruthy()
    const link = card!.querySelector('a[href="/fleet"]')
    expect(link).toBeTruthy()
  })

  it('累计家长用户 → /users', () => {
    render(
      <MemoryRouter>
        <KpiCards data={overview()} />
      </MemoryRouter>,
    )
    const card = screen.getByText('累计家长用户').closest('.ant-card')
    expect(card).toBeTruthy()
    const link = card!.querySelector('a[href="/users"]')
    expect(link).toBeTruthy()
  })

  it('活跃设备（当日）→ /engagement', () => {
    render(
      <MemoryRouter>
        <KpiCards data={overview()} />
      </MemoryRouter>,
    )
    const card = screen.getByText('活跃设备（当日）').closest('.ant-card')
    expect(card).toBeTruthy()
    const link = card!.querySelector('a[href="/engagement"]')
    expect(link).toBeTruthy()
  })

  it('活跃设备日均使用时长 → /engagement', () => {
    render(
      <MemoryRouter>
        <KpiCards data={overview()} />
      </MemoryRouter>,
    )
    const card = screen.getByText(/日均使用时长/).closest('.ant-card')
    expect(card).toBeTruthy()
    const link = card!.querySelector('a[href="/engagement"]')
    expect(link).toBeTruthy()
  })

  it('人均对话轮次 → /engagement', () => {
    render(
      <MemoryRouter>
        <KpiCards data={overview()} />
      </MemoryRouter>,
    )
    const card = screen.getByText('人均对话轮次').closest('.ant-card')
    expect(card).toBeTruthy()
    const link = card!.querySelector('a[href="/engagement"]')
    expect(link).toBeTruthy()
  })

  it('7 日留存 → /retention', () => {
    render(
      <MemoryRouter>
        <KpiCards data={overview()} />
      </MemoryRouter>,
    )
    const card = screen.getByText(/7 日留存/).closest('.ant-card')
    expect(card).toBeTruthy()
    const link = card!.querySelector('a[href="/retention"]')
    expect(link).toBeTruthy()
  })

  it('实时在线 → /fleet', () => {
    render(
      <MemoryRouter>
        <KpiCards data={overview()} />
      </MemoryRouter>,
    )
    const card = screen.getByText('实时在线').closest('.ant-card')
    expect(card).toBeTruthy()
    const link = card!.querySelector('a[href="/fleet"]')
    expect(link).toBeTruthy()
  })

  it('当日开机 → /fleet', () => {
    render(
      <MemoryRouter>
        <KpiCards data={overview()} />
      </MemoryRouter>,
    )
    const card = screen.getByText('当日开机').closest('.ant-card')
    expect(card).toBeTruthy()
    const link = card!.querySelector('a[href="/fleet"]')
    expect(link).toBeTruthy()
  })

  it('开机率 → /fleet', () => {
    render(
      <MemoryRouter>
        <KpiCards data={overview()} />
      </MemoryRouter>,
    )
    const card = screen.getByText(/开机率/).closest('.ant-card')
    expect(card).toBeTruthy()
    const link = card!.querySelector('a[href="/fleet"]')
    expect(link).toBeTruthy()
  })
})
