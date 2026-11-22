import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { apiClient } from '../../api/client'
import Prompts from './index'
import type {
  AnalyticsMeta,
  PromptCatalogItem,
  PromptDetail,
  PromptVersionItem,
} from '../../types/analytics'

/**
 * 页面级集成测试：只替身 HTTP 层（apiClient），让真实的 react-query hooks、
 * PromptEditor、PublishModal 一起跑。要证明的是：
 * 加载态不谎报数量、列表真实渲染、选中后编辑区能编辑、只读时写入口消失、
 * 发布入口能把人带到确认弹窗。
 */
vi.mock('../../api/client', () => ({
  apiClient: { get: vi.fn(), patch: vi.fn(), post: vi.fn() },
}))

const mockGet = apiClient.get as unknown as ReturnType<typeof vi.fn>

function makeMeta(overrides: Partial<AnalyticsMeta> = {}): AnalyticsMeta {
  return {
    nodeEnv: 'staging',
    promptWriteEnabled: true,
    publishConfirmCode: 'DEDA2025',
    ...overrides,
  }
}

function makeItem(overrides: Partial<PromptCatalogItem> = {}): PromptCatalogItem {
  return {
    key: 'persona_elly',
    category: 'persona',
    scene: 'chat_main',
    name: '小象 Elly 人设',
    description: '主链路角色人设',
    variables: [],
    maxChars: 20_000,
    defaultContent: '默认正文',
    effectiveContent: '当前生效正文',
    source: 'default',
    publishedRevision: null,
    draftRevision: null,
    publishedAt: null,
    publishedBy: null,
    deviatesFromDefault: false,
    ...overrides,
  }
}

const CATALOG: PromptCatalogItem[] = [
  makeItem(),
  makeItem({
    key: 'intent_classify_system',
    category: 'small_model',
    scene: 'intent',
    name: '意图分类',
    source: 'db',
    publishedRevision: 3,
    publishedAt: '2026-11-10T01:30:00.000Z',
    publishedBy: 'admin',
    deviatesFromDefault: true,
  }),
]

const DETAIL: PromptDetail = {
  ...makeItem(),
  draftRevision: 2,
  publishedRevision: 1,
  draftContent: '这是已经保存的草稿正文',
  draftChangeNote: '补了海边分支',
  publishedContent: '当前生效正文',
  discardedDraftRevision: null,
}

const VERSIONS: PromptVersionItem[] = [
  {
    revision: 2,
    content: '这是已经保存的草稿正文',
    changeNote: '补了海边分支',
    authorUsername: 'alice',
    authorDisplayName: 'Alice 管理员',
    createdAt: '2026-11-20T01:00:00.000Z',
    publishedAt: null,
    isPublished: false,
    isDraft: true,
  },
]

interface StubOptions {
  meta?: AnalyticsMeta
  metaError?: Error
  catalog?: PromptCatalogItem[] | 'pending'
  catalogError?: Error
  detail?: PromptDetail
  detailError?: Error
}

function stubServer(options: StubOptions = {}) {
  const meta = options.meta ?? makeMeta()
  const catalog = options.catalog ?? CATALOG
  mockGet.mockImplementation((url: string) => {
    if (url === '/analytics/meta') {
      if (options.metaError) return Promise.reject(options.metaError)
      return Promise.resolve({ data: meta })
    }
    if (url === '/analytics/prompts') {
      if (options.catalogError) return Promise.reject(options.catalogError)
      if (catalog === 'pending') return new Promise(() => undefined)
      return Promise.resolve({ data: catalog })
    }
    if (url === '/analytics/prompts/persona_elly') {
      if (options.detailError) return Promise.reject(options.detailError)
      return Promise.resolve({ data: options.detail ?? DETAIL })
    }
    if (url === '/analytics/prompts/persona_elly/versions') {
      return Promise.resolve({ data: VERSIONS })
    }
    return Promise.resolve({ data: null })
  })
}

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location-search">{location.search}</div>
}

function renderPage(entry = '/prompts') {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <LocationProbe />
        <Prompts />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function openEditor() {
  await screen.findByText('小象 Elly 人设')
  await userEvent.click(screen.getAllByRole('button', { name: '查看/编辑' })[0])
  await screen.findByText('提示词详情')
}

beforeEach(() => {
  mockGet.mockReset()
})

describe('提示词管理页集成 · 加载态', () => {
  it('列表还在路上时提示加载中，表格转圈，不谎报「共 0 个」', () => {
    stubServer({ catalog: 'pending' })
    renderPage()

    expect(screen.getByText(/可编辑 prompt 列表加载中/)).toBeInTheDocument()
    expect(document.querySelector('.ant-spin-spinning')).not.toBeNull()
    expect(screen.queryByText(/共 0 个可编辑 prompt/)).not.toBeInTheDocument()
  })
})

describe('提示词管理页集成 · 列表', () => {
  it('渲染名称、key、分类、来源与总数', async () => {
    stubServer()
    renderPage()

    expect(await screen.findByText('小象 Elly 人设')).toBeInTheDocument()
    expect(screen.getByText('persona_elly')).toBeInTheDocument()
    expect(screen.getByText('意图分类')).toBeInTheDocument()
    expect(screen.getByText(/共 2 个可编辑 prompt/)).toBeInTheDocument()
    expect(screen.getAllByText('角色人设')).toHaveLength(1)
    expect(screen.getByText('小模型')).toBeInTheDocument()
    expect(screen.getByText('DB 已发布')).toBeInTheDocument()
    expect(screen.getByText('代码默认值')).toBeInTheDocument()
    expect(screen.getByText('已偏离默认')).toBeInTheDocument()
  })

  it('列表加载失败给出错误 Alert 与 message', async () => {
    stubServer({ catalogError: new Error('后端 500 了') })
    renderPage()

    expect(await screen.findByText('prompt 列表加载失败')).toBeInTheDocument()
    expect(screen.getByText('后端 500 了')).toBeInTheDocument()
  })
})

describe('提示词管理页集成 · 选中编辑', () => {
  it('点「查看/编辑」打开抽屉，真实编辑器读到详情并可改正文', async () => {
    stubServer()
    renderPage()
    await openEditor()

    expect(screen.getByTestId('location-search').textContent).toBe(
      '?key=persona_elly',
    )
    // 详情加载完：草稿指针、正文与版本历史都来自接口
    expect(await screen.findByText('草稿正文 r2')).toBeInTheDocument()
    expect(screen.getByText('版本历史')).toBeInTheDocument()

    const textarea = screen.getByLabelText('prompt 正文') as HTMLTextAreaElement
    expect(textarea.value).toBe('这是已经保存的草稿正文')
    expect(textarea.disabled).toBe(false)

    fireEvent.change(textarea, { target: { value: '改成了新的正文' } })
    expect(screen.getByText('有未保存的改动')).toBeInTheDocument()
  })

  it('详情加载失败时抽屉里给出错误，而不是空白', async () => {
    stubServer({ detailError: new Error('详情服务挂了') })
    renderPage()
    await openEditor()

    expect(await screen.findByText('prompt 详情加载失败')).toBeInTheDocument()
    expect(screen.getByText('详情服务挂了')).toBeInTheDocument()
  })
})

describe('提示词管理页集成 · 只读禁用', () => {
  it('写开关关闭：页面提示只读，编辑器禁用正文并移除发布入口', async () => {
    stubServer({ meta: makeMeta({ promptWriteEnabled: false }) })
    renderPage()

    expect(await screen.findByText('当前环境只读')).toBeInTheDocument()
    await openEditor()

    const textarea = screen.getByLabelText('prompt 正文') as HTMLTextAreaElement
    expect(textarea.disabled).toBe(true)
    expect(screen.getByText('当前为只读')).toBeInTheDocument()
    expect(
      screen.getAllByText(/PROMPT_WRITE_ENABLED=false/).length,
    ).toBeGreaterThanOrEqual(1)
    expect(
      screen.queryByRole('button', { name: '发布草稿' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: '保存草稿' }),
    ).not.toBeInTheDocument()
  })

  it('环境识别失败（meta 不可用）：fail-closed，编辑器同样只读', async () => {
    stubServer({ metaError: new Error('网络不通') })
    renderPage()

    expect(await screen.findByText('无法确认当前环境')).toBeInTheDocument()
    await openEditor()

    expect(screen.getByText('当前为只读')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '发布草稿' })).not.toBeInTheDocument()
  })
})

describe('提示词管理页集成 · 发布入口', () => {
  it('有草稿且没有未保存改动时「发布草稿」可点，点开是重大操作确认弹窗', async () => {
    stubServer()
    renderPage()
    await openEditor()
    await screen.findByText('草稿正文 r2')

    const publishButton = screen.getByRole('button', { name: '发布草稿' })
    expect(publishButton).not.toBeDisabled()
    await userEvent.click(publishButton)

    expect(await screen.findByText('重大操作')).toBeInTheDocument()
    expect(
      screen.getByText(/你正在【测试】环境发布草稿/),
    ).toBeInTheDocument()
    expect(screen.getAllByText(/草稿 r2/).length).toBeGreaterThanOrEqual(1)
    // 确认码必须手输，未填时确认按钮禁用
    const modal = screen.getByText('重大操作').closest('.ant-modal') as HTMLElement
    expect(
      within(modal).getByRole('button', { name: '发布草稿' }),
    ).toBeDisabled()
  })

  it('改了正文但没保存时发布入口禁用，避免「以为发的是屏幕上这段」', async () => {
    stubServer()
    renderPage()
    await openEditor()
    await screen.findByText('草稿正文 r2')

    fireEvent.change(screen.getByLabelText('prompt 正文'), {
      target: { value: '还没保存的改动' },
    })

    const publishButton = screen.getByRole('button', { name: '发布草稿' })
    await waitFor(() => expect(publishButton).toBeDisabled())
  })
})
