import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import DeviceTestAssign from './DeviceTestAssign'
import {
  useAssignTestStory,
  useCharacterTestDevices,
  useClearTestStory,
  useDeviceTestAssignment,
} from '../../api/queries'
import type {
  DeviceTestAssignment,
  TestAssignResult,
  TestClearResult,
} from '../../types/adventureAdmin'

/**
 * 样机下发的三种环境态（未启用 / 只读 / 可写）与三个动作（查询 / 下发 / 清除）
 * 都要显式区分；写动作成功后必须重新查一次当前下发，否则界面会继续显示旧关系。
 */
vi.mock('../../api/queries', () => ({
  useAssignTestStory: vi.fn(),
  useClearTestStory: vi.fn(),
  useDeviceTestAssignment: vi.fn(),
  useCharacterTestDevices: vi.fn(),
}))

const mockAssignment = useDeviceTestAssignment as unknown as ReturnType<typeof vi.fn>
const mockAssign = useAssignTestStory as unknown as ReturnType<typeof vi.fn>
const mockClear = useClearTestStory as unknown as ReturnType<typeof vi.fn>
const mockList = useCharacterTestDevices as unknown as ReturnType<typeof vi.fn>

function mutation(overrides: Record<string, unknown> = {}) {
  return { mutate: vi.fn(), isPending: false, error: null, ...overrides }
}

function queryState(overrides: Record<string, unknown> = {}) {
  return {
    data: undefined,
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  }
}

function renderAssign(props: Partial<Parameters<typeof DeviceTestAssign>[0]> = {}) {
  mockList.mockReturnValue(queryState({ data: undefined }))
  return render(
    <DeviceTestAssign
      episodeId="ep1"
      characterKey="elly"
      authoring
      testStoryEnabled
      {...props}
    />,
  )
}

const DEVICE_INPUT = '设备 ID（小写 MAC）或设备编码'

function typeDevice(value: string) {
  fireEvent.change(screen.getByPlaceholderText(DEVICE_INPUT), {
    target: { value },
  })
}

function typeReason() {
  fireEvent.change(screen.getByPlaceholderText(/半年后别人/), {
    target: { value: '把这一集下发到样机做验收' },
  })
}

const currentAssignment: DeviceTestAssignment = {
  enabled: true,
  assignment: {
    device: { id: 'db-1', deviceId: 'dev-1', deviceCode: 'CN-001' },
    episode: {
      id: 'ep1',
      title: '听风原野第一天',
      episodeNumber: 1,
      characterKey: 'elly',
      season: 1,
    },
    episodeVersion: { id: 'v2', version: 2, status: 'draft' },
  },
}

describe('DeviceTestAssign · 环境闸', () => {
  it('测试冒险故事未启用时只说明原因，不给任何操作入口', () => {
    mockAssignment.mockReturnValue(queryState())
    mockAssign.mockReturnValue(mutation())
    mockClear.mockReturnValue(mutation())

    renderAssign({ testStoryEnabled: false })

    expect(screen.getByText(/测试冒险故事未启用/)).toBeInTheDocument()
    expect(
      screen.queryByPlaceholderText(DEVICE_INPUT),
    ).not.toBeInTheDocument()
  })

  it('只读环境不提供下发/清除，但仍能看当前 IP 的样机列表', () => {
    mockAssignment.mockReturnValue(queryState())
    mockAssign.mockReturnValue(mutation())
    mockClear.mockReturnValue(mutation())

    renderAssign({ authoring: false })

    expect(screen.getByText(/本环境只读，不能下发或清除/)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /下发当前集/ }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('当前已下发的样机')).toBeInTheDocument()
  })
})

describe('DeviceTestAssign · 查询当前下发', () => {
  it('输入设备 ID 后查询，空白输入按未填处理', () => {
    mockAssignment.mockReturnValue(queryState())
    mockAssign.mockReturnValue(mutation())
    mockClear.mockReturnValue(mutation())

    renderAssign()

    typeDevice('  dev-1  ')
    fireEvent.click(screen.getByRole('button', { name: /查询当前下发/ }))
    expect(mockAssignment).toHaveBeenLastCalledWith('dev-1')

    typeDevice('   ')
    fireEvent.click(screen.getByRole('button', { name: /查询当前下发/ }))
    expect(mockAssignment).toHaveBeenLastCalledWith(null)
  })

  it('查询中显示「正在读取…」', () => {
    mockAssignment.mockReturnValue(queryState({ isLoading: true }))
    mockAssign.mockReturnValue(mutation())
    mockClear.mockReturnValue(mutation())

    renderAssign()

    expect(screen.getByText('正在读取…')).toBeInTheDocument()
  })

  it('查到了下发：显示设备、剧集、IP 与草稿版本', () => {
    mockAssignment.mockReturnValue(queryState({ data: currentAssignment }))
    mockAssign.mockReturnValue(mutation())
    mockClear.mockReturnValue(mutation())

    renderAssign()

    expect(screen.getByText('当前下发')).toBeInTheDocument()
    expect(screen.getByText('dev-1')).toBeInTheDocument()
    expect(screen.getByText('听风原野第一天')).toBeInTheDocument()
    expect(screen.getByText('小象 Elly')).toBeInTheDocument()
    expect(screen.getByText('草稿 v2')).toBeInTheDocument()
  })

  it('锁的是发布版时标注「当前发布版」', () => {
    mockAssignment.mockReturnValue(
      queryState({
        data: {
          enabled: true,
          assignment: {
            ...currentAssignment.assignment,
            episodeVersion: null,
          },
        },
      }),
    )
    mockAssign.mockReturnValue(mutation())
    mockClear.mockReturnValue(mutation())

    renderAssign()

    expect(screen.getByText('当前发布版')).toBeInTheDocument()
  })

  it('设备上没有剧集时用（无）占位，不伪造标题', () => {
    mockAssignment.mockReturnValue(
      queryState({
        data: {
          enabled: true,
          assignment: {
            ...currentAssignment.assignment,
            episode: null,
            episodeVersion: null,
          },
        },
      }),
    )
    mockAssign.mockReturnValue(mutation())
    mockClear.mockReturnValue(mutation())

    renderAssign()

    expect(screen.getByText('（无）')).toBeInTheDocument()
  })

  it('没有下发关系时明确说「该设备当前没有下发」', async () => {
    mockAssignment.mockReturnValue(
      queryState({ data: { enabled: true, assignment: null } }),
    )
    mockAssign.mockReturnValue(mutation())
    mockClear.mockReturnValue(mutation())

    renderAssign()

    typeDevice('dev-9')
    fireEvent.click(screen.getByRole('button', { name: /查询当前下发/ }))

    expect(
      await screen.findByText('该设备当前没有下发任何测试故事。'),
    ).toBeInTheDocument()
  })
})

describe('DeviceTestAssign · 下发', () => {
  it('弹窗说明会锁草稿或发布版并落审计，提交把三要素交给 mutation', async () => {
    mockAssignment.mockReturnValue(queryState())
    const assign = mutation()
    mockAssign.mockReturnValue(assign)
    mockClear.mockReturnValue(mutation())

    renderAssign()

    typeDevice('dev-1')
    fireEvent.click(screen.getByRole('button', { name: /下发当前集/ }))
    expect(screen.getByText('下发当前集到样机')).toBeInTheDocument()

    typeReason()
    fireEvent.click(screen.getByRole('button', { name: '确认下发' }))

    expect(assign.mutate).toHaveBeenCalledWith(
      { episodeId: 'ep1', deviceId: 'dev-1', reason: '把这一集下发到样机做验收' },
      expect.any(Object),
    )

    const onSuccess = assign.mutate.mock.calls[0][1].onSuccess as (
      res: TestAssignResult,
    ) => void
    await act(async () => {
      onSuccess({
        ok: true,
        audited: true,
        assignment: {
          episodeId: 'ep1',
          title: '听风原野第一天',
          episodeVersionId: 'v2',
          versionStatus: 'draft',
        },
      })
    })

    expect(
      screen.getByText(
        '已下发「听风原野第一天」到 dev-1（草稿快照）。孩子说「测试冒险故事」即可播放。',
      ),
    ).toBeInTheDocument()
    // 成功后重新查一次该设备的下发关系
    expect(mockAssignment).toHaveBeenLastCalledWith('dev-1')
  })

  it('发布版用「当前发布版」描述，不谎称草稿', async () => {
    mockAssignment.mockReturnValue(queryState())
    const assign = mutation()
    mockAssign.mockReturnValue(assign)
    mockClear.mockReturnValue(mutation())

    renderAssign()

    typeDevice('dev-1')
    fireEvent.click(screen.getByRole('button', { name: /下发当前集/ }))
    typeReason()
    fireEvent.click(screen.getByRole('button', { name: '确认下发' }))

    await act(async () => {
      ;(assign.mutate.mock.calls[0][1].onSuccess as (r: TestAssignResult) => void)({
        ok: true,
        audited: true,
        assignment: {
          episodeId: 'ep1',
          title: '听风原野第一天',
          episodeVersionId: null,
          versionStatus: 'published',
        },
      })
    })

    expect(
      screen.getByText(
        '已下发「听风原野第一天」到 dev-1（当前发布版）。孩子说「测试冒险故事」即可播放。',
      ),
    ).toBeInTheDocument()
  })

  it('审计没写进去时显式提示，而不是报成功', async () => {
    mockAssignment.mockReturnValue(queryState())
    const assign = mutation()
    mockAssign.mockReturnValue(assign)
    mockClear.mockReturnValue(mutation())

    renderAssign()

    typeDevice('dev-1')
    fireEvent.click(screen.getByRole('button', { name: /下发当前集/ }))
    typeReason()
    fireEvent.click(screen.getByRole('button', { name: '确认下发' }))

    await act(async () => {
      ;(assign.mutate.mock.calls[0][1].onSuccess as (r: TestAssignResult) => void)({
        ok: true,
        audited: false,
        assignment: {
          episodeId: 'ep1',
          title: '听风原野第一天',
          episodeVersionId: 'v2',
          versionStatus: 'draft',
        },
      })
    })

    expect(
      screen.getByText(
        '已下发，但审计没写进去（audited=false）。这一次动作没有留痕，请人工记录时间与理由。',
      ),
    ).toBeInTheDocument()
  })

  it('没填设备就提交：拒绝发送请求并提示先填设备', () => {
    mockAssignment.mockReturnValue(queryState())
    const assign = mutation()
    mockAssign.mockReturnValue(assign)
    mockClear.mockReturnValue(mutation())

    renderAssign()

    typeDevice('dev-1')
    fireEvent.click(screen.getByRole('button', { name: /下发当前集/ }))
    typeDevice('')
    typeReason()
    fireEvent.click(screen.getByRole('button', { name: '确认下发' }))

    expect(assign.mutate).not.toHaveBeenCalled()
    expect(
      screen.getByText('请先填写设备 ID（小写 MAC 或设备编码）。'),
    ).toBeInTheDocument()
  })

  it('mutation 报错时错误留在弹窗内并带领域码', () => {
    mockAssignment.mockReturnValue(queryState())
    mockAssign.mockReturnValue(
      mutation({
        error: { status: 409, message: '该设备在别处被占用', domainCode: 'DEVICE_BUSY' },
      }),
    )
    mockClear.mockReturnValue(mutation())

    renderAssign()

    typeDevice('dev-1')
    fireEvent.click(screen.getByRole('button', { name: /下发当前集/ }))

    expect(screen.getByText('服务端拒绝了这次操作')).toBeInTheDocument()
    expect(screen.getByText('该设备在别处被占用')).toBeInTheDocument()
    expect(screen.getByText('DEVICE_BUSY')).toBeInTheDocument()
  })

  it('下发按钮在设备 ID 为空时禁用', () => {
    mockAssignment.mockReturnValue(queryState())
    mockAssign.mockReturnValue(mutation())
    mockClear.mockReturnValue(mutation())

    renderAssign()

    expect(screen.getByRole('button', { name: /下发当前集/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /清除下发/ })).toBeDisabled()
  })
})

describe('DeviceTestAssign · 清除', () => {
  it('确认后调用 clear，成功后提示已清除', async () => {
    mockAssignment.mockReturnValue(queryState())
    mockAssign.mockReturnValue(mutation())
    const clear = mutation()
    mockClear.mockReturnValue(clear)

    renderAssign()

    typeDevice('dev-1')
    fireEvent.click(screen.getByRole('button', { name: /清除下发/ }))
    expect(screen.getByText('清除样机下发')).toBeInTheDocument()

    typeReason()
    fireEvent.click(screen.getByRole('button', { name: '确认清除' }))

    expect(clear.mutate).toHaveBeenCalledWith(
      { episodeId: 'ep1', deviceId: 'dev-1', reason: '把这一集下发到样机做验收' },
      expect.any(Object),
    )

    await act(async () => {
      ;(clear.mutate.mock.calls[0][1].onSuccess as (r: TestClearResult) => void)({
        ok: true,
        audited: true,
      })
    })

    expect(screen.getByText('已清除 dev-1 的下发。')).toBeInTheDocument()
  })

  it('清除生效但审计失败时同样显式提示', async () => {
    mockAssignment.mockReturnValue(queryState())
    mockAssign.mockReturnValue(mutation())
    const clear = mutation()
    mockClear.mockReturnValue(clear)

    renderAssign()

    typeDevice('dev-1')
    fireEvent.click(screen.getByRole('button', { name: /清除下发/ }))
    typeReason()
    fireEvent.click(screen.getByRole('button', { name: '确认清除' }))

    await act(async () => {
      ;(clear.mutate.mock.calls[0][1].onSuccess as (r: TestClearResult) => void)({
        ok: true,
        audited: false,
      })
    })

    expect(
      screen.getByText(
        '已清除下发，但审计没写进去（audited=false）。这一次动作没有留痕，请人工记录时间与理由。',
      ),
    ).toBeInTheDocument()
  })

  it('取消清除弹窗不调用 mutation', () => {
    mockAssignment.mockReturnValue(queryState())
    mockAssign.mockReturnValue(mutation())
    const clear = mutation()
    mockClear.mockReturnValue(clear)

    renderAssign()

    typeDevice('dev-1')
    fireEvent.click(screen.getByRole('button', { name: /清除下发/ }))
    fireEvent.click(screen.getByRole('button', { name: /取\s*消/ }))

    expect(clear.mutate).not.toHaveBeenCalled()
  })
})
