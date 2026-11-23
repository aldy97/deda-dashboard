import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { message } from 'antd'
import TestDevices from './index'
import {
  useAddTestDevice,
  useRevokeTestDevice,
  useTestDevices,
} from '../../api/testDevices'
import type { TestDevicesResponse } from '../../api/testDevices'

vi.mock('../../api/testDevices', () => ({
  useTestDevices: vi.fn(),
  useAddTestDevice: vi.fn(),
  useRevokeTestDevice: vi.fn(),
}))

const mockQuery = useTestDevices as unknown as ReturnType<typeof vi.fn>
const mockAdd = useAddTestDevice as unknown as ReturnType<typeof vi.fn>
const mockRevoke = useRevokeTestDevice as unknown as ReturnType<typeof vi.fn>

const ITEM = {
  id: 'wl-1',
  active: true,
  note: '3 号样机',
  addedBy: 'alice',
  addedAt: '2026-11-22T10:00:00.000Z',
  addedReason: '需要验证新一集内容',
  revokedBy: null,
  revokedAt: null,
  revokeReason: null,
  device: {
    id: 'dev-uuid-1',
    deviceId: 'aa:bb:cc:dd:ee:ff',
    deviceCode: 'CN-001',
    macAddress: 'AA:BB:CC:DD:EE:FF',
    characterKey: 'elly',
    firmwareVersion: '1.2.3',
  },
}

const REVOKED = {
  ...ITEM,
  id: 'wl-2',
  active: false,
  revokedBy: 'bob',
  revokedAt: '2026-11-21T09:00:00.000Z',
  revokeReason: '临时收回测试资格',
  device: {
    ...ITEM.device,
    id: 'dev-uuid-2',
    deviceId: '11:22:33:44:55:66',
    deviceCode: null,
    macAddress: '11:22:33:44:55:66',
  },
}

function response(overrides: Partial<TestDevicesResponse> = {}): TestDevicesResponse {
  return {
    enabled: { adventure: true, sleep: true },
    items: [ITEM],
    total: 1,
    ...overrides,
  }
}

function idle(data: TestDevicesResponse | undefined) {
  return {
    data,
    isLoading: false,
    isFetching: false,
    error: null as Error | null,
    refetch: vi.fn(),
  }
}

let addMutate: ReturnType<typeof vi.fn>
let revokeMutate: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  addMutate = vi.fn()
  revokeMutate = vi.fn()
  mockAdd.mockReturnValue({
    mutate: addMutate,
    isPending: false,
    error: null,
  })
  mockRevoke.mockReturnValue({
    mutate: revokeMutate,
    isPending: false,
    error: null,
  })
  mockQuery.mockReturnValue(idle(response()))
  vi.spyOn(message, 'success').mockImplementation(() => undefined as never)
})

function renderPage() {
  return render(
    <MemoryRouter>
      <TestDevices />
    </MemoryRouter>,
  )
}

describe('测试设备白名单页面', () => {
  it('展示在册设备、状态、备注与添加信息', () => {
    renderPage()

    expect(screen.getByText('测试设备白名单')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'aa:bb:cc:dd:ee:ff' })).toHaveAttribute(
      'href',
      '/users/aa%3Abb%3Acc%3Add%3Aee%3Aff',
    )
    expect(screen.queryByText('CN-001')).toBeNull()
    expect(screen.queryByText('未登记设备编码')).toBeNull()
    expect(screen.queryByText('MAC')).toBeNull()
    expect(screen.getByText('在册')).toBeTruthy()
    expect(screen.getByText('3 号样机')).toBeTruthy()
    expect(screen.getByText(/alice/)).toBeTruthy()
  })

  it('两个测试开关都关时给只读提示并禁用添加', () => {
    mockQuery.mockReturnValue(
      idle(response({ enabled: { adventure: false, sleep: false } })),
    )

    renderPage()

    expect(screen.getByText(/当前环境未开启测试模式/)).toBeTruthy()
    expect(
      screen.getByRole('button', { name: /添加到白名单/ }),
    ).toBeDisabled()
  })

  it('添加成功后清空表单并提示', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(
      screen.getByPlaceholderText('设备 ID / 设备编码 / MAC'),
      'CN-001',
    )
    await user.type(screen.getByPlaceholderText('备注（可选）'), '3 号样机')
    await user.type(
      screen.getByPlaceholderText('变更理由（至少 8 个字）'),
      '需要验证新一集内容',
    )
    await user.click(screen.getByRole('button', { name: /添加到白名单/ }))

    expect(addMutate).toHaveBeenCalledTimes(1)
    const [payload, options] = addMutate.mock.calls[0]
    expect(payload).toEqual({
      deviceId: 'CN-001',
      note: '3 号样机',
      reason: '需要验证新一集内容',
    })

    options.onSuccess({ item: ITEM, reactivated: false })
    await waitFor(() =>
      expect(message.success).toHaveBeenCalledWith(
        expect.stringContaining('aa:bb:cc:dd:ee:ff'),
      ),
    )
    expect(
      screen.getByPlaceholderText('设备 ID / 设备编码 / MAC'),
    ).toHaveValue('')
  })

  it('理由不足 8 字时前端先拦住，不发请求', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(
      screen.getByPlaceholderText('设备 ID / 设备编码 / MAC'),
      'CN-001',
    )
    await user.type(
      screen.getByPlaceholderText('变更理由（至少 8 个字）'),
      '太短',
    )
    await user.click(screen.getByRole('button', { name: /添加到白名单/ }))

    expect(await screen.findByText('理由至少 8 个字')).toBeTruthy()
    expect(addMutate).not.toHaveBeenCalled()
  })

  it('服务端拒绝时把原因原样展示出来', () => {
    mockAdd.mockReturnValue({
      mutate: addMutate,
      isPending: false,
      error: new Error('这台设备已经在测试白名单里。'),
    })

    renderPage()

    expect(screen.getByText('这台设备已经在测试白名单里。')).toBeTruthy()
  })

  it('撤销走理由弹窗，成功后提示已清空下发', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /撤\s*销/ }))
    await user.type(
      screen.getByPlaceholderText('撤销理由（至少 8 个字）'),
      '验证结束，收回资格',
    )
    await user.click(screen.getByRole('button', { name: /确认撤销/ }))

    expect(revokeMutate).toHaveBeenCalledTimes(1)
    const [payload, options] = revokeMutate.mock.calls[0]
    expect(payload).toEqual({
      deviceId: 'aa:bb:cc:dd:ee:ff',
      reason: '验证结束，收回资格',
    })

    options.onSuccess({ ok: true, clearedAdventureAssignment: true })
    await waitFor(() =>
      expect(message.success).toHaveBeenCalledWith(
        expect.stringContaining('已清空该设备的测试冒险下发'),
      ),
    )
  })

  it('切换「显示已撤销」后带上 includeRevoked 重新查询', async () => {
    const user = userEvent.setup()
    mockQuery.mockReturnValue(idle(response({ items: [ITEM, REVOKED] })))

    renderPage()

    await user.click(screen.getByRole('switch'))
    expect(mockQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ includeRevoked: true }),
    )
  })

  it('搜索词提交后进入查询参数', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(
      screen.getByPlaceholderText('按设备号 / 编码 / MAC 搜索'),
      'CN-001{enter}',
    )

    expect(mockQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ keyword: 'CN-001' }),
    )
  })

  it('查询失败时显示错误，不伪装成空列表', () => {
    mockQuery.mockReturnValue({
      ...idle(undefined),
      error: new Error('boom'),
    })

    renderPage()

    expect(screen.getByText('白名单加载失败')).toBeTruthy()
    expect(screen.getByText('boom')).toBeTruthy()
  })
})
