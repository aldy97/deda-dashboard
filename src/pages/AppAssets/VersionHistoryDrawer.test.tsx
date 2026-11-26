import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { message } from 'antd'
import VersionHistoryDrawer from './VersionHistoryDrawer'
import {
  useAppAssetVersions,
  useArchiveAppAsset,
  usePublishAppAsset,
} from '../../api/appAssets'
import type { AppAsset, AppAssetGroup } from '../../types/appAssets'

/**
 * 版本历史抽屉行为契约。
 *
 * 版本列表按服务端返回顺序渲染；发布 / 回滚 / 下架都要 Popconfirm 二次确认，
 * 确认后才发对应 POST。加载 / 失败 / 空态也要有落点。
 */
vi.mock('../../api/appAssets', () => ({
  useAppAssetVersions: vi.fn(),
  usePublishAppAsset: vi.fn(),
  useArchiveAppAsset: vi.fn(),
}))

const mockVersions = useAppAssetVersions as unknown as ReturnType<typeof vi.fn>
const mockPublish = usePublishAppAsset as unknown as ReturnType<typeof vi.fn>
const mockArchive = useArchiveAppAsset as unknown as ReturnType<typeof vi.fn>

const publishMutate = vi.fn()
const archiveMutate = vi.fn()

const KEY = 'home/banner'

function makeAsset(overrides: Partial<AppAsset> = {}): AppAsset {
  return {
    id: 'asset-1',
    key: KEY,
    version: 1,
    url: 'https://cdn.example.com/banner.png',
    width: 800,
    height: 600,
    mimeType: 'image/png',
    bytes: 2048,
    note: '初始版本',
    status: 'archived',
    createdBy: 'alice',
    createdAt: '2026-11-25T09:00:00+08:00',
    updatedAt: '2026-11-25T09:00:00+08:00',
    publishedAt: '2026-11-25T09:00:00+08:00',
    ...overrides,
  }
}

const ARCHIVED = makeAsset({ id: 'asset-1', version: 1, status: 'archived' })
const PUBLISHED = makeAsset({
  id: 'asset-2',
  version: 2,
  status: 'published',
  note: null,
})
const DRAFT = makeAsset({
  id: 'asset-3',
  version: 3,
  status: 'draft',
  note: '新版',
  publishedAt: null,
})

const GROUP: AppAssetGroup = {
  key: KEY,
  label: '首页 Banner',
  page: 'home',
  enabled: true,
  published: PUBLISHED,
  latestDraft: DRAFT,
  versions: [DRAFT, PUBLISHED, ARCHIVED],
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

function renderDrawer(group: AppAssetGroup | null = GROUP) {
  return render(<VersionHistoryDrawer group={group} onClose={vi.fn()} />)
}

beforeEach(() => {
  mockVersions.mockReset()
  mockPublish.mockReset()
  mockArchive.mockReset()
  publishMutate.mockReset()
  archiveMutate.mockReset()
  mockVersions.mockReturnValue({
    data: [DRAFT, PUBLISHED, ARCHIVED],
    isLoading: false,
    isError: false,
    error: null,
  })
  mockPublish.mockReturnValue({ ...mutationMock(), mutate: publishMutate })
  mockArchive.mockReturnValue({ ...mutationMock(), mutate: archiveMutate })
  vi.spyOn(message, 'success').mockImplementation(() => undefined as never)
})

describe('VersionHistoryDrawer 渲染', () => {
  it('按降序渲染版本、状态、尺寸、大小与操作人', async () => {
    renderDrawer()

    expect(await screen.findByText('v3')).toBeInTheDocument()
    expect(screen.getByText('v2')).toBeInTheDocument()
    expect(screen.getByText('v1')).toBeInTheDocument()
    expect(screen.getByText('草稿')).toBeInTheDocument()
    expect(screen.getByText('已发布')).toBeInTheDocument()
    expect(screen.getByText('已下架')).toBeInTheDocument()
    expect(screen.getAllByText(/800 × 600/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/2\.0 KB/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/alice/).length).toBeGreaterThan(0)
  })

  it('加载中显示 loading，不报错', () => {
    mockVersions.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    })
    renderDrawer()

    expect(screen.getByText('版本历史')).toBeInTheDocument()
  })

  it('加载失败显示错误 Alert 与服务端 message', async () => {
    mockVersions.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('历史接口 500'),
    })
    renderDrawer()

    expect(await screen.findByText('版本历史加载失败')).toBeInTheDocument()
    expect(screen.getByText('历史接口 500')).toBeInTheDocument()
  })

  it('空版本列表给空态文案', async () => {
    mockVersions.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    })
    renderDrawer()

    expect(
      await screen.findByText('该展示位还没有任何版本'),
    ).toBeInTheDocument()
  })
})

describe('VersionHistoryDrawer 发布 / 回滚 / 下架', () => {
  it('草稿可发布：确认后发 publish', async () => {
    renderDrawer()
    await screen.findByText('v3')

    await userEvent.click(screen.getByRole('button', { name: /发\s*布/ }))
    await userEvent.click(
      await screen.findByRole('button', { name: /确\s*认/ }),
    )

    await waitFor(() =>
      expect(publishMutate).toHaveBeenCalledWith(
        DRAFT.id,
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      ),
    )
    ;(publishMutate.mock.calls[0][1] as { onSuccess: () => void }).onSuccess()
    expect(message.success).toHaveBeenCalledWith('已发布')
  })

  it('历史版本可回滚：确认后发 publish', async () => {
    renderDrawer()
    await screen.findByText('v1')

    await userEvent.click(
      screen.getByRole('button', { name: /回滚到此版本/ }),
    )
    await userEvent.click(
      await screen.findByRole('button', { name: /确\s*认/ }),
    )

    await waitFor(() =>
      expect(publishMutate).toHaveBeenCalledWith(
        ARCHIVED.id,
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      ),
    )
    ;(publishMutate.mock.calls[0][1] as { onSuccess: () => void }).onSuccess()
    expect(message.success).toHaveBeenCalledWith('已回滚')
  })

  it('已发布版本可下架：确认后发 archive', async () => {
    renderDrawer()
    await screen.findByText('v2')

    await userEvent.click(screen.getByRole('button', { name: /下\s*架/ }))
    await userEvent.click(
      await screen.findByRole('button', { name: /确\s*认/ }),
    )

    await waitFor(() =>
      expect(archiveMutate).toHaveBeenCalledWith(
        PUBLISHED.id,
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      ),
    )
    ;(archiveMutate.mock.calls[0][1] as { onSuccess: () => void }).onSuccess()
    expect(message.success).toHaveBeenCalledWith('已下架')
  })
})

describe('VersionHistoryDrawer 预览', () => {
  it('点预览打开模态框展示大图', async () => {
    renderDrawer()
    await screen.findByText('v2')

    const previewButtons = screen.getAllByRole('button', { name: /预\s*览/ })
    await userEvent.click(previewButtons[0])

    expect(await screen.findByText('首页 Banner v3')).toBeInTheDocument()
    expect(screen.getAllByAltText(`${KEY} v3`).length).toBeGreaterThan(0)

    // 与列表页的预览弹窗同口径：外层容器负责居中，否则小图贴左。
    expect(screen.getByTestId('version-preview')).toHaveStyle({
      textAlign: 'center',
    })
  })
})
