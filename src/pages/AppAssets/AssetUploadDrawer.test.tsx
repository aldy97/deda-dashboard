import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { message } from 'antd'
import AssetUploadDrawer from './AssetUploadDrawer'
import {
  usePublishAppAsset,
  useUploadAppAsset,
} from '../../api/appAssets'
import {
  readImageDimensions,
  validateAssetFile,
} from './uploadRules'
import type { AppAsset, AppAssetKey } from '../../types/appAssets'

/**
 * 上传抽屉行为契约。
 *
 * 上传钩子与尺寸读取都替身掉（各自有独立测试），本组件只考核：
 * 1. 展示位从注册表下拉选择，没有选中 key 时上传按钮禁用；
 * 2. 文件合法 → 用 customRequest 发 multipart，成功后保存 draft 并可立即发布；
 * 3. 文件非法 / 尺寸读失败 → 本地错误提示，不发请求；上传失败 → 可重试。
 */
vi.mock('../../api/appAssets', () => ({
  useUploadAppAsset: vi.fn(),
  usePublishAppAsset: vi.fn(),
}))

vi.mock('./uploadRules', () => ({
  validateAssetFile: vi.fn(),
  readImageDimensions: vi.fn(),
}))

const mockUpload = useUploadAppAsset as unknown as ReturnType<typeof vi.fn>
const mockPublish = usePublishAppAsset as unknown as ReturnType<typeof vi.fn>
const mockValidate = validateAssetFile as unknown as ReturnType<typeof vi.fn>
const mockReadDims = readImageDimensions as unknown as ReturnType<typeof vi.fn>

const KEY: AppAssetKey = {
  key: 'diagnostics/remote-probe',
  label: '远程素材探针',
  page: 'diagnostics',
  note: null,
  enabled: true,
  createdBy: null,
  updatedBy: null,
  createdAt: '2026-11-25T10:00:00+08:00',
  updatedAt: '2026-11-25T10:00:00+08:00',
}

const ASSET: AppAsset = {
  id: 'asset-1',
  key: KEY.key,
  version: 1,
  url: 'https://cdn.example.com/a.png',
  width: 800,
  height: 600,
  mimeType: 'image/png',
  bytes: 2048,
  note: null,
  status: 'draft',
  createdBy: 'superadmin',
  createdAt: '2026-11-25T10:00:00+08:00',
  updatedAt: '2026-11-25T10:00:00+08:00',
  publishedAt: null,
}

function mutationMock(overrides: Record<string, unknown> = {}) {
  return {
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    reset: vi.fn(),
    ...overrides,
  }
}

const uploadMutate = vi.fn()
const publishMutate = vi.fn()

function renderDrawer(props: Partial<Parameters<typeof AssetUploadDrawer>[0]> = {}) {
  const defaultProps = {
    open: true,
    keys: [KEY],
    presetKey: null,
    onClose: vi.fn(),
    ...props,
  }
  return render(<AssetUploadDrawer {...defaultProps} />)
}

function fileInput(): HTMLInputElement {
  const input = document.querySelector('input[type="file"]')
  if (!input) throw new Error('找不到文件输入框')
  return input as HTMLInputElement
}

function makeFile(name = 'a.png', size = 100, type = 'image/png'): File {
  return new File([new Uint8Array(size)], name, { type })
}

beforeEach(() => {
  mockUpload.mockReset()
  mockPublish.mockReset()
  mockValidate.mockReset()
  mockReadDims.mockReset()
  uploadMutate.mockReset()
  publishMutate.mockReset()
  mockUpload.mockReturnValue({ ...mutationMock(), mutate: uploadMutate })
  mockPublish.mockReturnValue({ ...mutationMock(), mutate: publishMutate })
  vi.spyOn(message, 'success').mockImplementation(() => undefined as never)
  vi.spyOn(message, 'error').mockImplementation(() => undefined as never)
})

describe('AssetUploadDrawer 展示位选择', () => {
  it('没有选中 key 时上传按钮禁用', () => {
    renderDrawer()

    expect(
      screen.getByRole('button', { name: /选择图片并上传/ }),
    ).toBeDisabled()
  })

  it('注册表为空时显示说明，不渲染上传区', () => {
    renderDrawer({ keys: [] })

    expect(screen.getByText('展示位注册表为空')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /选择图片并上传/ }),
    ).toBeNull()
  })

  it('预选 key 后上传按钮可用', () => {
    renderDrawer({ presetKey: KEY.key })

    expect(
      screen.getByRole('button', { name: /选择图片并上传/ }),
    ).toBeEnabled()
  })

  it('展示位下拉来自注册表（含 label 与 key）', async () => {
    renderDrawer()

    await userEvent.click(screen.getByRole('combobox'))
    expect(
      await screen.findByText('远程素材探针（diagnostics/remote-probe）'),
    ).toBeInTheDocument()
  })
})

describe('AssetUploadDrawer 上传', () => {
  it('文件合法时通过 customRequest 发 multipart，成功后保存 draft 并可立即发布', async () => {
    mockValidate.mockReturnValue(null)
    mockReadDims.mockResolvedValue({ width: 800, height: 600 })
    renderDrawer({ presetKey: KEY.key })

    await userEvent.type(
      screen.getByPlaceholderText('例如：新一版探针占位图'),
      '新一版',
    )
    await userEvent.upload(fileInput(), makeFile())

    await waitFor(() => expect(uploadMutate).toHaveBeenCalledTimes(1))
    const [payload, options] = uploadMutate.mock.calls[0] as [
      {
        key: string
        file: File
        width: number
        height: number
        note: string
      },
      { onSuccess: (asset: AppAsset) => void },
    ]
    expect(payload.key).toBe(KEY.key)
    expect(payload.file.name).toBe('a.png')
    expect(payload.width).toBe(800)
    expect(payload.height).toBe(600)
    expect(payload.note).toBe('新一版')

    // 模拟上传成功
    options.onSuccess(ASSET)

    expect(await screen.findByText('草稿已保存')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /立即发布/ }),
    ).toBeInTheDocument()
  })

  it('上传进度透传给 antd，并驱动进度条', async () => {
    mockValidate.mockReturnValue(null)
    mockReadDims.mockResolvedValue({ width: 800, height: 600 })
    mockUpload.mockReturnValue({
      ...mutationMock(),
      mutate: uploadMutate,
      isPending: true,
    })
    renderDrawer({ presetKey: KEY.key })

    await userEvent.upload(fileInput(), makeFile())
    await waitFor(() => expect(uploadMutate).toHaveBeenCalledTimes(1))

    const [payload] = uploadMutate.mock.calls[0] as [
      { onProgress: (percent: number) => void },
    ]
    act(() => {
      payload.onProgress(42)
    })

    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '42',
    )
  })

  it('上传失败的 error 透传给 antd，不误报草稿已保存', async () => {
    mockValidate.mockReturnValue(null)
    mockReadDims.mockResolvedValue({ width: 800, height: 600 })
    renderDrawer({ presetKey: KEY.key })

    await userEvent.upload(fileInput(), makeFile())
    await waitFor(() => expect(uploadMutate).toHaveBeenCalledTimes(1))

    const [, options] = uploadMutate.mock.calls[0] as [
      unknown,
      { onError: (err: Error) => void },
    ]
    act(() => {
      options.onError(new Error('后端拒绝'))
    })

    expect(screen.queryByText('草稿已保存')).toBeNull()
  })

  it('没有待上传文件时点重试不发请求', async () => {
    mockUpload.mockReturnValue({
      ...mutationMock(),
      mutate: uploadMutate,
      isError: true,
      error: new Error('上传失败：后端拒绝'),
    })
    renderDrawer({ presetKey: KEY.key })

    await userEvent.click(
      await screen.findByRole('button', { name: /重\s*试/ }),
    )

    expect(uploadMutate).not.toHaveBeenCalled()
  })

  it('文件不合法时提示错误，不发请求', async () => {
    // 类型不合法会被 Upload 的 accept 先拦住；这里用「超过 2MB」走 validateAssetFile 分支
    mockValidate.mockReturnValue('图片不能超过 2MB')
    renderDrawer({ presetKey: KEY.key })

    await userEvent.upload(
      fileInput(),
      makeFile('a.png', 3 * 1024 * 1024),
    )

    expect(await screen.findByText('图片不能超过 2MB')).toBeInTheDocument()
    expect(uploadMutate).not.toHaveBeenCalled()
  })

  it('尺寸读取失败时提示错误，不发请求', async () => {
    mockValidate.mockReturnValue(null)
    mockReadDims.mockRejectedValue(new Error('无法读取图片尺寸'))
    renderDrawer({ presetKey: KEY.key })

    await userEvent.upload(fileInput(), makeFile())

    expect(await screen.findByText('无法读取图片尺寸')).toBeInTheDocument()
    expect(uploadMutate).not.toHaveBeenCalled()
  })

  it('上传失败显示服务端原因与重试按钮，点重试再发一次', async () => {
    mockValidate.mockReturnValue(null)
    mockReadDims.mockResolvedValue({ width: 800, height: 600 })
    const failingUpload = {
      ...mutationMock(),
      mutate: uploadMutate,
      isError: true,
      error: new Error('上传失败：后端拒绝'),
    }
    mockUpload.mockReturnValue(failingUpload)
    renderDrawer({ presetKey: KEY.key })

    await userEvent.upload(fileInput(), makeFile())
    await waitFor(() => expect(uploadMutate).toHaveBeenCalledTimes(1))

    expect(await screen.findByText('上传失败')).toBeInTheDocument()
    expect(screen.getByText('上传失败：后端拒绝')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /重\s*试/ }))
    expect(uploadMutate).toHaveBeenCalledTimes(2)
  })
})

describe('AssetUploadDrawer 立即发布', () => {
  it('上传成功后点立即发布，调用 publish 并在成功时关闭抽屉', async () => {
    const onClose = vi.fn()
    mockValidate.mockReturnValue(null)
    mockReadDims.mockResolvedValue({ width: 800, height: 600 })
    renderDrawer({ presetKey: KEY.key, onClose })

    await userEvent.upload(fileInput(), makeFile())
    await waitFor(() => expect(uploadMutate).toHaveBeenCalledTimes(1))
    ;(uploadMutate.mock.calls[0][1] as { onSuccess: (a: AppAsset) => void }).onSuccess(
      ASSET,
    )

    await userEvent.click(
      await screen.findByRole('button', { name: /立即发布/ }),
    )

    expect(publishMutate).toHaveBeenCalledWith(
      ASSET.id,
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
    ;(publishMutate.mock.calls[0][1] as { onSuccess: () => void }).onSuccess()

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(message.success).toHaveBeenCalledWith('已发布')
  })
})
