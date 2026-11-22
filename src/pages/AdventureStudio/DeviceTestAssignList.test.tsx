import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import DeviceTestAssignList from './DeviceTestAssignList'
import { useCharacterTestDevices } from '../../api/queries'
import type { CharacterTestDevicesResponse } from '../../types/adventureAdmin'

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

const response: CharacterTestDevicesResponse = {
  enabled: true,
  characterKey: 'elly',
  total: 2,
  devices: [
    {
      deviceId: 'dev-1001',
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
      version: { id: 'draft-1', version: 2, status: 'draft' },
      followsCurrent: false,
      stale: true,
      lastAssignedAt: '2026-11-20T10:00:00.000Z',
    },
    {
      deviceId: 'dev-1002',
      deviceCode: null,
      episode: {
        id: 'ep2',
        businessKey: 'elly/1/2',
        title: '听风原野第二天',
        characterKey: 'elly',
        season: 1,
        episodeNumber: 2,
        retiredAt: '2026-11-21T09:00:00.000Z',
      },
      version: null,
      followsCurrent: true,
      stale: false,
      lastAssignedAt: null,
    },
  ],
}

describe('DeviceTestAssignList', () => {
  it('renders episode, device, pinned version, stale marker and assignment time', () => {
    mockQuery.mockReturnValue(idle({ data: response }))

    render(<DeviceTestAssignList characterKey="elly" />)

    expect(screen.getByText('elly/1/1')).toBeTruthy()
    expect(screen.getByText('听风原野第一天')).toBeTruthy()
    expect(screen.getByText('dev-1001')).toBeTruthy()
    expect(screen.getByText('CN-001')).toBeTruthy()
    expect(screen.getByText('v2')).toBeTruthy()
    expect(screen.getByText('草稿')).toBeTruthy()
    expect(screen.getByText('旧快照')).toBeTruthy()
    expect(screen.getByText(/2026-11-20/)).toBeTruthy()
    expect(screen.getByText('跟随当前发布版')).toBeTruthy()
    expect(screen.getByText('已下架')).toBeTruthy()
    expect(screen.getByText('共 2 台')).toBeTruthy()
  })

  it('shows the empty state when nobody is assigned under the IP', () => {
    mockQuery.mockReturnValue(
      idle({
        data: {
          enabled: true,
          characterKey: 'elly',
          total: 0,
          devices: [],
        },
      }),
    )

    render(<DeviceTestAssignList characterKey="elly" />)

    expect(screen.getByText('这个 IP 下还没有样机被下发测试故事')).toBeTruthy()
  })

  it('does not request anything without a character key', () => {
    mockQuery.mockReturnValue(idle())

    render(<DeviceTestAssignList characterKey={null} />)

    expect(mockQuery).toHaveBeenCalledWith(null, false)
  })

  it('surfaces a load failure without pretending the list is empty', () => {
    mockQuery.mockReturnValue(idle({ error: new Error('boom') }))

    render(<DeviceTestAssignList characterKey="elly" />)

    expect(screen.getByText('样机下发列表加载失败')).toBeTruthy()
    expect(screen.getByText('boom')).toBeTruthy()
  })
})
