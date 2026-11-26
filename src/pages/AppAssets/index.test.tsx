import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { message } from 'antd'
import { apiClient } from '../../api/client'
import { copyText } from '../../utils/clipboard'
import AppAssets from './index'
import type { AppAsset, AppAssetGroup, AppAssetKey } from '../../types/appAssets'

/**
 * 列表页行为契约。
 *
 * 上传 / 版本历史 / 展示位表单三个弹层都替身掉（各自有独立测试），本页只考核：
 * 1. 按 key 分组渲染，字段齐全；
 * 2. 注册表为空 / 全部停用 / 只有内置诊断位的空态；
 * 3. 上传、发布、下架、停用、启用、复制 key 的入口与二次确认；
 * 4. 停用闸口：有 published 时入口禁用。
 */
vi.mock('../../api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
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

vi.mock('./SlotFormModal', () => ({
  default: (props: {
    open: boolean
    mode: string
    slot?: { key?: string } | null
    onClose?: () => void
  }) => (
    <div
      data-testid="slot-modal"
      data-open={String(props.open)}
      data-mode={props.mode}
      data-key={props.slot?.key ?? ''}
    >
      <button onClick={props.onClose}>关闭展示位表单</button>
    </div>
  ),
}))

vi.mock('../../utils/clipboard', () => ({ copyText: vi.fn() }))

const mockGet = apiClient.get as unknown as ReturnType<typeof vi.fn>
const mockPost = apiClient.post as unknown as ReturnType<typeof vi.fn>
const mockPatch = apiClient.patch as unknown as ReturnType<typeof vi.fn>
const mockCopyText = copyText as unknown as ReturnType<typeof vi.fn>

const DIAGNOSTIC_KEY = 'diagnostics/remote-probe'
const BUSINESS_KEY = 'home/banner'

function makeKey(
  overrides: Partial<AppAssetKey> & Pick<AppAssetKey, 'key' | 'label' | 'page'>,
): AppAssetKey {
  return {
    note: null,
    enabled: true,
    createdBy: null,
    updatedBy: null,
    createdAt: '2026-11-25T09:00:00+08:00',
    updatedAt: '2026-11-25T09:00:00+08:00',
    ...overrides,
  }
}

const DIAGNOSTIC: AppAssetKey = makeKey({
  key: DIAGNOSTIC_KEY,
  label: '远程素材探针',
  page: 'diagnostics',
})
const BUSINESS: AppAssetKey = makeKey({
  key: BUSINESS_KEY,
  label: '首页 Banner',
  page: 'home',
})

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
  enabled: true,
  published: PUBLISHED,
  latestDraft: DRAFT,
  versions: [DRAFT, PUBLISHED],
}

const DRAFT_ONLY_GROUP: AppAssetGroup = {
  ...BUSINESS_GROUP,
  published: null,
  latestDraft: DRAFT,
  versions: [DRAFT],
}

const DISABLED_GROUP: AppAssetGroup = {
  ...BUSINESS_GROUP,
  enabled: false,
  published: null,
  latestDraft: DRAFT,
  versions: [DRAFT],
}

const ORPHAN_GROUP: AppAssetGroup = {
  key: 'legacy/old',
  label: 'legacy/old',
  page: '',
  enabled: false,
  orphan: true,
  published: null,
  latestDraft: null,
  versions: [],
}

const DIAGNOSTIC_GROUP: AppAssetGroup = {
  key: DIAGNOSTIC_KEY,
  label: '远程素材探针',
  page: 'diagnostics',
  enabled: true,
  published: null,
  latestDraft: null,
  versions: [],
}

function stubServer(
  opts: {
    keys?: AppAssetKey[] | null
    assets?: AppAssetGroup[] | null
    keysError?: Error
    assetsError?: Error
  } = {},
) {
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
  mockPatch.mockResolvedValue({ data: BUSINESS })
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
  // 孤儿展示位的 label 与 key 都是同一个字符串，会出现两个文本节点；
  // 取第一个并上溯到同一行即可。
  const cell = screen.getAllByText(key)[0]
  const row = cell.closest('tr')
  if (!row) throw new Error(`找不到 ${key} 所在行`)
  return row
}

async function openRowMenu(key: string) {
  await userEvent.click(
    within(rowFor(key)).getByRole('button', { name: '操作' }),
  )
}

async function pickRowAction(name: string | RegExp) {
  await userEvent.click(await screen.findByRole('menuitem', { name }))
}

function menuLabels(): string[] {
  return screen.getAllByRole('menuitem').map((el) => el.textContent ?? '')
}

beforeEach(() => {
  mockGet.mockReset()
  mockPost.mockReset()
  mockPatch.mockReset()
  mockCopyText.mockReset()
  mockCopyText.mockResolvedValue(true)
  vi.spyOn(message, 'success').mockImplementation(() => undefined as never)
  vi.spyOn(message, 'error').mockImplementation(() => undefined as never)
})

describe('AppAssets 列表渲染', () => {
  it('按 key 分组渲染：label / key / 版本 / 缩略图 / 尺寸 / 大小 / 状态 / 时间 / 操作人', async () => {
    stubServer()
    renderPage()

    expect(
      await screen.findByRole('heading', { name: '图片素材' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('首页 Banner')).toBeInTheDocument()
    expect(screen.getByText(BUSINESS_KEY)).toBeInTheDocument()
    // 展示位第三行原本展示注册表里的 page code，现已移除
    expect(screen.queryByText('home')).toBeNull()
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

    const colWidths = Array.from(table!.querySelectorAll('col')).map(
      (col) => col.style.width,
    )
    expect(colWidths[0]).toBe('240px')
    expect(table!.style.minWidth).toBe('100%')
    expect(colWidths[colWidths.length - 1]).toBe('80px')
  })

  it('未发布且无草稿的展示位渲染「未发布」与占位', async () => {
    stubServer({ keys: [DIAGNOSTIC], assets: [DIAGNOSTIC_GROUP] })
    renderPage()

    expect(await screen.findByText('远程素材探针')).toBeInTheDocument()
    expect(screen.getAllByText('未发布').length).toBeGreaterThan(0)
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('停用与未注册展示位有明确标记', async () => {
    stubServer({
      keys: [BUSINESS],
      assets: [DISABLED_GROUP, ORPHAN_GROUP],
    })
    renderPage()

    expect(await screen.findByText('已停用')).toBeInTheDocument()
    expect(screen.getByText('未注册')).toBeInTheDocument()
  })

  it('注册表为空：仍允许新建第一个展示位，上传入口禁用', async () => {
    stubServer({ keys: [], assets: [] })
    renderPage()

    expect(await screen.findByText(/展示位注册表为空/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '新建展示位' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '上传新版本' })).toBeDisabled()
  })

  it('全部展示位停用：上传入口禁用并说明原因', async () => {
    stubServer({
      keys: [{ ...BUSINESS, enabled: false }],
      assets: [DISABLED_GROUP],
    })
    renderPage()

    expect(await screen.findByText('所有展示位已停用')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '上传新版本' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '新建展示位' })).toBeEnabled()
  })

  it('只有内置诊断位：显示说明 Alert，不误报成业务素材', async () => {
    stubServer({ keys: [DIAGNOSTIC], assets: [DIAGNOSTIC_GROUP] })
    renderPage()

    expect(
      await screen.findByText('当前只有内置诊断展示位'),
    ).toBeInTheDocument()
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

describe('AppAssets 新建展示位与上传抽屉', () => {
  it('顶部「上传新版本」打开抽屉，不预选 key', async () => {
    stubServer()
    renderPage()

    await screen.findByText('首页 Banner')
    await userEvent.click(
      screen.getByRole('button', { name: '上传新版本' }),
    )

    const drawer = screen.getByTestId('upload-drawer')
    expect(drawer.dataset.open).toBe('true')
    expect(drawer.dataset.preset).toBe('')
  })

  it('行内「上传到此展示位」打开抽屉并预选该 key', async () => {
    stubServer()
    renderPage()

    await screen.findByText('首页 Banner')
    await openRowMenu(BUSINESS_KEY)
    await pickRowAction('上传到此展示位')

    const drawer = screen.getByTestId('upload-drawer')
    expect(drawer.dataset.open).toBe('true')
    expect(drawer.dataset.preset).toBe(BUSINESS_KEY)
  })

  it('顶部「新建展示位」打开创建表单', async () => {
    stubServer()
    renderPage()

    await screen.findByText('首页 Banner')
    await userEvent.click(
      screen.getByRole('button', { name: '新建展示位' }),
    )

    const modal = screen.getByTestId('slot-modal')
    expect(modal.dataset.open).toBe('true')
    expect(modal.dataset.mode).toBe('create')
  })

  it('行内「编辑展示位」打开编辑表单并带入 key', async () => {
    stubServer()
    renderPage()

    await screen.findByText('首页 Banner')
    await openRowMenu(BUSINESS_KEY)
    await pickRowAction('编辑展示位')

    const modal = screen.getByTestId('slot-modal')
    expect(modal.dataset.open).toBe('true')
    expect(modal.dataset.mode).toBe('edit')
    expect(modal.dataset.key).toBe(BUSINESS_KEY)
  })

  it('「操作」菜单按状态列出动作；有 published 时停用项禁用', async () => {
    stubServer()
    renderPage()
    await screen.findByText('首页 Banner')

    await openRowMenu(BUSINESS_KEY)
    expect(menuLabels()).toEqual([
      '上传到此展示位',
      '发布',
      '下架',
      '版本历史',
      '预览',
      '复制 URL',
      '编辑展示位',
      '停用展示位',
      '复制 key',
    ])
    expect(
      screen.getByRole('menuitem', { name: '停用展示位' }),
    ).toHaveAttribute('aria-disabled', 'true')
  })

  it('既没草稿也没发布版本时，菜单只剩上传 / 历史 / 展示位管理', async () => {
    stubServer({ keys: [DIAGNOSTIC], assets: [DIAGNOSTIC_GROUP] })
    renderPage()
    await screen.findByText('远程素材探针')

    await openRowMenu(DIAGNOSTIC_KEY)
    expect(menuLabels()).toEqual([
      '上传到此展示位',
      '版本历史',
      '编辑展示位',
      '停用展示位',
      '复制 key',
    ])
  })

  it('停用行只保留历史 / 预览 / 复制与启用入口', async () => {
    stubServer({
      keys: [BUSINESS],
      assets: [DISABLED_GROUP],
    })
    renderPage()
    await screen.findByText('首页 Banner')

    await openRowMenu(BUSINESS_KEY)
    expect(menuLabels()).toEqual([
      '版本历史',
      '预览',
      '复制 URL',
      '编辑展示位',
      '启用展示位',
      '复制 key',
    ])
  })

  it('孤儿行只读，只有版本历史', async () => {
    stubServer({
      keys: [],
      assets: [ORPHAN_GROUP],
    })
    renderPage()
    await screen.findAllByText(ORPHAN_GROUP.key)

    await openRowMenu(ORPHAN_GROUP.key)
    expect(menuLabels()).toEqual(['版本历史'])
  })
})

describe('AppAssets 发布 / 下架 / 停用 / 启用确认', () => {
  it('发布草稿：取消不发起 POST，确认才发 publish', async () => {
    stubServer()
    renderPage()
    await screen.findByText('首页 Banner')

    await openRowMenu(BUSINESS_KEY)
    await pickRowAction('发布')
    await userEvent.click(
      await screen.findByRole('button', { name: /取\s*消/ }),
    )
    expect(mockPost).not.toHaveBeenCalled()

    await openRowMenu(BUSINESS_KEY)
    await pickRowAction('发布')
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

    await openRowMenu(BUSINESS_KEY)
    await pickRowAction('下架')
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

  it('停用（无 published）：确认后发 PATCH enabled=false', async () => {
    stubServer({
      keys: [BUSINESS],
      assets: [DRAFT_ONLY_GROUP],
    })
    renderPage()
    await screen.findByText('首页 Banner')

    await openRowMenu(BUSINESS_KEY)
    await pickRowAction('停用展示位')
    await userEvent.click(
      await screen.findByRole('button', { name: /确\s*认/ }),
    )

    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith(
        '/analytics/app-assets/keys',
        { key: BUSINESS_KEY, enabled: false },
      ),
    )
    expect(message.success).toHaveBeenCalledWith('已停用展示位')
  })

  it('启用：直接发 PATCH enabled=true', async () => {
    stubServer({
      keys: [{ ...BUSINESS, enabled: false }],
      assets: [DISABLED_GROUP],
    })
    renderPage()
    await screen.findByText('首页 Banner')

    await openRowMenu(BUSINESS_KEY)
    await pickRowAction('启用展示位')

    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith(
        '/analytics/app-assets/keys',
        { key: BUSINESS_KEY, enabled: true },
      ),
    )
    expect(message.success).toHaveBeenCalledWith('已启用展示位')
  })
})

describe('AppAssets 预览与复制', () => {
  it('预览打开模态框展示大图', async () => {
    stubServer()
    renderPage()
    await screen.findByText('首页 Banner')

    await openRowMenu(BUSINESS_KEY)
    await pickRowAction('预览')

    expect(await screen.findByAltText(`${BUSINESS_KEY} v2`)).toBeInTheDocument()
    expect(screen.getByText('预览 v2')).toBeInTheDocument()
    expect(screen.getByTestId('asset-preview')).toHaveStyle({
      textAlign: 'center',
    })
  })

  it('点击缩略图直接打开预览模态框', async () => {
    stubServer()
    renderPage()
    await screen.findByText('首页 Banner')

    await userEvent.click(screen.getByAltText(`${BUSINESS_KEY} 缩略图`))

    expect(await screen.findByAltText(`${BUSINESS_KEY} v2`)).toBeInTheDocument()
    expect(screen.getByText('预览 v2')).toBeInTheDocument()
  })

  it('展示位 key 旁的复制按钮直接复制 key，不展开操作菜单', async () => {
    stubServer()
    renderPage()
    await screen.findByText('首页 Banner')

    await userEvent.click(
      screen.getByRole('button', { name: `复制 key ${BUSINESS_KEY}` }),
    )

    expect(mockCopyText).toHaveBeenCalledWith(BUSINESS_KEY)
    await waitFor(() =>
      expect(message.success).toHaveBeenCalledWith('已复制 key'),
    )
    expect(screen.queryByRole('menuitem')).toBeNull()
  })

  it('展示位 key 行内复制失败时提示手动复制', async () => {
    mockCopyText.mockResolvedValue(false)
    stubServer()
    renderPage()
    await screen.findByText('首页 Banner')

    await userEvent.click(
      screen.getByRole('button', { name: `复制 key ${BUSINESS_KEY}` }),
    )

    await waitFor(() =>
      expect(message.error).toHaveBeenCalledWith('复制失败，请手动复制'),
    )
  })

  it('复制 URL：成功后提示，菜单项改为「已复制 URL」', async () => {
    stubServer()
    renderPage()
    await screen.findByText('首页 Banner')

    await openRowMenu(BUSINESS_KEY)
    await pickRowAction(/复制\s*URL/)

    expect(mockCopyText).toHaveBeenCalledWith(PUBLISHED.url)
    await waitFor(() =>
      expect(message.success).toHaveBeenCalledWith('已复制 URL'),
    )
  })

  it('复制 key：成功后提示', async () => {
    stubServer()
    renderPage()
    await screen.findByText('首页 Banner')

    await openRowMenu(BUSINESS_KEY)
    await pickRowAction('复制 key')

    expect(mockCopyText).toHaveBeenCalledWith(BUSINESS_KEY)
    await waitFor(() =>
      expect(message.success).toHaveBeenCalledWith('已复制 key'),
    )
  })

  it('复制失败：提示手动复制', async () => {
    mockCopyText.mockResolvedValue(false)
    stubServer()
    renderPage()
    await screen.findByText('首页 Banner')

    await openRowMenu(BUSINESS_KEY)
    await pickRowAction(/复制\s*URL/)

    await waitFor(() =>
      expect(message.error).toHaveBeenCalledWith('复制失败，请手动复制'),
    )
  })
})

describe('AppAssets 版本历史抽屉', () => {
  it('点「版本历史」打开对应 key 的抽屉', async () => {
    stubServer()
    renderPage()
    await screen.findByText('首页 Banner')

    await openRowMenu(BUSINESS_KEY)
    await pickRowAction('版本历史')

    const drawer = screen.getByTestId('history-drawer')
    expect(drawer.dataset.open).toBe('true')
    expect(drawer.dataset.key).toBe(BUSINESS_KEY)
  })
})

describe('AppAssets 展示位表单与复制 key 边界', () => {
  it('关闭展示位表单后回到关闭态', async () => {
    stubServer()
    renderPage()
    await screen.findByText('首页 Banner')

    await userEvent.click(
      screen.getByRole('button', { name: '新建展示位' }),
    )
    expect(screen.getByTestId('slot-modal').dataset.open).toBe('true')

    await userEvent.click(
      screen.getByRole('button', { name: '关闭展示位表单' }),
    )
    expect(screen.getByTestId('slot-modal').dataset.open).toBe('false')
  })

  it('复制 key 失败提示手动复制', async () => {
    mockCopyText.mockResolvedValue(false)
    stubServer()
    renderPage()
    await screen.findByText('首页 Banner')

    await openRowMenu(BUSINESS_KEY)
    await pickRowAction('复制 key')

    await waitFor(() =>
      expect(message.error).toHaveBeenCalledWith('复制失败，请手动复制'),
    )
  })
})
