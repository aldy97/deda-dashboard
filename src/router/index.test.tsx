import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import type { RouteObject } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { apiClient } from '../api/client'
import { TOKEN_KEY } from '../utils/auth-token'
import { router } from './index'
import { LOGIN_NEXT_PARAM } from './redirect'

/**
 * 路由表契约。
 *
 * 看三件事：
 * 1. /prompts 存在，且挂在受 RequireAuth 保护的 '/' 之下（不是裸路由）；
 * 2. 无 token 时访问 /prompts 会被重定向到 /login，有 token 才渲染页面；
 * 3. 重定向到 /login 时必须把原始目标编码进 ?next=，否则登录成功后
 *    只能落回默认页——这正是「拿到 /adventure 链接却没登录」那个 bug。
 */
vi.mock('../api/client', () => ({
  apiClient: { get: vi.fn() },
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

/** 登录页替身：把 search 回显出来，好断言 next 有没有被带上 */
function LoginProbe() {
  const location = useLocation()
  return (
    <div data-testid="page-login" data-search={location.search}>
      login
    </div>
  )
}

/** 从重定向后的登录页里解出 next */
function redirectedNext(): string | null {
  const search = screen.getByTestId('page-login').dataset.search ?? ''
  return new URLSearchParams(search).get(LOGIN_NEXT_PARAM)
}

/** 用路由表里真实的 '/' element（含 RequireAuth）跑一次渲染 */
function renderAt(entry: string) {
  const root = routes.find((route) => route.path === '/')
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        {/* /login 与真实路由表一样是顶层路由，否则 RequireAuth 会在父路由里自我重定向 */}
        <Route path="/login" element={<LoginProbe />} />
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
  localStorage.clear()
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

  it('测试设备白名单是受保护父路由的子路由，走运维组闸口', () => {
    expect(childPaths()).toContain('test-devices')
    expect(routes.map((route) => route.path)).not.toContain('test-devices')
  })

  it('Elly 素材是受保护父路由的子路由，走运维组闸口', () => {
    expect(childPaths()).toContain('app-assets')
    expect(routes.map((route) => route.path)).not.toContain('app-assets')
  })
})

describe('/prompts 的登录闸口', () => {
  it('无 token 时重定向到 /login，不渲染页面', () => {
    renderAt('/prompts')

    expect(screen.getByTestId('page-login')).toBeInTheDocument()
    expect(screen.queryByTestId('page-prompts')).not.toBeInTheDocument()
  })

  it('有 token 时渲染 AdminLayout 与 prompts 页面', async () => {
    localStorage.setItem(TOKEN_KEY, 'a-token')
    renderAt('/prompts')

    expect(await screen.findByTestId('page-prompts')).toBeInTheDocument()
    expect(screen.getByText('Deda Dashboard')).toBeInTheDocument()
    // 布局会自己去取 meta，这里让它失败即可：标签按 fail-closed 落「未知环境」
    await waitFor(() =>
      expect(screen.getByTestId('env-tag')).toHaveTextContent('未知环境'),
    )
  })
})


describe('运维组路由闸口', () => {
  /** 用路由表里 prompts 的真实 element（OpsGate + Prompts），而不是测试替身 */
  function renderRealPrompts(entry = '/prompts') {
    const root = routes.find((route) => route.path === '/')
    const promptsRoute = (root?.children ?? []).find(
      (child) => child.path === 'prompts',
    )
    return render(
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/login" element={<LoginProbe />} />
          <Route path="/" element={root?.element}>
            <Route path="prompts" element={promptsRoute?.element} />
          </Route>
        </Routes>
      </MemoryRouter>,
      { wrapper: createWrapper() },
    )
  }

  function stubMetaRole(role: 'admin' | 'superadmin') {
    mockGet.mockImplementation((url: string) =>
      url === '/analytics/meta'
        ? Promise.resolve({
            data: {
              nodeEnv: 'staging',
              promptWriteEnabled: true,
              publishConfirmCode: 'DEDA2025',
              admin: { username: 'u', displayName: 'U', role },
            },
          })
        : Promise.reject(new Error('网络不通')),
    )
  }

  /** 用路由表里 app-assets 的真实 element（OpsGate + AppAssets），而不是测试替身 */
  function renderRealAppAssets(entry = '/app-assets') {
    const root = routes.find((route) => route.path === '/')
    const appAssetsRoute = (root?.children ?? []).find(
      (child) => child.path === 'app-assets',
    )
    return render(
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/login" element={<LoginProbe />} />
          <Route path="/" element={root?.element}>
            <Route path="app-assets" element={appAssetsRoute?.element} />
          </Route>
        </Routes>
      </MemoryRouter>,
      { wrapper: createWrapper() },
    )
  }

  it('普通 admin 带 token 直达 /prompts：显示雾，不挂载页面也不发 prompts 请求', async () => {
    localStorage.setItem(TOKEN_KEY, 'a-token')
    stubMetaRole('admin')
    renderRealPrompts()

    expect(await screen.findByTestId('ops-fog')).toBeInTheDocument()
    expect(screen.getByText(/仅超级管理员可访问/)).toBeInTheDocument()
    // 只打了一次 meta；prompts 目录接口一次都不能发
    expect(
      mockGet.mock.calls.some(([url]) => url === '/analytics/prompts'),
    ).toBe(false)
  })

  it('superadmin 正常进入，不出雾', async () => {
    localStorage.setItem(TOKEN_KEY, 'a-token')
    stubMetaRole('superadmin')
    renderRealPrompts()

    await waitFor(() => expect(screen.queryByTestId('ops-fog')).toBeNull())
  })

  it('普通 admin 带 token 直达 /app-assets：显示雾，不挂载页面也不发 app-assets 请求', async () => {
    localStorage.setItem(TOKEN_KEY, 'a-token')
    stubMetaRole('admin')
    renderRealAppAssets()

    expect(await screen.findByTestId('ops-fog')).toBeInTheDocument()
    expect(screen.getByText(/仅超级管理员可访问/)).toBeInTheDocument()
    expect(
      mockGet.mock.calls.some(([url]) => url === '/analytics/app-assets'),
    ).toBe(false)
  })
})

describe('RequireAuth 保留原始意图', () => {
  it('无 token 被重定向到 /login 时，把目标路径编码进 ?next=', () => {
    renderAt('/prompts')

    expect(screen.getByTestId('page-login')).toBeInTheDocument()
    expect(redirectedNext()).toBe('/prompts')
  })

  it('深链接的 query 整串保留，不只留 pathname', () => {
    renderAt('/prompts?key=k1&scene=s2')

    expect(redirectedNext()).toBe('/prompts?key=k1&scene=s2')
  })

  it('next 里的 & 与 = 被编码，不会污染登录页自己的参数', () => {
    renderAt('/prompts?key=k1&scene=s2')

    const search = screen.getByTestId('page-login').dataset.search ?? ''
    const params = new URLSearchParams(search)
    expect(params.get('key')).toBeNull()
    expect(params.get('scene')).toBeNull()
    expect([...params.keys()]).toEqual([LOGIN_NEXT_PARAM])
  })

  it('根路径也要带 next，登录后能回到用户原本请求的位置', () => {
    renderAt('/')

    expect(redirectedNext()).toBe('/')
  })

  it('有 token 时不重定向，next 不介入正常渲染', async () => {
    localStorage.setItem(TOKEN_KEY, 'a-token')
    renderAt('/prompts?key=k1')

    expect(await screen.findByTestId('page-prompts')).toBeInTheDocument()
    expect(screen.queryByTestId('page-login')).not.toBeInTheDocument()
  })
})
