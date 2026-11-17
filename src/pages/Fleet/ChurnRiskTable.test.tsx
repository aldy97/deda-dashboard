import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import ChurnRiskTable from './ChurnRiskTable'
import type { FleetChurnRiskResponse } from '../../types/analytics'

/**
 * 流失风险表的下钻链接契约。
 *
 * 设备 ID 列是到 /users/:deviceId 的 Link；操作列有「详情」按钮，
 * 点击时触发 onOpenDevice 回调（写 ?deviceId= 打开抽屉）。
 */
function makeData(overrides: Partial<FleetChurnRiskResponse> = {}): FleetChurnRiskResponse {
  return {
    days: 7,
    asOf: '2026-11-14',
    count: 3,
    devices: [
      {
        deviceId: 'abc123',
        characterKey: 'elly',
        firmwareVersion: '1.0.0',
        lastActiveAt: '2026-11-01T00:00:00.000Z',
        daysInactive: 30,
        basis: 'presence',
      },
      {
        deviceId: 'def456',
        characterKey: 'xiaoma',
        firmwareVersion: null,
        lastActiveAt: null,
        daysInactive: 13,
        basis: 'createdAt',
      },
    ],
    ...overrides,
  }
}

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="search">{location.search}</div>
}

function renderTable(data: FleetChurnRiskResponse, onOpenDevice = vi.fn()) {
  return render(
    <MemoryRouter initialEntries={['/fleet']}>
      <ChurnRiskTable data={data} days={7} onDaysChange={vi.fn()} onOpenDevice={onOpenDevice} />
      <LocationProbe />
    </MemoryRouter>,
  )
}

describe('ChurnRiskTable · 下钻链接', () => {
  it('设备 ID 列是到 /users/:deviceId 的 Link', () => {
    const data = makeData()
    renderTable(data)
    const link = screen.getByText('abc123').closest('a')
    expect(link).toBeTruthy()
    expect(link!.getAttribute('href')).toBe('/users/abc123')
  })

  it('第二行设备 ID 也正确链接', () => {
    const data = makeData()
    renderTable(data)
    const link = screen.getByText('def456').closest('a')
    expect(link).toBeTruthy()
    expect(link!.getAttribute('href')).toBe('/users/def456')
  })

  it('操作列"详情"按钮存在且触发 onOpenDevice', () => {
    const data = makeData()
    const onOpenDevice = vi.fn()
    renderTable(data, onOpenDevice)

    // 第一行有"详情"操作
    const detailLinks = screen.getAllByText('详情')
    expect(detailLinks.length).toBeGreaterThanOrEqual(1)

    fireEvent.click(detailLinks[0])
    expect(onOpenDevice).toHaveBeenCalledWith('abc123')
  })
})
