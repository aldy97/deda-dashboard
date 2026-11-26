import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import DeviceTestAssignList from './DeviceTestAssignList'
import {
  useAssignTestStory,
  useCharacterTestDevices,
  useClearTestStory,
} from '../../api/queries'
import type { CharacterTestDevicesResponse } from '../../types/adventureAdmin'
import { stubClipboard } from '../../test/clipboard'

vi.mock('../../api/queries', () => ({
  useCharacterTestDevices: vi.fn(),
  useAssignTestStory: vi.fn(),
  useClearTestStory: vi.fn(),
}))

const mockQuery = useCharacterTestDevices as unknown as ReturnType<typeof vi.fn>
const mockAssign = useAssignTestStory as unknown as ReturnType<typeof vi.fn>
const mockClear = useClearTestStory as unknown as ReturnType<typeof vi.fn>

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

function mutation(overrides: Record<string, unknown> = {}) {
  return {
    mutate: vi.fn(),
    isPending: false,
    error: null,
    ...overrides,
  }
}

const response: CharacterTestDevicesResponse = {
  enabled: true,
  characterKey: 'elly',
  total: 3,
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
    {
      deviceId: 'dev-1003',
      deviceCode: 'CN-003',
      episode: {
        id: 'ep3',
        businessKey: 'elly/1/3',
        title: '听风原野第三天',
        characterKey: 'elly',
        season: 1,
        episodeNumber: 3,
        retiredAt: null,
      },
      version: { id: 'pub-3', version: 5, status: 'published' },
      followsCurrent: false,
      stale: false,
      lastAssignedAt: '2026-11-19T08:00:00.000Z',
    },
  ],
}

function setup(overrides: { writable?: boolean; data?: unknown } = {}) {
  const assignMutation = mutation()
  const clearMutation = mutation()
  const queryResult = idle({ data: overrides.data ?? response })
  mockQuery.mockReturnValue(queryResult)
  mockAssign.mockReturnValue(assignMutation)
  mockClear.mockReturnValue(clearMutation)

  render(
    <MemoryRouter>
      <DeviceTestAssignList
        characterKey="elly"
        writable={overrides.writable ?? true}
      />
    </MemoryRouter>,
  )

  return { assignMutation, clearMutation, queryResult }
}

function rowOf(deviceId: string) {
  const link = screen.getByRole('link', { name: deviceId })
  const row = link.closest('tr')
  if (!row) throw new Error(`row not found for ${deviceId}`)
  return within(row)
}

async function openAction(deviceId: string, label: string) {
  const user = userEvent.setup()
  await user.click(rowOf(deviceId).getByRole('button', { name: '操作' }))
  await user.click(await screen.findByRole('menuitem', { name: label }))
  return user
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DeviceTestAssignList', () => {
  it('renders the device link, no device code, pinned version, stale marker and time', () => {
    setup()

    expect(screen.getByText('elly/1/1')).toBeTruthy()
    expect(screen.getByText('听风原野第一天')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'dev-1001' })).toHaveAttribute(
      'href',
      '/users/dev-1001',
    )
    expect(screen.queryByText('CN-001')).toBeNull()
    expect(screen.queryByText('未登记设备编码')).toBeNull()
    expect(screen.getByText('v2')).toBeTruthy()
    expect(screen.getByText('草稿')).toBeTruthy()
    expect(screen.getByText('旧快照')).toBeTruthy()
    expect(screen.getByText(/2026-11-20/)).toBeTruthy()
    expect(screen.getByText('跟随当前发布版')).toBeTruthy()
    expect(screen.getByText('已下架')).toBeTruthy()
    expect(screen.getByText('共 3 台')).toBeTruthy()
  })

  it('marks a row pinned to the expected version as 最新', () => {
    setup()

    expect(rowOf('dev-1003').getByText('最新')).toBeTruthy()
  })

  it('gives every device id a copy button that copies that row device id', async () => {
    setup()
    const user = userEvent.setup()
    const writeText = stubClipboard()

    expect(screen.getAllByRole('button', { name: '复制设备 ID' })).toHaveLength(3)

    await user.click(
      rowOf('dev-1001').getByRole('button', { name: '复制设备 ID' }),
    )
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('dev-1001'))

    await user.click(
      rowOf('dev-1003').getByRole('button', { name: '复制设备 ID' }),
    )
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('dev-1003'))
  })

  it('reassigns the clicked row to the latest snapshot with that row episode id', async () => {
    const { assignMutation } = setup()

    const user = await openAction('dev-1001', '重新下发到最新版本')
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/elly\/1\/1/)).toBeTruthy()
    await user.type(
      within(dialog).getByPlaceholderText(/半年后别人/),
      '把样机更新到最新版本',
    )
    await user.click(within(dialog).getByRole('button', { name: '确认下发' }))

    expect(assignMutation.mutate).toHaveBeenCalledWith(
      {
        episodeId: 'ep1',
        deviceId: 'dev-1001',
        reason: '把样机更新到最新版本',
      },
      expect.anything(),
    )
  })

  it('clears the clicked row using that row episode id', async () => {
    const { clearMutation } = setup()

    const user = await openAction('dev-1003', '清除下发')
    const dialog = await screen.findByRole('dialog')
    await user.type(
      within(dialog).getByPlaceholderText(/半年后别人/),
      '样机已归还，清除下发',
    )
    await user.click(within(dialog).getByRole('button', { name: '确认清除' }))

    expect(clearMutation.mutate).toHaveBeenCalledWith(
      {
        episodeId: 'ep3',
        deviceId: 'dev-1003',
        reason: '样机已归还，清除下发',
      },
      expect.anything(),
    )
  })

  it('surfaces an audit failure instead of pretending the write was fully recorded', async () => {
    const { assignMutation } = setup()
    assignMutation.mutate.mockImplementation(
      (_vars: unknown, options: { onSuccess: (res: unknown) => void }) => {
        options.onSuccess({
          ok: true,
          audited: false,
          assignment: {
            episodeId: 'ep1',
            title: '听风原野第一天',
            episodeVersionId: 'v10',
            versionStatus: 'published',
          },
        })
      },
    )

    const user = await openAction('dev-1001', '重新下发到最新版本')
    const dialog = await screen.findByRole('dialog')
    await user.type(
      within(dialog).getByPlaceholderText(/半年后别人/),
      '把样机更新到最新版本',
    )
    await user.click(within(dialog).getByRole('button', { name: '确认下发' }))

    expect(await screen.findByText(/审计没写进去/)).toBeTruthy()
  })

  it('reports a successful reassign with the locked snapshot kind', async () => {
    const { assignMutation } = setup()
    assignMutation.mutate.mockImplementation(
      (_vars: unknown, options: { onSuccess: (res: unknown) => void }) => {
        options.onSuccess({
          ok: true,
          audited: true,
          assignment: {
            episodeId: 'ep1',
            title: '听风原野第一天',
            episodeVersionId: 'v10',
            versionStatus: 'published',
          },
        })
      },
    )

    const user = await openAction('dev-1001', '重新下发到最新版本')
    const dialog = await screen.findByRole('dialog')
    await user.type(
      within(dialog).getByPlaceholderText(/半年后别人/),
      '把样机更新到最新版本',
    )
    await user.click(within(dialog).getByRole('button', { name: '确认下发' }))

    expect(await screen.findByText(/已重新下发「听风原野第一天」到 dev-1001/)).toBeTruthy()
  })

  it('reports a successful clear and its audit failure separately', async () => {
    const { clearMutation } = setup()
    clearMutation.mutate.mockImplementation(
      (_vars: unknown, options: { onSuccess: (res: unknown) => void }) => {
        options.onSuccess({ ok: true, audited: true })
      },
    )

    const user = await openAction('dev-1003', '清除下发')
    let dialog = await screen.findByRole('dialog')
    await user.type(
      within(dialog).getByPlaceholderText(/半年后别人/),
      '样机已归还，清除下发',
    )
    await user.click(within(dialog).getByRole('button', { name: '确认清除' }))
    expect(await screen.findByText('已清除 dev-1003 的下发。')).toBeTruthy()

    clearMutation.mutate.mockImplementation(
      (_vars: unknown, options: { onSuccess: (res: unknown) => void }) => {
        options.onSuccess({ ok: true, audited: false })
      },
    )

    const user2 = await openAction('dev-1003', '清除下发')
    dialog = await screen.findByRole('dialog')
    await user2.type(
      within(dialog).getByPlaceholderText(/半年后别人/),
      '样机已归还，清除下发',
    )
    await user2.click(within(dialog).getByRole('button', { name: '确认清除' }))
    expect(await screen.findByText(/已清除下发，但审计没写进去/)).toBeTruthy()
  })

  it('closes the result alert and the reason dialog without writing anything', async () => {
    const { assignMutation } = setup()
    assignMutation.mutate.mockImplementation(
      (_vars: unknown, options: { onSuccess: (res: unknown) => void }) => {
        options.onSuccess({
          ok: true,
          audited: true,
          assignment: {
            episodeId: 'ep1',
            title: '听风原野第一天',
            episodeVersionId: 'v10',
            versionStatus: 'draft',
          },
        })
      },
    )

    const user = await openAction('dev-1001', '重新下发到最新版本')
    const dialog = await screen.findByRole('dialog')
    await user.type(
      within(dialog).getByPlaceholderText(/半年后别人/),
      '把样机更新到最新版本',
    )
    await user.click(within(dialog).getByRole('button', { name: '确认下发' }))
    expect(await screen.findByText(/草稿快照/)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'close' }))
    expect(screen.queryByText(/已重新下发/)).toBeNull()

    const user2 = await openAction('dev-1001', '重新下发到最新版本')
    const dialog2 = await screen.findByRole('dialog')
    await user2.click(within(dialog2).getByRole('button', { name: /取\s*消/ }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('warns when reassigning a retired episode', async () => {
    setup()

    await openAction('dev-1002', '重新下发到最新版本')

    expect(await screen.findByText(/这一集已下架/)).toBeTruthy()
  })

  it('refetches the list from the refresh button', async () => {
    const { queryResult } = setup()

    await userEvent.setup().click(screen.getByRole('button', { name: /刷\s*新/ }))

    expect(queryResult.refetch).toHaveBeenCalledTimes(1)
  })

  it('hides the operation column in a read-only environment', () => {
    setup({ writable: false })

    expect(screen.queryByRole('button', { name: '操作' })).toBeNull()
    expect(screen.getByRole('link', { name: 'dev-1001' })).toBeTruthy()
  })

  it('shows the empty state when nobody is assigned under the IP', () => {
    setup({
      data: { enabled: true, characterKey: 'elly', total: 0, devices: [] },
    })

    expect(screen.getByText('这个 IP 下还没有样机被下发测试故事')).toBeTruthy()
  })

  it('does not request anything without a character key', () => {
    mockQuery.mockReturnValue(idle())
    mockAssign.mockReturnValue(mutation())
    mockClear.mockReturnValue(mutation())

    render(
      <MemoryRouter>
        <DeviceTestAssignList characterKey={null} writable />
      </MemoryRouter>,
    )

    expect(mockQuery).toHaveBeenCalledWith(null, false)
  })

  it('surfaces a load failure without pretending the list is empty', () => {
    mockQuery.mockReturnValue(idle({ error: new Error('boom') }))
    mockAssign.mockReturnValue(mutation())
    mockClear.mockReturnValue(mutation())

    render(
      <MemoryRouter>
        <DeviceTestAssignList characterKey="elly" writable />
      </MemoryRouter>,
    )

    expect(screen.getByText('样机下发列表加载失败')).toBeTruthy()
    expect(screen.getByText('boom')).toBeTruthy()
  })
})
