import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { RouteObject } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { apiClient, TOKEN_KEY } from '../api/client'
import { router } from './index'

/**
 * 路由表契约。
 *
 * 只看两件与新页面有关的事：
 * 1. /prompts 存在，且挂在受 RequireAuth 保护的 '/' 之下（不是裸路由）；
 * 2. 无 token 时访问 /prompts 会被重定向到 /login，有 token 才渲染页面。
 */
vi.mock('../api/client', () => ({
  apiClient: { get: vi.fn() },
  TOKEN_KEY: 'deda_dashboard_token',
}))

const mockGet = apiClient.get as unknown as ReturnType<typeof vi.fn>
const routes = router.routes as RouteObject[]

function childPaths(): string[] {
  const root = routes.find((route) => route.path === '/')
  return (root?.children ?? []).map((child) => child.path ?? '<index>')
}

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

/** 用路由表里真实的 '/' element（含 RequireAuth）跑一次渲染 */
function renderAt(entry: string) {
  const root = routes.find((route) => route.path === '/')
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        {/* /login 与真实路由表一样是顶层路由，否则 RequireAuth 会在父路由里自我重定向 */}
        <Route path="/login" element={<div data-testid="page-login" />} />
        <Route path="/" element={root?.element}>
          <Route path="prompts" element={<div data-testid="page-prompts" />} />
        </Route>
      </Routes>
    </MemoryRouter>,
    { wrapper: createWrapper() },
  )
}

beforeEach(() => {
  mockGet.mockReset()
  mockGet.mockRejectedValue(new Error('网络不通'))
  sessionStorage.clear()
})

describe('路由表', () => {
  it('basename 是 /dashboard（与生产部署路径一致）', () => {
    expect(router.basename).toBe('/dashboard')
  })

  it('prompts 是受保护父路由的子路由，不是顶层裸路由', () => {
    expect(childPaths()).toContain('prompts')
    expect(routes.map((route) => route.path)).not.toContain('prompts')
  })

  it('新增 prompts 之后既有的 llm / memories 路由仍在', () => {
    const paths = childPaths()
    expect(paths).toContain('llm')
    expect(paths).toContain('memories')
    expect(paths).toContain('memories/:deviceId')
  })
})

describe('/prompts 的登录闸口', () => {
  it('无 token 时重定向到 /login，不渲染页面', () => {
    renderAt('/prompts')

    expect(screen.getByTestId('page-login')).toBeInTheDocument()
    expect(screen.queryByTestId('page-prompts')).not.toBeInTheDocument()
  })

  it('有 token 时渲染 AdminLayout 与 prompts 页面', async () => {
    sessionStorage.setItem(TOKEN_KEY, 'a-token')
    renderAt('/prompts')

    expect(await screen.findByTestId('page-prompts')).toBeInTheDocument()
    expect(screen.getByText('Deda Dashboard')).toBeInTheDocument()
    // 布局会自己去取 meta，这里让它失败即可：标签按 fail-closed 落「未知环境」
    await waitFor(() =>
      expect(screen.getByTestId('env-tag')).toHaveTextContent('未知环境'),
    )
  })
})
