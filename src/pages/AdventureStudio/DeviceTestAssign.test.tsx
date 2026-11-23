import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import DeviceTestAssign from './DeviceTestAssign'
import {
  useAssignTestStory,
  useCharacterTestDevices,
  useClearTestStory,
  useDeviceTestAssignment,
} from '../../api/queries'
import type { DeviceTestAssignment } from '../../types/adventureAdmin'

vi.mock('../../api/queries', () => ({
  useDeviceTestAssignment: vi.fn(),
  useAssignTestStory: vi.fn(),
  useClearTestStory: vi.fn(),
  useCharacterTestDevices: vi.fn(),
}))

const mockAssignmentQuery = useDeviceTestAssignment as unknown as ReturnType<
  typeof vi.fn
>
const mockAssign = useAssignTestStory as unknown as ReturnType<typeof vi.fn>
const mockClear = useClearTestStory as unknown as ReturnType<typeof vi.fn>
const mockList = useCharacterTestDevices as unknown as ReturnType<typeof vi.fn>

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
  }> = {},
) {
  const assignMutation = mutation()
  const clearMutation = mutation()
  mockAssignmentQuery.mockReturnValue(queryResult({ data: props.assignment }))
  mockAssign.mockReturnValue(assignMutation)
  mockClear.mockReturnValue(clearMutation)
  mockList.mockReturnValue(queryResult({ data: undefined }))

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

  return { assignMutation, clearMutation }
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
    expect(screen.queryByRole('button', { name: '下发当前集' })).toBeNull()
  })

  it('keeps the list visible but hides write entry points in a read-only environment', () => {
    setup({ authoring: false })

    expect(screen.getByText(/本环境只读/)).toBeTruthy()
    expect(screen.getByText('当前已下发的样机')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '下发当前集' })).toBeNull()
    expect(screen.queryByRole('button', { name: '操作' })).toBeNull()
  })

  it('queries the trimmed device id and shows what the device currently plays', async () => {
    setup({ assignment: ASSIGNED })

    await userEvent.type(
      screen.getByPlaceholderText('设备 ID（小写 MAC）或设备编码'),
      '  dev-1  ',
    )
    await userEvent.click(screen.getByRole('button', { name: '查询当前下发' }))

    expect(mockAssignmentQuery).toHaveBeenCalledWith('dev-1')
    expect(await screen.findByText('当前下发')).toBeTruthy()
    expect(screen.getByText('听风原野第一天')).toBeTruthy()
    expect(screen.getByText('草稿 v3')).toBeTruthy()
  })

  it('tells the operator when the queried device has no assignment', async () => {
    setup({
      assignment: { enabled: true, assignment: null },
    })

    await userEvent.type(
      screen.getByPlaceholderText('设备 ID（小写 MAC）或设备编码'),
      'dev-2',
    )
    await userEvent.click(screen.getByRole('button', { name: '查询当前下发' }))

    expect(
      await screen.findByText('该设备当前没有下发任何测试故事。'),
    ).toBeTruthy()
  })

  it('shows the device even when its assigned episode row is gone', async () => {
    setup({
      assignment: {
        enabled: true,
        assignment: {
          device: { id: 'uuid-9', deviceId: 'dev-9', deviceCode: null },
          episode: null,
          episodeVersion: null,
        },
      },
    })

    await userEvent.type(
      screen.getByPlaceholderText('设备 ID（小写 MAC）或设备编码'),
      'dev-9',
    )
    await userEvent.click(screen.getByRole('button', { name: '查询当前下发' }))

    expect(await screen.findByText('当前下发')).toBeTruthy()
    expect(screen.getByText('dev-9')).toBeTruthy()
    expect(screen.getByText('（无）')).toBeTruthy()
  })

  it('assigns the current episode with the trimmed device id and the reason', async () => {
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

    await userEvent.type(
      screen.getByPlaceholderText('设备 ID（小写 MAC）或设备编码'),
      ' dev-1 ',
    )
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

    await userEvent.type(
      screen.getByPlaceholderText('设备 ID（小写 MAC）或设备编码'),
      'dev-1',
    )
    const { user, dialog } = await openAssign()
    await user.click(within(dialog).getByRole('button', { name: '确认下发' }))

    expect(await screen.findByText(/审计没写进去/)).toBeTruthy()
  })

  it('refuses to submit without a device id', async () => {
    setup()

    await userEvent.click(screen.getByRole('button', { name: '下发当前集' }))
    // 无设备 ID 时按钮已禁用，弹窗不应打开
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('clears the assignment with the trimmed device id and the reason', async () => {
    const { clearMutation } = setup()
    clearMutation.mutate.mockImplementation(
      (_vars: unknown, options: { onSuccess: (res: unknown) => void }) => {
        options.onSuccess({ ok: true, audited: true })
      },
    )

    await userEvent.type(
      screen.getByPlaceholderText('设备 ID（小写 MAC）或设备编码'),
      ' dev-1 ',
    )
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

    await userEvent.type(
      screen.getByPlaceholderText('设备 ID（小写 MAC）或设备编码'),
      'dev-1',
    )
    await userEvent.click(screen.getByRole('button', { name: '清除下发' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(
      within(dialog).getByPlaceholderText(/半年后别人/),
      '样机回收，清除下发关系',
    )
    await userEvent.click(within(dialog).getByRole('button', { name: '确认清除' }))

    expect(await screen.findByText(/已清除下发，但审计没写进去/)).toBeTruthy()
  })

  it('lets the operator dismiss the result alert and cancel both dialogs', async () => {
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

    await userEvent.type(
      screen.getByPlaceholderText('设备 ID（小写 MAC）或设备编码'),
      'dev-1',
    )

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
