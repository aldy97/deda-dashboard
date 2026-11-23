import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { message, Modal } from 'antd'
import Voice from './index'
import {
  useApplyVoiceSpeed,
  useSaveVoiceSpeed,
  useVoiceSpeed,
} from '../../api/voiceSpeed'
import {
  useCreateVoiceTimbre,
  useDeleteVoiceTimbre,
  useUpdateVoiceTimbre,
  useVoiceTimbres,
} from '../../api/voiceTimbre'

/**
 * 页面级集成测试：替身只放在 hooks 层，让真实的 SpeedSection / TimbreSection
 * 与 antd Form 一起跑。覆盖两段各自的加载态、加载完成后的可写状态，
 * 以及「保存」这条入口确实把改动交给 mutation。
 */
vi.mock('../../api/voiceSpeed', () => ({
  useVoiceSpeed: vi.fn(),
  useSaveVoiceSpeed: vi.fn(),
  useApplyVoiceSpeed: vi.fn(),
}))

vi.mock('../../api/voiceTimbre', () => ({
  useVoiceTimbres: vi.fn(),
  useCreateVoiceTimbre: vi.fn(),
  useUpdateVoiceTimbre: vi.fn(),
  useDeleteVoiceTimbre: vi.fn(),
}))

const mockSpeed = useVoiceSpeed as unknown as ReturnType<typeof vi.fn>
const mockSaveSpeed = useSaveVoiceSpeed as unknown as ReturnType<typeof vi.fn>
const mockApplySpeed = useApplyVoiceSpeed as unknown as ReturnType<typeof vi.fn>
const mockTimbres = useVoiceTimbres as unknown as ReturnType<typeof vi.fn>
const mockCreate = useCreateVoiceTimbre as unknown as ReturnType<typeof vi.fn>
const mockUpdate = useUpdateVoiceTimbre as unknown as ReturnType<typeof vi.fn>
const mockDelete = useDeleteVoiceTimbre as unknown as ReturnType<typeof vi.fn>

function mutation(overrides: Record<string, unknown> = {}) {
  return {
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
    error: null,
    ...overrides,
  }
}

const rows = [
  {
    characterKey: 'elly',
    timbreId: '1000957',
    updatedAt: '2026-11-20T04:00:00.000Z',
    personaConfigured: true,
    devicesInUse: 2,
  },
  {
    characterKey: 'polly',
    timbreId: '1000958',
    updatedAt: '2026-11-20T04:00:00.000Z',
    personaConfigured: false,
    devicesInUse: 0,
  },
]

function mockLoaded() {
  mockSpeed.mockReturnValue({
    data: { normalSpd: 0.7, sleepSpd: 0.5 },
    isPending: false,
  })
  mockSaveSpeed.mockReturnValue(mutation())
  mockApplySpeed.mockReturnValue(mutation())
  mockTimbres.mockReturnValue({
    data: rows,
    isPending: false,
    isError: false,
    error: null,
  })
  mockCreate.mockReturnValue(mutation())
  mockUpdate.mockReturnValue(mutation())
  mockDelete.mockReturnValue(mutation())
}

/**
 * 静态 message / Modal.info 各自创建一棵脱离组件树的全局 React 根，
 * toast 与弹窗的定时器会活过 jsdom 拆除；打桩掉静态调用，只断言参数
 * （与 SpeedSection.test / TestDevices 既有写法一致）。
 */
let successSpy: ReturnType<typeof vi.spyOn>
let errorSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  successSpy = vi
    .spyOn(message, 'success')
    .mockImplementation(() => undefined as never)
  errorSpy = vi
    .spyOn(message, 'error')
    .mockImplementation(() => undefined as never)
  vi.spyOn(Modal, 'info').mockImplementation(
    () => ({ destroy: vi.fn(), update: vi.fn() }) as never,
  )
  mockLoaded()
})

describe('语速与音色页集成 · 加载态', () => {
  it('两个 section 同时处于读取中：表单禁用、表格转圈', () => {
    mockSpeed.mockReturnValue({ data: undefined, isPending: true })
    mockTimbres.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      error: null,
    })

    render(<Voice />)

    expect(screen.getByText('语速与音色')).toBeInTheDocument()
    expect(screen.getByText('正在读取当前配置…')).toBeInTheDocument()
    expect(
      (screen.getByLabelText('非哄睡语速') as HTMLInputElement).disabled,
    ).toBe(true)
    expect(document.querySelector('.ant-spin-spinning')).not.toBeNull()
    expect(screen.getByText('暂无角色')).toBeInTheDocument()
  })
})

describe('语速与音色页集成 · 语速区可写', () => {
  it('读到配置后表单可编辑，未改动时保存禁用', () => {
    render(<Voice />)

    expect((screen.getByLabelText('非哄睡语速') as HTMLInputElement).value).toBe(
      '0.70',
    )
    expect((screen.getByLabelText('哄睡语速') as HTMLInputElement).value).toBe(
      '0.50',
    )
    expect(screen.getByText('当前与服务端一致')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /保\s*存/ })).toBeDisabled()
  })

  it('改动后保存变可点，点下去把两个语速交给 mutation', async () => {
    const save = mutation()
    mockSaveSpeed.mockReturnValue(save)
    render(<Voice />)

    fireEvent.change(screen.getByLabelText('非哄睡语速'), {
      target: { value: '0.8' },
    })

    await waitFor(() =>
      expect(
        screen.getByText('有未保存的改动，保存后下一轮对话生效'),
      ).toBeInTheDocument(),
    )
    const saveButton = screen.getByRole('button', { name: /保\s*存/ })
    expect(saveButton).not.toBeDisabled()
    // 有未保存改动时下发被拦住，避免把旧值推到在线设备
    expect(
      screen.getByRole('button', { name: /立即下发到在线设备/ }),
    ).toBeDisabled()

    fireEvent.click(saveButton)

    await waitFor(() =>
      expect(save.mutateAsync).toHaveBeenCalledWith({
        normalSpd: 0.8,
        sleepSpd: 0.5,
      }),
    )
    await waitFor(() =>
      expect(successSpy).toHaveBeenCalledWith(
        '已保存；当前这轮不受影响，下一轮起生效',
      ),
    )
  })

  it('保存失败时提示服务端 message', async () => {
    const save = mutation({
      mutateAsync: vi.fn().mockRejectedValue(new Error('写入被拒绝')),
    })
    mockSaveSpeed.mockReturnValue(save)
    render(<Voice />)

    fireEvent.change(screen.getByLabelText('哄睡语速'), {
      target: { value: '0.6' },
    })
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /保\s*存/ }),
      ).not.toBeDisabled(),
    )
    fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }))

    await waitFor(() => expect(errorSpy).toHaveBeenCalledWith('写入被拒绝'))
  })
})

describe('语速与音色页集成 · 音色区可写', () => {
  it('列表展示人设状态与在用设备数，没有 device 时用破折号', () => {
    render(<Voice />)

    expect(screen.getByText('音色管理')).toBeInTheDocument()
    expect(screen.getByText('已配置')).toBeInTheDocument()
    expect(
      screen.getByText('未配置，对话将回落 Elly'),
    ).toBeInTheDocument()
    expect(screen.getByText('2 台')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('新增角色：填表后保存把 trim/小写后的角色与音色交给 mutation', async () => {
    const create = mutation()
    mockCreate.mockReturnValue(create)
    render(<Voice />)

    await userEvent.click(screen.getByRole('button', { name: /新增角色/ }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('新增角色')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('角色标识'), {
      target: { value: '  Nemo  ' },
    })
    fireEvent.change(screen.getByLabelText('音色 ID'), {
      target: { value: '1000999' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: /保\s*存/ }))

    await waitFor(() =>
      expect(create.mutateAsync).toHaveBeenCalledWith({
        characterKey: 'nemo',
        timbreId: '1000999',
      }),
    )
    await waitFor(() =>
      expect(successSpy).toHaveBeenCalledWith('角色已新增，下一轮对话生效'),
    )
  })

  it('编辑音色：角色标识锁定，只改 timbreId', async () => {
    const update = mutation()
    mockUpdate.mockReturnValue(update)
    render(<Voice />)

    await userEvent.click(
      screen.getAllByRole('button', { name: /编\s*辑/ })[0],
    )
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('编辑音色')).toBeInTheDocument()
    expect(
      (screen.getByLabelText('角色标识') as HTMLInputElement).disabled,
    ).toBe(true)

    fireEvent.change(screen.getByLabelText('音色 ID'), {
      target: { value: '222' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: /保\s*存/ }))

    await waitFor(() =>
      expect(update.mutateAsync).toHaveBeenCalledWith({
        characterKey: 'elly',
        timbreId: '222',
      }),
    )
    await waitFor(() =>
      expect(successSpy).toHaveBeenCalledWith('音色已更新，下一轮对话生效'),
    )
  })

  it('列表加载失败时给出错误提示', () => {
    mockTimbres.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: new Error('音色服务挂了'),
    })

    render(<Voice />)

    expect(screen.getByText('音色列表加载失败')).toBeInTheDocument()
    expect(screen.getByText('音色服务挂了')).toBeInTheDocument()
  })
})
