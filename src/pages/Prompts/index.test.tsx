import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
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

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

function renderPage() {
  return render(<Prompts />, { wrapper: createWrapper() })
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
  it('staging：环境标签为「测试」，不出现生产警示', async () => {
    stubServer({ meta: makeMeta({ nodeEnv: 'staging' }) })
    renderPage()

    const tag = await screen.findByTestId('env-tag')
    await waitFor(() => expect(tag.dataset.tone).toBe('staging'))
    expect(tag).toHaveTextContent('测试')
    expect(screen.queryByText('当前为生产环境')).not.toBeInTheDocument()
  })

  it('production：标签「生产」并额外挂出生产警示 Alert', async () => {
    stubServer({ meta: makeMeta({ nodeEnv: 'production' }) })
    renderPage()

    const tag = await screen.findByTestId('env-tag')
    await waitFor(() => expect(tag.dataset.tone).toBe('production'))
    expect(tag).toHaveTextContent('生产')
    expect(await screen.findByText('当前为生产环境')).toBeInTheDocument()
    expect(
      screen.getByText(/任何发布都会立即对所有线上设备生效/),
    ).toBeInTheDocument()
  })

  it('meta 失败：标签落「未知环境」+ 错误 Alert（fail-closed）', async () => {
    stubServer({ metaError: new Error('网络不通') })
    renderPage()

    const tag = await screen.findByTestId('env-tag')
    await waitFor(() => expect(tag.dataset.tone).toBe('unknown'))
    expect(tag).toHaveTextContent('未知环境')
    expect(await screen.findByText('无法确认当前环境')).toBeInTheDocument()
    expect(screen.getByText(/已按 fail-closed 禁用全部写操作/)).toBeInTheDocument()
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
  })

  it('meta 未返回时先渲染「环境识别中」，不抢答一个环境', () => {
    stubServer({ meta: null })
    renderPage()

    const tag = screen.getByTestId('env-tag')
    expect(tag.dataset.tone).toBe('unknown')
    expect(tag).toHaveTextContent('环境识别中')
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
    expect(screen.getByText('Prompt 详情')).toBeInTheDocument()
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

  it('关闭抽屉即卸载编辑器，不留下一个 prompt 的状态', async () => {
    stubServer()
    renderPage()

    await screen.findByText('小象 Elly 人设')
    await userEvent.click(screen.getAllByRole('button', { name: '查看/编辑' })[0])
    expect(await screen.findByTestId('prompt-editor')).toBeInTheDocument()

    const close = document.querySelector('.ant-drawer-close')
    expect(close).not.toBeNull()
    fireEvent.click(close as Element)

    await waitFor(() =>
      expect(screen.queryByTestId('prompt-editor')).not.toBeInTheDocument(),
    )
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
