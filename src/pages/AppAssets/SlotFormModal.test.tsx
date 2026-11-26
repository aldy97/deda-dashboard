import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { message } from 'antd'
import SlotFormModal from './SlotFormModal'
import {
  useCreateAppAssetKey,
  useUpdateAppAssetKey,
} from '../../api/appAssets'
import { copyText } from '../../utils/clipboard'
import type { AppAssetKey } from '../../types/appAssets'

vi.mock('../../api/appAssets', () => ({
  useCreateAppAssetKey: vi.fn(),
  useUpdateAppAssetKey: vi.fn(),
}))

vi.mock('../../utils/clipboard', () => ({ copyText: vi.fn() }))

const mockCreate = useCreateAppAssetKey as unknown as ReturnType<typeof vi.fn>
const mockUpdate = useUpdateAppAssetKey as unknown as ReturnType<typeof vi.fn>
const mockCopy = copyText as unknown as ReturnType<typeof vi.fn>

const SLOT: AppAssetKey = {
  key: 'device-home/hero',
  label: '首页主视觉',
  page: 'device-home',
  note: '设计稿 A',
  enabled: true,
  createdBy: 'alice',
  updatedBy: 'alice',
  createdAt: '2026-11-25T10:00:00+08:00',
  updatedAt: '2026-11-25T10:00:00+08:00',
}

function mutationMock(overrides: Record<string, unknown> = {}) {
  return {
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    ...overrides,
  }
}

const createMutate = vi.fn()
const updateMutate = vi.fn()

beforeEach(() => {
  mockCreate.mockReset()
  mockUpdate.mockReset()
  mockCopy.mockReset()
  createMutate.mockReset()
  updateMutate.mockReset()
  mockCreate.mockReturnValue({ ...mutationMock(), mutate: createMutate })
  mockUpdate.mockReturnValue({ ...mutationMock(), mutate: updateMutate })
  vi.spyOn(message, 'success').mockImplementation(() => undefined as never)
  vi.spyOn(message, 'error').mockImplementation(() => undefined as never)
})

describe('SlotFormModal 新建', () => {
  it('提交 page / suffix / label / note，并展示拼接后的 key', async () => {
    const onClose = vi.fn()
    render(
      <SlotFormModal open mode="create" onClose={onClose} />,
    )

    await userEvent.type(screen.getByLabelText('页面 code'), 'device-home')
    await userEvent.type(screen.getByLabelText('展示位后缀'), 'hero')
    await userEvent.type(screen.getByLabelText('中文标签'), '首页主视觉')
    await userEvent.type(screen.getByLabelText('备注'), '设计稿 A')

    expect(screen.getByText('device-home/hero')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /创\s*建/ }))

    await waitFor(() =>
      expect(createMutate).toHaveBeenCalledWith(
        {
          page: 'device-home',
          suffix: 'hero',
          label: '首页主视觉',
          note: '设计稿 A',
        },
        expect.any(Object),
      ),
    )
  })

  it('创建成功提示并关闭；失败展示服务端文案', async () => {
    const onClose = vi.fn()
    render(<SlotFormModal open mode="create" onClose={onClose} />)

    await userEvent.type(screen.getByLabelText('页面 code'), 'device-home')
    await userEvent.type(screen.getByLabelText('展示位后缀'), 'hero')
    await userEvent.type(screen.getByLabelText('中文标签'), '首页主视觉')
    await userEvent.click(screen.getByRole('button', { name: /创\s*建/ }))

    const options = createMutate.mock.calls[0][1] as {
      onSuccess: (slot: AppAssetKey) => void
      onError: (err: Error) => void
    }
    options.onError(new Error('展示位已存在：device-home/hero'))
    expect(
      await screen.findByText('展示位已存在：device-home/hero'),
    ).toBeInTheDocument()

    options.onSuccess(SLOT)
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(message.success).toHaveBeenCalledWith(
      '已新建展示位 device-home/hero',
    )
  })

  it('取消不提交', async () => {
    const onClose = vi.fn()
    render(<SlotFormModal open mode="create" onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: /取\s*消/ }))

    expect(onClose).toHaveBeenCalled()
    expect(createMutate).not.toHaveBeenCalled()
  })
})

describe('SlotFormModal 编辑', () => {
  it('key 只读，提交 label / note', async () => {
    const onClose = vi.fn()
    render(
      <SlotFormModal open mode="edit" slot={SLOT} onClose={onClose} />,
    )

    expect(screen.getByDisplayValue(SLOT.key)).toBeDisabled()
    await userEvent.clear(screen.getByLabelText('中文标签'))
    await userEvent.type(screen.getByLabelText('中文标签'), '新标签')
    await userEvent.click(screen.getByRole('button', { name: /保\s*存/ }))

    await waitFor(() =>
      expect(updateMutate).toHaveBeenCalledWith(
        {
          key: SLOT.key,
          label: '新标签',
          note: '设计稿 A',
        },
        expect.any(Object),
      ),
    )
  })

  it('复制 key', async () => {
    mockCopy.mockResolvedValue(true)
    render(<SlotFormModal open mode="edit" slot={SLOT} onClose={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /复制\s*key/ }))

    expect(mockCopy).toHaveBeenCalledWith(SLOT.key)
    await waitFor(() =>
      expect(message.success).toHaveBeenCalledWith('已复制 key'),
    )
  })
})

describe('SlotFormModal 边界', () => {
  it('必填未填时不提交', async () => {
    render(<SlotFormModal open mode="create" onClose={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /创\s*建/ }))

    expect(await screen.findByText('请填写页面 code')).toBeInTheDocument()
    expect(createMutate).not.toHaveBeenCalled()
  })

  it('创建失败时非 Error 走兜底文案', async () => {
    render(<SlotFormModal open mode="create" onClose={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('页面 code'), 'device-home')
    await userEvent.type(screen.getByLabelText('展示位后缀'), 'hero')
    await userEvent.type(screen.getByLabelText('中文标签'), '首页主视觉')
    await userEvent.click(screen.getByRole('button', { name: /创\s*建/ }))

    const options = createMutate.mock.calls[0][1] as {
      onError: (err: Error) => void
    }
    options.onError('boom' as unknown as Error)

    expect(await screen.findByText('创建失败')).toBeInTheDocument()
  })

  it('编辑成功：清空备注发 null，并提示/关闭', async () => {
    const onClose = vi.fn()
    render(
      <SlotFormModal open mode="edit" slot={SLOT} onClose={onClose} />,
    )

    await userEvent.clear(screen.getByLabelText('备注'))
    await userEvent.click(screen.getByRole('button', { name: /保\s*存/ }))

    await waitFor(() =>
      expect(updateMutate).toHaveBeenCalledWith(
        { key: SLOT.key, label: SLOT.label, note: null },
        expect.any(Object),
      ),
    )

    const options = updateMutate.mock.calls[0][1] as {
      onSuccess: (slot: AppAssetKey) => void
    }
    options.onSuccess(SLOT)

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(message.success).toHaveBeenCalledWith('展示位已更新')
  })

  it('编辑失败时非 Error 走兜底文案', async () => {
    render(
      <SlotFormModal open mode="edit" slot={SLOT} onClose={vi.fn()} />,
    )

    await userEvent.click(screen.getByRole('button', { name: /保\s*存/ }))

    const options = updateMutate.mock.calls[0][1] as {
      onError: (err: Error) => void
    }
    options.onError('boom' as unknown as Error)

    expect(await screen.findByText('更新失败')).toBeInTheDocument()
  })

  it('编辑模式没有 slot 时即使校验通过也不提交', async () => {
    render(<SlotFormModal open mode="edit" onClose={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('中文标签'), 'x')
    await userEvent.click(screen.getByRole('button', { name: /保\s*存/ }))

    expect(updateMutate).not.toHaveBeenCalled()
  })

  it('复制失败提示手动复制', async () => {
    mockCopy.mockResolvedValue(false)
    render(
      <SlotFormModal open mode="edit" slot={SLOT} onClose={vi.fn()} />,
    )

    await userEvent.click(screen.getByRole('button', { name: /复制\s*key/ }))

    await waitFor(() =>
      expect(message.error).toHaveBeenCalledWith('复制失败，请手动复制'),
    )
  })

  it('关闭状态不渲染表单', () => {
    render(<SlotFormModal open={false} mode="create" onClose={vi.fn()} />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
