import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import DeviceTestAssign from './DeviceTestAssign'
import {
  useAssignTestStory,
  useCharacterTestDevices,
  useClearTestStory,
  useDeviceTestAssignment,
} from '../../api/queries'
import { useAllTestDevices } from '../../api/testDevices'
import type { DeviceTestAssignment } from '../../types/adventureAdmin'
import type { AllTestDevicesResult } from '../../api/testDevices'

vi.mock('../../api/queries', () => ({
  useDeviceTestAssignment: vi.fn(),
  useAssignTestStory: vi.fn(),
  useClearTestStory: vi.fn(),
  useCharacterTestDevices: vi.fn(),
}))

vi.mock('../../api/testDevices', () => ({
  useAllTestDevices: vi.fn(),
}))

const mockAssignmentQuery = useDeviceTestAssignment as unknown as ReturnType<
  typeof vi.fn
>
const mockAssign = useAssignTestStory as unknown as ReturnType<typeof vi.fn>
const mockClear = useClearTestStory as unknown as ReturnType<typeof vi.fn>
const mockList = useCharacterTestDevices as unknown as ReturnType<typeof vi.fn>
const mockDevices = useAllTestDevices as unknown as ReturnType<typeof vi.fn>

function queryResult(overrides: Record<string, unknown> = {}) {
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
  return { mutate: vi.fn(), isPending: false, error: null, ...overrides }
}

const WHITELIST: AllTestDevicesResult = {
  enabled: { adventure: true, sleep: true },
  total: 2,
  truncated: false,
  items: [
    {
      id: 'wl-1',
      active: true,
      note: '3 号样机',
      addedBy: 'alice',
      addedAt: '2026-11-22T10:00:00.000Z',
      addedReason: '需要验证新一集',
      revokedBy: null,
      revokedAt: null,
      revokeReason: null,
      device: {
        id: 'uuid-1',
        deviceId: 'dev-1',
        deviceCode: null,
        macAddress: null,
        characterKey: 'elly',
        firmwareVersion: null,
      },
    },
    {
      id: 'wl-2',
      active: true,
      note: null,
      addedBy: 'alice',
      addedAt: '2026-11-22T10:00:00.000Z',
      addedReason: null,
      revokedBy: null,
      revokedAt: null,
      revokeReason: null,
      device: {
        id: 'uuid-2',
        deviceId: 'dev-2',
        deviceCode: null,
        macAddress: null,
        characterKey: 'polly',
        firmwareVersion: null,
      },
    },
  ],
}

const ASSIGNED: DeviceTestAssignment = {
  enabled: true,
  assignment: {
    device: { id: 'uuid-1', deviceId: 'dev-1', deviceCode: null },
    episode: {
      id: 'ep1',
      title: '听风原野第一天',
      episodeNumber: 1,
      characterKey: 'elly',
      season: 1,
    },
    episodeVersion: { id: 'v3', version: 3, status: 'draft' },
  },
}

function setup(
  props: Partial<{
    testStoryEnabled: boolean
    authoring: boolean
    assignment: DeviceTestAssignment | undefined
    assignmentLoading: boolean
    devices: AllTestDevicesResult | undefined
    devicesError: Error | null
    devicesLoading: boolean
    assignError: { status: number; message: string; domainCode?: string } | null
  }> = {},
) {
  const assignMutation = mutation({ error: props.assignError ?? null })
  const clearMutation = mutation()
  const devicesRefetch = vi.fn()
  mockAssignmentQuery.mockReturnValue(
    queryResult({
      data: props.assignment,
      isLoading: props.assignmentLoading ?? false,
    }),
  )
  mockAssign.mockReturnValue(assignMutation)
  mockClear.mockReturnValue(clearMutation)
  mockList.mockReturnValue(queryResult({ data: undefined }))
  mockDevices.mockReturnValue(
    queryResult({
      data: props.devices ?? WHITELIST,
      error: props.devicesError ?? null,
      isLoading: props.devicesLoading ?? false,
      refetch: devicesRefetch,
    }),
  )

  render(
    <MemoryRouter>
      <DeviceTestAssign
        episodeId="ep1"
        characterKey="elly"
        authoring={props.authoring ?? true}
        testStoryEnabled={props.testStoryEnabled ?? true}
      />
    </MemoryRouter>,
  )

  return { assignMutation, clearMutation, devicesRefetch }
}

async function openDeviceSelect() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('combobox'))
  return user
}

async function pickDevice(deviceId: string) {
  const user = await openDeviceSelect()
  const option = await screen.findByTitle(deviceId)
  await user.click(option)
  return user
}

async function openAssign() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: '下发当前集' }))
  const dialog = await screen.findByRole('dialog')
  await user.type(
    within(dialog).getByPlaceholderText(/半年后别人/),
    '把这台样机换成最新版本',
  )
  return { user, dialog }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DeviceTestAssign', () => {
  it('explains the disabled feature and renders nothing else when the env gate is off', () => {
    setup({ testStoryEnabled: false, assignment: ASSIGNED })

    expect(screen.getByText(/测试冒险故事未启用/)).toBeTruthy()
    expect(screen.queryByText('当前已下发的样机')).toBeNull()
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('keeps the list visible but hides write entry points in a read-only environment', () => {
    setup({ authoring: false })

    expect(screen.getByText(/本环境只读/)).toBeTruthy()
    expect(screen.getByText('当前已下发的样机')).toBeTruthy()
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.queryByRole('button', { name: '操作' })).toBeNull()
  })

  it('only requests the whitelist after the dropdown is opened, and refetches on reopen', async () => {
    const { devicesRefetch } = setup()

    expect(mockDevices).toHaveBeenCalledWith(false)

    const user = await openDeviceSelect()
    await waitFor(() => expect(mockDevices).toHaveBeenCalledWith(true))

    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByRole('combobox'))
    expect(devicesRefetch).toHaveBeenCalledTimes(1)
  })

  it('shows device id plus the note tag, and a grey tag when note is empty', async () => {
    setup()

    await openDeviceSelect()

    expect(await screen.findByText('3 号样机')).toBeTruthy()
    expect(screen.getByText('未填备注')).toBeTruthy()
    expect(screen.getAllByText('dev-1').length).toBeGreaterThan(0)
    expect(screen.getAllByText('dev-2').length).toBeGreaterThan(0)
  })

  it('queries the assignment automatically after picking a device', async () => {
    setup({ assignment: ASSIGNED })

    await pickDevice('dev-1')

    await waitFor(() =>
      expect(mockAssignmentQuery).toHaveBeenLastCalledWith('dev-1'),
    )
    expect(await screen.findByText('当前下发')).toBeTruthy()
    expect(screen.getByText('听风原野第一天')).toBeTruthy()
    expect(screen.getByText('草稿 v3')).toBeTruthy()
  })

  it('tells the operator when the picked device has no assignment', async () => {
    setup({ assignment: { enabled: true, assignment: null } })

    await pickDevice('dev-2')

    expect(
      await screen.findByText('该设备当前没有下发任何测试故事。'),
    ).toBeTruthy()
  })

  it('assigns the picked device with the reason', async () => {
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

    await pickDevice('dev-1')
    const { user, dialog } = await openAssign()
    await user.click(within(dialog).getByRole('button', { name: '确认下发' }))

    expect(assignMutation.mutate).toHaveBeenCalledWith(
      {
        episodeId: 'ep1',
        deviceId: 'dev-1',
        reason: '把这台样机换成最新版本',
      },
      expect.anything(),
    )
    expect(await screen.findByText(/已下发「听风原野第一天」到 dev-1/)).toBeTruthy()
  })

  it('does not silently drop an assignment when the audit write failed', async () => {
    const { assignMutation } = setup()
    assignMutation.mutate.mockImplementation(
      (_vars: unknown, options: { onSuccess: (res: unknown) => void }) => {
        options.onSuccess({
          ok: true,
          audited: false,
          assignment: {
            episodeId: 'ep1',
            title: '听风原野第一天',
            episodeVersionId: null,
            versionStatus: 'published',
          },
        })
      },
    )

    await pickDevice('dev-1')
    const { user, dialog } = await openAssign()
    await user.click(within(dialog).getByRole('button', { name: '确认下发' }))

    expect(await screen.findByText(/审计没写进去/)).toBeTruthy()
  })

  it('clears the picked device with the reason', async () => {
    const { clearMutation } = setup()
    clearMutation.mutate.mockImplementation(
      (_vars: unknown, options: { onSuccess: (res: unknown) => void }) => {
        options.onSuccess({ ok: true, audited: true })
      },
    )

    await pickDevice('dev-1')
    await userEvent.click(screen.getByRole('button', { name: '清除下发' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(
      within(dialog).getByPlaceholderText(/半年后别人/),
      '样机回收，清除下发关系',
    )
    await userEvent.click(within(dialog).getByRole('button', { name: '确认清除' }))

    expect(clearMutation.mutate).toHaveBeenCalledWith(
      {
        episodeId: 'ep1',
        deviceId: 'dev-1',
        reason: '样机回收，清除下发关系',
      },
      expect.anything(),
    )
    expect(await screen.findByText('已清除 dev-1 的下发。')).toBeTruthy()
  })

  it('warns when the clear action did not leave an audit row', async () => {
    const { clearMutation } = setup()
    clearMutation.mutate.mockImplementation(
      (_vars: unknown, options: { onSuccess: (res: unknown) => void }) => {
        options.onSuccess({ ok: true, audited: false })
      },
    )

    await pickDevice('dev-1')
    await userEvent.click(screen.getByRole('button', { name: '清除下发' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(
      within(dialog).getByPlaceholderText(/半年后别人/),
      '样机回收，清除下发关系',
    )
    await userEvent.click(within(dialog).getByRole('button', { name: '确认清除' }))

    expect(await screen.findByText(/已清除下发，但审计没写进去/)).toBeTruthy()
  })

  it('points to the whitelist page when the whitelist is empty', async () => {
    setup({
      devices: {
        enabled: { adventure: true, sleep: true },
        items: [],
        total: 0,
        truncated: false,
      },
    })

    await openDeviceSelect()

    expect((await screen.findAllByText(/白名单暂无设备/)).length).toBeGreaterThan(0)
    const link = screen.getByRole('link', { name: /测试设备白名单/ })
    expect(link).toHaveAttribute('href', '/test-devices')
  })

  it('surfaces a whitelist load failure with a retry action', async () => {
    const { devicesRefetch } = setup({
      devices: undefined,
      devicesError: new Error('boom'),
    })

    expect(screen.getByText('白名单加载失败')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /重\s*试/ }))

    expect(devicesRefetch).toHaveBeenCalledTimes(1)
  })

  it('warns when the whitelist is truncated and when adventure testing is off', async () => {
    setup({
      devices: {
        ...WHITELIST,
        enabled: { adventure: false, sleep: false },
        truncated: true,
      },
    })

    expect(screen.getByText(/仅显示前 1000 台/)).toBeTruthy()
    expect(screen.getByText(/测试模式未开启/)).toBeTruthy()

    await pickDevice('dev-1')
    expect(screen.getByRole('button', { name: '下发当前集' })).toBeDisabled()
  })

  it('shows the revocation warning when the picked device is no longer whitelisted', async () => {
    setup({
      assignment: { ...ASSIGNED, whitelisted: false },
    })

    await pickDevice('dev-1')

    expect(await screen.findByText(/不在测试设备白名单里/)).toBeTruthy()
    expect(screen.getByRole('button', { name: '下发当前集' })).toBeDisabled()
  })

  it('labels the pinned snapshot as the current published version', async () => {
    setup({
      assignment: {
        ...ASSIGNED,
        assignment: { ...ASSIGNED.assignment!, episodeVersion: null },
      },
    })

    await pickDevice('dev-1')
    expect(await screen.findByText('当前发布版')).toBeTruthy()
  })

  it('shows the loading hint while the assignment is being read', () => {
    setup({ assignmentLoading: true })
    expect(screen.getByText('正在读取…')).toBeTruthy()
  })

  it('keeps a mutation error inside the reason dialog with its domain code', async () => {
    setup({
      assignError: {
        status: 409,
        message: '该设备在别处被占用',
        domainCode: 'DEVICE_BUSY',
      },
    })

    await pickDevice('dev-1')
    await openAssign()

    expect(screen.getByText('服务端拒绝了这次操作')).toBeTruthy()
    expect(screen.getByText('该设备在别处被占用')).toBeTruthy()
    expect(screen.getByText('DEVICE_BUSY')).toBeTruthy()
  })

  it('dismisses the result alert and cancels both dialogs without writing', async () => {
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

    await pickDevice('dev-1')
    const first = await openAssign()
    await first.user.click(
      within(first.dialog).getByRole('button', { name: '确认下发' }),
    )
    expect(await screen.findByText(/已下发「听风原野第一天」/)).toBeTruthy()
    await first.user.click(screen.getByRole('button', { name: 'close' }))
    expect(screen.queryByText(/已下发「听风原野第一天」/)).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: '下发当前集' }))
    const assignDialog = await screen.findByRole('dialog')
    await userEvent.click(
      within(assignDialog).getByRole('button', { name: /取\s*消/ }),
    )
    expect(screen.queryByRole('dialog')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: '清除下发' }))
    const clearDialog = await screen.findByRole('dialog')
    await userEvent.click(
      within(clearDialog).getByRole('button', { name: /取\s*消/ }),
    )
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(assignMutation.mutate).toHaveBeenCalledTimes(1)
  })
})
