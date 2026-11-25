import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { message } from 'antd'
import { apiClient } from '../../api/client'
import { copyText } from './clipboard'
import AppAssets from './index'
import type { AppAsset, AppAssetGroup, AppAssetKey } from '../../types/appAssets'

/**
 * 列表页行为契约。
 *
 * 上传 / 版本历史两个抽屉都替身掉（各自有独立测试），本页只考核：
 * 1. 按 key 分组渲染，字段齐全（缩略图 / 尺寸 / 大小 / 状态 / 时间 / 操作人）；
 * 2. 注册表为空与只有内置诊断位时给空态说明；
 * 3. 发布 / 下架都要 Popconfirm 二次确认，确认后才真的发 POST。
 */
vi.mock('../../api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
}))

vi.mock('./AssetUploadDrawer', () => ({
  default: (props: { open: boolean; presetKey?: string | null }) => (
    <div
      data-testid="upload-drawer"
      data-open={String(props.open)}
      data-preset={props.presetKey ?? ''}
    />
  ),
}))

vi.mock('./VersionHistoryDrawer', () => ({
  default: (props: { group: AppAssetGroup | null }) => (
    <div
      data-testid="history-drawer"
      data-open={String(props.group !== null)}
      data-key={props.group?.key ?? ''}
    />
  ),
}))

vi.mock('./clipboard', () => ({ copyText: vi.fn() }))

const mockGet = apiClient.get as unknown as ReturnType<typeof vi.fn>
const mockPost = apiClient.post as unknown as ReturnType<typeof vi.fn>
const mockCopyText = copyText as unknown as ReturnType<typeof vi.fn>

const DIAGNOSTIC_KEY = 'diagnostics/remote-probe'
const BUSINESS_KEY = 'home/banner'

const DIAGNOSTIC: AppAssetKey = {
  key: DIAGNOSTIC_KEY,
  label: '远程素材探针',
  page: 'asset-selftest',
}
const BUSINESS: AppAssetKey = {
  key: BUSINESS_KEY,
  label: '首页 Banner',
  page: 'home',
}

function makeAsset(overrides: Partial<AppAsset> = {}): AppAsset {
  return {
    id: 'asset-1',
    key: BUSINESS_KEY,
    version: 2,
    url: 'https://cdn.example.com/banner.png',
    width: 800,
    height: 600,
    mimeType: 'image/png',
    bytes: 2048,
    note: null,
    status: 'published',
    createdBy: 'alice',
    createdAt: '2026-11-25T09:00:00+08:00',
    updatedAt: '2026-11-25T09:30:00+08:00',
    publishedAt: '2026-11-25T09:30:00+08:00',
    ...overrides,
  }
}

const PUBLISHED = makeAsset()
const DRAFT = makeAsset({
  id: 'asset-2',
  version: 3,
  status: 'draft',
  publishedAt: null,
  note: '新版 Banner',
})

const BUSINESS_GROUP: AppAssetGroup = {
  key: BUSINESS_KEY,
  label: '首页 Banner',
  page: 'home',
  published: PUBLISHED,
  latestDraft: DRAFT,
  versions: [DRAFT, PUBLISHED],
}

const DIAGNOSTIC_GROUP: AppAssetGroup = {
  key: DIAGNOSTIC_KEY,
  label: '远程素材探针',
  page: 'asset-selftest',
  published: null,
  latestDraft: null,
  versions: [],
}

function stubServer(opts: {
  keys?: AppAssetKey[] | null
  assets?: AppAssetGroup[] | null
  keysError?: Error
  assetsError?: Error
} = {}) {
  const { keys = [BUSINESS], assets = [BUSINESS_GROUP] } = opts
  mockGet.mockImplementation((url: string) => {
    if (url === '/analytics/app-assets/keys') {
      if (opts.keysError) return Promise.reject(opts.keysError)
      if (keys === null) return new Promise(() => undefined)
      return Promise.resolve({ data: keys })
    }
    if (opts.assetsError) return Promise.reject(opts.assetsError)
    if (assets === null) return new Promise(() => undefined)
    return Promise.resolve({ data: assets })
  })
  mockPost.mockResolvedValue({ data: PUBLISHED })
}

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

function renderPage() {
  return render(<AppAssets />, { wrapper: createWrapper() })
}

function rowFor(key: string): HTMLElement {
  const cell = screen.getByText(key)
  const row = cell.closest('tr')
  if (!row) throw new Error(`找不到 ${key} 所在行`)
  return row
}

beforeEach(() => {
  mockGet.mockReset()
  mockPost.mockReset()
  mockCopyText.mockReset()
  mockCopyText.mockResolvedValue(true)
  vi.spyOn(message, 'success').mockImplementation(() => undefined as never)
  vi.spyOn(message, 'error').mockImplementation(() => undefined as never)
})

describe('AppAssets 列表渲染', () => {
  it('按 key 分组渲染：label / key / page / 版本 / 缩略图 / 尺寸 / 大小 / 状态 / 时间 / 操作人', async () => {
    stubServer()
    renderPage()

    expect(await screen.findByText('首页 Banner')).toBeInTheDocument()
    expect(screen.getByText(BUSINESS_KEY)).toBeInTheDocument()
    expect(screen.getByText('home')).toBeInTheDocument()
    expect(screen.getByText('v2')).toBeInTheDocument()
    expect(screen.getByAltText(`${BUSINESS_KEY} 缩略图`)).toBeInTheDocument()
    expect(screen.getByText('800 × 600')).toBeInTheDocument()
    expect(screen.getByText('2.0 KB')).toBeInTheDocument()
    expect(screen.getByText('已发布 v2')).toBeInTheDocument()
    expect(screen.getByText('草稿 v3')).toBeInTheDocument()
    expect(screen.getByText('alice')).toBeInTheDocument()
    // 更新时间只断言日期部分，避免 CI（UTC）与本地时区钟点不一致
    expect(screen.getAllByText(/2026-11-25/).length).toBeGreaterThan(0)
  })

  it('展示位列有显式宽度，表格横向滚动而不是把列压塌', async () => {
    stubServer()
    const { container } = renderPage()

    await screen.findByText('首页 Banner')

    const table = container.querySelector(
      '.ant-table-content table',
    ) as HTMLTableElement | null
    expect(table).not.toBeNull()

    // 展示位列是不定宽列：不写 width 时，窄屏会被压到一两个字宽，
    // 中文与 code 逐字断行，行高从 91px 涨到 500px 以上。
    const colWidths = Array.from(table!.querySelectorAll('col')).map(
      (col) => col.style.width,
    )
    expect(colWidths[0]).toBe('240px')

    // scroll.x 生效的标志：表格最小宽度 100%，不装 scroll 时没有这个内联样式，
    // 浏览器会把所有列压向 min-content。
    expect(table!.style.minWidth).toBe('100%')
  })

  it('未发布且无草稿的展示位渲染「未发布」与占位', async () => {
    stubServer({ keys: [DIAGNOSTIC], assets: [DIAGNOSTIC_GROUP] })
    renderPage()

    expect(await screen.findByText('远程素材探针')).toBeInTheDocument()
    expect(screen.getAllByText('未发布').length).toBeGreaterThan(0)
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('注册表为空：显示空态说明，且「新建版本」按钮禁用', async () => {
    stubServer({ keys: [], assets: [] })
    renderPage()

    expect(await screen.findByText(/展示位注册表为空/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '新建版本' })).toBeDisabled()
  })

  it('只有内置诊断位：显示说明 Alert，不误报成业务素材', async () => {
    stubServer({ keys: [DIAGNOSTIC], assets: [DIAGNOSTIC_GROUP] })
    renderPage()

    expect(
      await screen.findByText('当前只有内置诊断展示位'),
    ).toBeInTheDocument()
    expect(screen.getAllByText(/远程素材探针/).length).toBeGreaterThan(0)
  })

  it('展示位注册表加载失败：显示错误 Alert 与服务端 message', async () => {
    stubServer({ keysError: new Error('后端 500 了') })
    renderPage()

    expect(
      await screen.findByText('展示位注册表加载失败'),
    ).toBeInTheDocument()
    expect(screen.getByText('后端 500 了')).toBeInTheDocument()
  })

  it('素材列表加载失败：显示错误 Alert 与服务端 message', async () => {
    stubServer({ assetsError: new Error('列表炸了') })
    renderPage()

    expect(await screen.findByText('素材列表加载失败')).toBeInTheDocument()
    expect(screen.getByText('列表炸了')).toBeInTheDocument()
  })
})

describe('AppAssets 新建版本抽屉', () => {
  it('顶部「新建版本」打开抽屉，不预选 key', async () => {
    stubServer()
    renderPage()

    await screen.findByText('首页 Banner')
    // 顶部（PageHeader）与行内各有一个「新建版本」，顶部是第一个
    await userEvent.click(
      screen.getAllByRole('button', { name: '新建版本' })[0],
    )

    const drawer = screen.getByTestId('upload-drawer')
    expect(drawer.dataset.open).toBe('true')
    expect(drawer.dataset.preset).toBe('')
  })

  it('行内「新建版本」打开抽屉并预选该 key', async () => {
    stubServer()
    renderPage()

    await screen.findByText('首页 Banner')
    const row = rowFor(BUSINESS_KEY)
    await userEvent.click(
      within(row).getByRole('button', { name: '新建版本' }),
    )

    const drawer = screen.getByTestId('upload-drawer')
    expect(drawer.dataset.open).toBe('true')
    expect(drawer.dataset.preset).toBe(BUSINESS_KEY)
  })
})

describe('AppAssets 发布 / 下架确认', () => {
  it('发布草稿：取消不发起 POST，确认才发 publish', async () => {
    stubServer()
    renderPage()
    await screen.findByText('首页 Banner')

    const row = rowFor(BUSINESS_KEY)
    await userEvent.click(within(row).getByRole('button', { name: /发\s*布/ }))
    await userEvent.click(
      await screen.findByRole('button', { name: /取\s*消/ }),
    )
    expect(mockPost).not.toHaveBeenCalled()

    await userEvent.click(within(row).getByRole('button', { name: /发\s*布/ }))
    await userEvent.click(
      await screen.findByRole('button', { name: /确\s*认/ }),
    )

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        '/analytics/app-assets/asset-2/publish',
      ),
    )
    expect(message.success).toHaveBeenCalledWith('已发布')
  })

  it('下架：确认后发 archive', async () => {
    stubServer()
    renderPage()
    await screen.findByText('首页 Banner')

    const row = rowFor(BUSINESS_KEY)
    await userEvent.click(within(row).getByRole('button', { name: /下\s*架/ }))
    await userEvent.click(
      await screen.findByRole('button', { name: /确\s*认/ }),
    )

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        '/analytics/app-assets/asset-1/archive',
      ),
    )
    expect(message.success).toHaveBeenCalledWith('已下架')
  })
})

describe('AppAssets 预览与复制 URL', () => {
  it('预览打开模态框展示大图', async () => {
    stubServer()
    renderPage()
    await screen.findByText('首页 Banner')

    await userEvent.click(
      within(rowFor(BUSINESS_KEY)).getByRole('button', { name: /预\s*览/ }),
    )

    expect(await screen.findByAltText(`${BUSINESS_KEY} v2`)).toBeInTheDocument()
    expect(screen.getByText('预览 v2')).toBeInTheDocument()
  })

  it('复制 URL：成功后提示并改变按钮文案', async () => {
    stubServer()
    renderPage()
    await screen.findByText('首页 Banner')

    await userEvent.click(
      within(rowFor(BUSINESS_KEY)).getByRole('button', {
        name: /复制\s*URL/,
      }),
    )

    expect(mockCopyText).toHaveBeenCalledWith(PUBLISHED.url)
    await waitFor(() =>
      expect(message.success).toHaveBeenCalledWith('已复制 URL'),
    )
    expect(
      within(rowFor(BUSINESS_KEY)).getByRole('button', { name: '已复制' }),
    ).toBeInTheDocument()
  })
})

describe('AppAssets 版本历史抽屉', () => {
  it('点「版本历史」打开对应 key 的抽屉', async () => {
    stubServer()
    renderPage()
    await screen.findByText('首页 Banner')

    await userEvent.click(
      within(rowFor(BUSINESS_KEY)).getByRole('button', {
        name: /版本历史/,
      }),
    )

    const drawer = screen.getByTestId('history-drawer')
    expect(drawer.dataset.open).toBe('true')
    expect(drawer.dataset.key).toBe(BUSINESS_KEY)
  })
})
