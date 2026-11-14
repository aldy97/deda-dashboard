import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { apiClient, TOKEN_KEY } from '../api/client'
import AdminLayout from './AdminLayout'

/**
 * 布局层契约：环境标签与 Prompt 管理入口。
 *
 * 环境标签挂在 Sider 标题旁，是管理员判断「我在改哪个环境」的唯一常驻提示，
 * 所以这里盯三件事：
 * 1. 标签只信 /analytics/meta，请求失败或还在路上都是「未知环境」（fail-closed）；
 * 2. 菜单里真的有 Prompt 管理，点了能跳到 /prompts；
 * 3. 退出登录清 sessionStorage 的 token。
 */
vi.mock('../api/client', () => ({
  apiClient: { get: vi.fn() },
  TOKEN_KEY: 'deda_dashboard_token',
}))

const mockGet = apiClient.get as unknown as ReturnType<typeof vi.fn>

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location-pathname">{location.pathname}</div>
}

function stubMeta(payload: unknown | null, error?: Error) {
  mockGet.mockImplementation((url: string) => {
    if (url !== '/analytics/meta') return Promise.resolve({ data: null })
    if (error) return Promise.reject(error)
    if (payload === null) return new Promise(() => undefined)
    return Promise.resolve({ data: payload })
  })
}

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false },
    },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

function renderLayout(entry = '/overview') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <LocationProbe />
      <Routes>
        <Route element={<AdminLayout />}>
          <Route path="/overview" element={<div data-testid="page-overview" />} />
          <Route path="/prompts" element={<div data-testid="page-prompts" />} />
          <Route path="/login" element={<div data-testid="page-login" />} />
          <Route
            path="/memories/:deviceId"
            element={<div data-testid="page-memory" />}
          />
        </Route>
      </Routes>
    </MemoryRouter>,
    { wrapper: createWrapper() },
  )
}

beforeEach(() => {
  mockGet.mockReset()
  sessionStorage.clear()
})

describe('AdminLayout 标题与环境标签', () => {
  it('Sider 里「Deda Dashboard」旁边挂环境标签', async () => {
    stubMeta({
      nodeEnv: 'staging',
      promptWriteEnabled: true,
      publishConfirmCode: 'DEDA2025',
    })
    renderLayout()

    expect(screen.getByText('Deda Dashboard')).toBeInTheDocument()
    const tag = screen.getByTestId('env-tag')
    await waitFor(() => expect(tag.dataset.tone).toBe('staging'))
    expect(tag).toHaveTextContent('测试')
  })

  it.each([
    ['development', '本地', 'local'],
    ['staging', '测试', 'staging'],
    ['production', '生产', 'production'],
  ])('nodeEnv=%s 渲染「%s」标签', async (nodeEnv, text, tone) => {
    stubMeta({
      nodeEnv,
      promptWriteEnabled: true,
      publishConfirmCode: 'DEDA2025',
    })
    renderLayout()

    const tag = screen.getByTestId('env-tag')
    await waitFor(() => expect(tag.dataset.tone).toBe(tone))
    expect(tag).toHaveTextContent(text)
  })

  it('meta 请求失败：标签落「未知环境」，不猜一个环境出来', async () => {
    stubMeta(null, new Error('网络不通'))
    renderLayout()

    const tag = screen.getByTestId('env-tag')
    // tone 在 loading 与 failed 两态都是 unknown，必须等文案落定
    await waitFor(() => expect(tag).toHaveTextContent('未知环境'))
    expect(tag.dataset.tone).toBe('unknown')
  })

  it('meta 还在路上：显示「环境识别中」而不是空白或默认环境', () => {
    stubMeta(null)
    renderLayout()

    const tag = screen.getByTestId('env-tag')
    expect(tag.dataset.tone).toBe('unknown')
    expect(tag).toHaveTextContent('环境识别中')
  })
})

describe('AdminLayout 菜单与路由', () => {
  it('菜单里有「Prompt 管理」，点击后路由变 /prompts 并挂载对应页面', async () => {
    stubMeta({
      nodeEnv: 'staging',
      promptWriteEnabled: true,
      publishConfirmCode: 'DEDA2025',
    })
    renderLayout()

    const item = screen.getByRole('menuitem', { name: /Prompt 管理/ })
    await userEvent.click(item)

    await waitFor(() =>
      expect(screen.getByTestId('location-pathname')).toHaveTextContent(
        '/prompts',
      ),
    )
    expect(screen.getByTestId('page-prompts')).toBeInTheDocument()
    expect(item).toHaveClass('ant-menu-item-selected')
  })

  it('直接进 /prompts 时菜单高亮 Prompt 管理', async () => {
    stubMeta({
      nodeEnv: 'production',
      promptWriteEnabled: false,
      publishConfirmCode: 'DEDA2025',
    })
    renderLayout('/prompts')

    expect(screen.getByTestId('page-prompts')).toBeInTheDocument()
    expect(
      screen.getByRole('menuitem', { name: /Prompt 管理/ }),
    ).toHaveClass('ant-menu-item-selected')
  })

  it('记忆详情页 /memories/:deviceId 仍高亮「记忆档案」', () => {
    stubMeta({
      nodeEnv: 'development',
      promptWriteEnabled: true,
      publishConfirmCode: 'DEDA2025',
    })
    renderLayout('/memories/dev-001')

    expect(screen.getByTestId('page-memory')).toBeInTheDocument()
    expect(
      screen.getByRole('menuitem', { name: /记忆档案/ }),
    ).toHaveClass('ant-menu-item-selected')
  })
})

describe('AdminLayout 退出登录', () => {
  it('清掉 sessionStorage 的 token 并跳到 /login', async () => {
    stubMeta({
      nodeEnv: 'staging',
      promptWriteEnabled: true,
      publishConfirmCode: 'DEDA2025',
    })
    sessionStorage.setItem(TOKEN_KEY, 'a-token')
    renderLayout()

    await userEvent.click(screen.getByRole('button', { name: '退出登录' }))

    expect(sessionStorage.getItem(TOKEN_KEY)).toBeNull()
    await waitFor(() =>
      expect(screen.getByTestId('location-pathname')).toHaveTextContent(
        '/login',
      ),
    )
  })
})
