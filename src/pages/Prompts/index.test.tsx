import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { apiClient } from '../../api/client'
import Prompts from './index'
import type { AnalyticsMeta, PromptCatalogItem } from '../../types/analytics'

/**
 * 列表页的行为契约。
 *
 * PromptEditor 在这里替身掉（它自己有 15 条测试），本页只考核三件事：
 * 1. 环境结论只从 /analytics/meta 来，取不到就 fail-closed 把 writable 传成 false；
 * 2. 生产环境的额外警示、写开关关闭的只读提示都要真的出现，不能只在文案里说说；
 * 3. 抽屉开关与选中 key 的联动（关闭即卸载编辑器，不留上一个 prompt 的状态）。
 */
vi.mock('../../api/client', () => ({
  apiClient: { get: vi.fn() },
  TOKEN_KEY: 'deda_dashboard_token',
}))

vi.mock('./PromptEditor', () => ({
  default: (props: {
    promptKey: string
    writable: boolean
    disabledReason: string | null
    confirmCodeHint: string
    env: { tone: string }
  }) => (
    <div
      data-testid="prompt-editor"
      data-prompt-key={props.promptKey}
      data-writable={String(props.writable)}
      data-tone={props.env.tone}
      data-disabled-reason={props.disabledReason ?? ''}
      data-confirm-hint={props.confirmCodeHint}
    />
  ),
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
    effectiveContent: '默认正文',
    source: 'default',
    publishedRevision: null,
    draftRevision: null,
    publishedAt: null,
    publishedBy: null,
    deviatesFromDefault: false,
    ...overrides,
  }
}

const PUBLISHED_AT = '2026-11-10T09:30:00+08:00'

/**
 * 列表里的「最近发布」是本地时区格式化出来的，而 CI 跑在 UTC：
 * 期望值按运行环境算，不硬编码钟点，否则换个时区这条用例就红。
 */
function localStamp(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`
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
    publishedAt: PUBLISHED_AT,
    publishedBy: 'admin',
    deviatesFromDefault: true,
    effectiveContent: '改过的正文',
  }),
  makeItem({
    key: 'story_prompt_sleep',
    category: 'story',
    scene: 'story',
    name: '哄睡故事',
    draftRevision: 2,
  }),
]

/** meta 与 catalog 两个 GET 的替身；传 null 表示这条请求永不返回（模拟 pending） */
function stubServer(opts: {
  meta?: AnalyticsMeta | null
  metaError?: Error
  catalog?: PromptCatalogItem[] | null
  catalogError?: Error
} = {}) {
  const { meta = makeMeta(), catalog = CATALOG } = opts
  mockGet.mockImplementation((url: string) => {
    if (url === '/analytics/meta') {
      if (opts.metaError) return Promise.reject(opts.metaError)
      if (meta === null) return new Promise(() => undefined)
      return Promise.resolve({ data: meta })
    }
    if (opts.catalogError) return Promise.reject(opts.catalogError)
    if (catalog === null) return new Promise(() => undefined)
    return Promise.resolve({ data: catalog })
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

beforeEach(() => {
  mockGet.mockReset()
})

describe('Prompts 列表渲染', () => {
  it('渲染 catalog 的名称 / key / 分类 / 来源，并给出总数', async () => {
    stubServer()
    renderPage()

    expect(await screen.findByText('小象 Elly 人设')).toBeInTheDocument()
    expect(screen.getByText('persona_elly')).toBeInTheDocument()
    expect(screen.getByText('意图分类')).toBeInTheDocument()
    expect(screen.getByText('哄睡故事')).toBeInTheDocument()
    expect(screen.getByText(/共 3 个可编辑 prompt/)).toBeInTheDocument()
  })

  it('来源与状态标签按服务端真相渲染：DB 已发布 / 已偏离默认 / 有草稿', async () => {
    stubServer()
    renderPage()

    await screen.findByText('小象 Elly 人设')
    // 三条里两条回落默认值、两条从未发布，用 AllBy 断言条数而不是单点命中
    expect(screen.getAllByText('代码默认值')).toHaveLength(2)
    expect(screen.getByText('DB 已发布')).toBeInTheDocument()
    expect(screen.getByText('已偏离默认')).toBeInTheDocument()
    expect(screen.getAllByText('从未发布')).toHaveLength(2)
    // 意图分类那行有发布时间与操作人
    expect(screen.getByText(localStamp(PUBLISHED_AT))).toBeInTheDocument()
    expect(screen.getByText('admin')).toBeInTheDocument()
  })

  it('catalog 还在路上时提示加载中，不谎报「共 0 个」', async () => {
    stubServer({ catalog: null })
    renderPage()

    expect(
      await screen.findByText(/可编辑 prompt 列表加载中/),
    ).toBeInTheDocument()
    expect(screen.queryByText(/共 0 个/)).not.toBeInTheDocument()
  })

  it('catalog 加载失败给出错误 Alert 与服务端 message', async () => {
    stubServer({ catalogError: new Error('后端 500 了') })
    renderPage()

    expect(
      await screen.findByText('prompt 列表加载失败'),
    ).toBeInTheDocument()
    expect(screen.getByText('后端 500 了')).toBeInTheDocument()
  })
})

describe('Prompts 环境识别与写闸口', () => {
  it('页面标题为「提示词管理」', async () => {
    stubServer()
    renderPage()

    expect(
      await screen.findByRole('heading', { name: '提示词管理' }),
    ).toBeInTheDocument()
  })

  it('页面不再渲染环境标签：环境标识只在左上角', async () => {
    stubServer({ meta: makeMeta({ nodeEnv: 'staging' }) })
    renderPage()

    await screen.findByText('小象 Elly 人设')
    expect(screen.queryByTestId('env-tag')).not.toBeInTheDocument()
  })

  it('staging：不出现生产警示', async () => {
    stubServer({ meta: makeMeta({ nodeEnv: 'staging' }) })
    renderPage()

    await screen.findByText('小象 Elly 人设')
    expect(screen.queryByText('当前为生产环境')).not.toBeInTheDocument()
  })

  it('production：仍挂出生产警示 Alert，但页面不渲染环境标签', async () => {
    stubServer({ meta: makeMeta({ nodeEnv: 'production' }) })
    renderPage()

    expect(await screen.findByText('当前为生产环境')).toBeInTheDocument()
    expect(
      screen.getByText(/任何发布都会立即对所有线上设备生效/),
    ).toBeInTheDocument()
    expect(screen.queryByTestId('env-tag')).not.toBeInTheDocument()
  })

  it('meta 失败：错误 Alert（fail-closed），页面不渲染环境标签', async () => {
    stubServer({ metaError: new Error('网络不通') })
    renderPage()

    expect(await screen.findByText('无法确认当前环境')).toBeInTheDocument()
    expect(screen.getByText(/已按 fail-closed 禁用全部写操作/)).toBeInTheDocument()
    expect(screen.queryByTestId('env-tag')).not.toBeInTheDocument()
  })

  it('写开关关闭：只读提示，且不出现生产警示', async () => {
    stubServer({
      meta: makeMeta({ nodeEnv: 'staging', promptWriteEnabled: false }),
    })
    renderPage()

    expect(await screen.findByText('当前环境只读')).toBeInTheDocument()
    expect(
      screen.getByText(/PROMPT_WRITE_ENABLED=false/),
    ).toBeInTheDocument()
    expect(screen.queryByText('当前为生产环境')).not.toBeInTheDocument()
    expect(screen.queryByTestId('env-tag')).not.toBeInTheDocument()
  })

  it('meta 未返回：不渲染页面级环境标签，也不抢答环境', () => {
    stubServer({ meta: null })
    renderPage()

    expect(screen.queryByTestId('env-tag')).not.toBeInTheDocument()
  })
})

describe('Prompts 抽屉与编辑器联动', () => {
  it('点「查看/编辑」打开抽屉，把 key 与 writable=true 透传给编辑器', async () => {
    stubServer()
    renderPage()

    await screen.findByText('小象 Elly 人设')
    const buttons = screen.getAllByRole('button', { name: '查看/编辑' })
    await userEvent.click(buttons[1])

    const editor = await screen.findByTestId('prompt-editor')
    expect(editor.dataset.promptKey).toBe('intent_classify_system')
    expect(editor.dataset.writable).toBe('true')
    expect(editor.dataset.tone).toBe('staging')
    expect(editor.dataset.confirmHint).toBe('DEDA2025')
    expect(screen.getByText('提示词详情')).toBeInTheDocument()
  })

  it('meta 失败时抽屉里的编辑器同样是 writable=false 并带 fail-closed 理由', async () => {
    stubServer({ metaError: new Error('网络不通') })
    renderPage()

    await screen.findByText('无法确认当前环境')
    await userEvent.click(screen.getAllByRole('button', { name: '查看/编辑' })[0])

    const editor = await screen.findByTestId('prompt-editor')
    expect(editor.dataset.writable).toBe('false')
    expect(editor.dataset.tone).toBe('unknown')
    expect(editor.dataset.disabledReason).toContain('fail-closed')
  })

  it('写开关关闭时抽屉里的编辑器 writable=false，理由是服务端只读', async () => {
    stubServer({
      meta: makeMeta({ nodeEnv: 'production', promptWriteEnabled: false }),
    })
    renderPage()

    await screen.findByText('当前环境只读')
    await userEvent.click(screen.getAllByRole('button', { name: '查看/编辑' })[0])

    const editor = await screen.findByTestId('prompt-editor')
    expect(editor.dataset.writable).toBe('false')
    expect(editor.dataset.tone).toBe('production')
    expect(editor.dataset.disabledReason).toContain('PROMPT_WRITE_ENABLED')
  })

  it('关闭抽屉即卸载编辑器，URL 同步清除 key 参数', async () => {
    stubServer()
    renderPage()

    await screen.findByText('小象 Elly 人设')
    await userEvent.click(screen.getAllByRole('button', { name: '查看/编辑' })[0])
    expect(await screen.findByTestId('prompt-editor')).toBeInTheDocument()
    // URL 包含选中 key
    expect(screen.getByTestId('location-search').textContent).toBe(
      '?key=persona_elly',
    )

    const close = document.querySelector('.ant-drawer-close')
    expect(close).not.toBeNull()
    fireEvent.click(close as Element)

    await waitFor(() =>
      expect(screen.queryByTestId('prompt-editor')).not.toBeInTheDocument(),
    )
    // URL 不再含有 key
    expect(screen.getByTestId('location-search').textContent).toBe('')
  })
})

describe('Prompts 列筛选', () => {
  async function openFilter(triggerIndex: number) {
    const triggers = document.querySelectorAll('.ant-table-filter-trigger')
    expect(triggers).toHaveLength(2) // 分类 + 生效来源
    fireEvent.click(triggers[triggerIndex])
    return await waitFor(() => {
      const el = document.querySelector('.ant-table-filter-dropdown')
      expect(el).not.toBeNull()
      return el as HTMLElement
    })
  }

  it('按分类筛：只剩小模型那一行', async () => {
    stubServer()
    renderPage()
    await screen.findByText('小象 Elly 人设')

    const dropdown = await openFilter(0)
    fireEvent.click(within(dropdown).getByText('小模型'))
    // 筛选按钮文案跟着 locale 走，这里断言的是就地补上的中文
    fireEvent.click(
      within(dropdown).getByRole('button', { name: /确\s*定/ }),
    )

    await waitFor(() =>
      expect(screen.queryByText('小象 Elly 人设')).not.toBeInTheDocument(),
    )
    expect(screen.getByText('意图分类')).toBeInTheDocument()
    expect(screen.queryByText('哄睡故事')).not.toBeInTheDocument()
  })

  it('按生效来源筛：只剩 DB 已发布那一行，且筛选按钮是中文', async () => {
    stubServer()
    renderPage()
    await screen.findByText('小象 Elly 人设')

    const dropdown = await openFilter(1)
    expect(
      within(dropdown).getByRole('button', { name: /重\s*置/ }),
    ).toBeDisabled()
    fireEvent.click(within(dropdown).getByText('DB 已发布'))
    fireEvent.click(
      within(dropdown).getByRole('button', { name: /确\s*定/ }),
    )

    await waitFor(() =>
      expect(screen.queryByText('哄睡故事')).not.toBeInTheDocument(),
    )
    expect(screen.getByText('意图分类')).toBeInTheDocument()
  })
})

describe('Prompts URL key 参数——抽屉联动', () => {
  it('?key=persona_elly → 自动打开抽屉，编辑器收到对应 key', async () => {
    stubServer()
    renderPage('/prompts?key=persona_elly')

    const editor = await screen.findByTestId('prompt-editor')
    expect(editor.dataset.promptKey).toBe('persona_elly')
    expect(screen.getByText('提示词详情')).toBeInTheDocument()
  })

  it('?key=不存在的 key → 抽屉打开并说明目录里没有，不挂编辑器', async () => {
    stubServer()
    renderPage('/prompts?key=nonexistent')

    // Drawer 打开了（selectedKey 不为 null），但 catalog 里没这个 key
    expect(screen.getByText('提示词详情')).toBeInTheDocument()
    expect(screen.queryByTestId('prompt-editor')).not.toBeInTheDocument()
    // ?key= 可分享，就会有人拿着已下线 prompt 的旧链接进来：给一句人话而不是空抽屉
    expect(
      await screen.findByText('目录里没有这个 prompt'),
    ).toBeInTheDocument()
    expect(screen.getByText(/nonexistent 可能已下线/)).toBeInTheDocument()
  })
})

describe('Prompts URL scene 参数——场景下钻', () => {
  it('?scene=chat_main → 出现场景过滤 Tag 并过滤表格', async () => {
    stubServer()
    renderPage('/prompts?scene=chat_main')

    // 场景筛选 Tag
    expect(await screen.findByText(/调用场景：/)).toBeInTheDocument()
    // "主对话回答" 出现在场景过滤 Tag 中（表格 Link 需等 catalog 加载，Tag 同步渲染）
    const mainChatEls = screen.getAllByText(/主对话回答/)
    expect(mainChatEls.length).toBeGreaterThanOrEqual(1)

    // 只有 scene=chat_main 的项可见（catalog 异步加载，用 findBy）
    expect(await screen.findByText('小象 Elly 人设')).toBeInTheDocument()
    // 其他项的 scene 不是 chat_main
    await waitFor(() =>
      expect(screen.queryByText('意图分类')).not.toBeInTheDocument(),
    )
    expect(screen.queryByText('哄睡故事')).not.toBeInTheDocument()
  })

  it('关闭场景 Tag → URL 移除 scene 参数', async () => {
    const user = userEvent.setup()
    stubServer()
    renderPage('/prompts?scene=chat_main')

    await screen.findByText(/调用场景：/)

    // antd Tag closable 用 close icon
    const closeIcon = document.querySelector(
      '.ant-tag .anticon-close, .ant-tag-close-icon',
    )
    expect(closeIcon).not.toBeNull()
    await user.click(closeIcon!)

    // URL 不再含 scene
    expect(screen.getByTestId('location-search').textContent).toBe('')
  })

  it('?scene=filler → 过滤后无匹配项，显示空态文案', async () => {
    stubServer()
    renderPage('/prompts?scene=filler')

    expect(
      await screen.findByText('该场景没有绑定可编辑 prompt'),
    ).toBeInTheDocument()
  })

  it('?scene=nonsense（非法值）→ 忽略，不筛选', async () => {
    stubServer()
    renderPage('/prompts?scene=nonsense')

    // 非法值被 readOptionalEnumParam 忽略，所有项都可见
    expect(await screen.findByText('小象 Elly 人设')).toBeInTheDocument()
    expect(screen.getByText('意图分类')).toBeInTheDocument()
    expect(screen.getByText('哄睡故事')).toBeInTheDocument()
    // 没有场景 Tag
    expect(screen.queryByText(/调用场景：/)).not.toBeInTheDocument()
  })

  it('场景列渲染为到 /llm?tab=perf&scene=<scene> 的链接', async () => {
    stubServer()
    renderPage()

    await screen.findByText('小象 Elly 人设')

    // 调用场景列包含链接（persona_elly scene=chat_main → 主对话回答）
    const link = screen.getByRole('link', { name: '主对话回答' })
    expect(link.getAttribute('href')).toBe('/llm?tab=perf&scene=chat_main')
  })
})

describe('Prompts key 与 scene 共存', () => {
  it('?key=persona_elly&scene=chat_main → 抽屉打开且过滤生效', async () => {
    stubServer()
    renderPage('/prompts?key=persona_elly&scene=chat_main')

    // 抽屉打开
    const editor = await screen.findByTestId('prompt-editor')
    expect(editor.dataset.promptKey).toBe('persona_elly')
    // 场景 Tag 也在
    expect(screen.getByText(/调用场景：/)).toBeInTheDocument()
  })
})
