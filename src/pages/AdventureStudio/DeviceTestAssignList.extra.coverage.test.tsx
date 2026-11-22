import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import DeviceTestAssignList from './DeviceTestAssignList'
import { useCharacterTestDevices } from '../../api/queries'
import type { CharacterTestDevicesResponse } from '../../types/adventureAdmin'

/**
 * DeviceTestAssignList.test.tsx 已覆盖行渲染、空态、无 IP、失败提示；
 * 这里补它没碰到的三条：截断提示、加载态、刷新按钮。
 */
vi.mock('../../api/queries', () => ({
  useCharacterTestDevices: vi.fn(),
}))

const mockQuery = useCharacterTestDevices as unknown as ReturnType<typeof vi.fn>

function idle(overrides: Record<string, unknown> = {}) {
  return {
    data: undefined,
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  }
}

const truncated: CharacterTestDevicesResponse = {
  enabled: true,
  characterKey: 'elly',
  total: 5,
  devices: [
    {
      deviceId: 'dev-1',
      deviceCode: 'CN-001',
      episode: {
        id: 'ep1',
        businessKey: 'elly/1/1',
        title: '听风原野第一天',
        characterKey: 'elly',
        season: 1,
        episodeNumber: 1,
        retiredAt: null,
      },
      version: { id: 'v1', version: 3, status: 'superseded' },
      followsCurrent: false,
      stale: false,
      lastAssignedAt: '2026-11-20T10:00:00.000Z',
    },
    {
      deviceId: 'dev-2',
      deviceCode: null,
      episode: {
        id: 'ep2',
        businessKey: 'elly/1/2',
        title: '',
        characterKey: 'elly',
        season: 1,
        episodeNumber: 2,
        retiredAt: null,
      },
      version: null,
      followsCurrent: true,
      stale: false,
      lastAssignedAt: null,
    },
  ],
}

describe('DeviceTestAssignList · 剩余分支', () => {
  it('服务端返回的总数大于本次返回行数时，说明只显示前几台', () => {
    mockQuery.mockReturnValue(idle({ data: truncated }))

    render(<DeviceTestAssignList characterKey="elly" />)

    expect(screen.getByText('仅显示前 2 台，共 5 台。')).toBeInTheDocument()
    expect(screen.getByText('共 5 台')).toBeInTheDocument()
    expect(screen.getByText('历史版本')).toBeInTheDocument()
    expect(screen.getByText('（未填标题）')).toBeInTheDocument()
    expect(screen.getByText('未登记设备编码')).toBeInTheDocument()
  })

  it('加载中时表格转圈，且不谎报「共 0 台」', () => {
    mockQuery.mockReturnValue(idle({ isLoading: true, isFetching: true }))

    render(<DeviceTestAssignList characterKey="elly" />)

    expect(document.querySelector('.ant-spin-spinning')).not.toBeNull()
    expect(screen.queryByText(/共 \d+ 台/)).not.toBeInTheDocument()
  })

  it('点「刷新」触发 refetch，不清空当前行', () => {
    const refetch = vi.fn()
    mockQuery.mockReturnValue(idle({ data: truncated, refetch }))

    render(<DeviceTestAssignList characterKey="elly" />)
    fireEvent.click(screen.getByRole('button', { name: /刷\s*新/ }))

    expect(refetch).toHaveBeenCalledTimes(1)
    expect(screen.getByText('dev-1')).toBeInTheDocument()
  })

  it('有数据但未截断时不出现截断提示', () => {
    mockQuery.mockReturnValue(
      idle({ data: { ...truncated, total: 2 } }),
    )

    render(<DeviceTestAssignList characterKey="elly" />)

    expect(screen.queryByText(/仅显示前/)).not.toBeInTheDocument()
  })
})
