import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { apiClient } from '../api/client'
import { TOKEN_KEY } from '../utils/auth-token'
import AdminLayout from './AdminLayout'
import { selectedMenuKey } from './menu'

/**
 * 布局层契约：环境标签与 提示词管理入口。
 *
 * 环境标签挂在 Sider 标题旁，是管理员判断「我在改哪个环境」的唯一常驻提示，
 * 所以这里盯三件事：
 * 1. 标签只信 /analytics/meta：请求失败落「未知环境」，请求中暂时隐藏（都 fail-closed）；
 * 2. 菜单里真的有 提示词管理，点了能跳到 /prompts；
 * 3. 退出登录清 localStorage 的 token。
 */
vi.mock('../api/client', () => ({
  apiClient: { get: vi.fn() },
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
          <Route
            path="/users/:deviceId"
            element={<div data-testid="page-user-device" />}
          />
          <Route path="/adventure" element={<div data-testid="page-adventure" />} />
        </Route>
      </Routes>
    </MemoryRouter>,
    { wrapper: createWrapper() },
  )
}

beforeEach(() => {
  mockGet.mockReset()
  localStorage.clear()
})

describe('AdminLayout 标题与环境标签', () => {
  it('Sider 里 logo、标题、环境标签在同一行', async () => {
    stubMeta({
      nodeEnv: 'staging',
      promptWriteEnabled: true,
      publishConfirmCode: 'DEDA2025',
    })
    renderLayout()

    const header = screen.getByTestId('brand-header')
    expect(header).toHaveStyle('flex-wrap: nowrap')
    expect(header).toContainElement(screen.getByTestId('brand-logo'))
    expect(header).toContainElement(screen.getByText('Deda Dashboard'))

    const tag = await screen.findByTestId('env-tag')
    await waitFor(() => expect(tag.dataset.tone).toBe('staging'))
    expect(header).toContainElement(tag)
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

    const tag = await screen.findByTestId('env-tag')
    await waitFor(() => expect(tag.dataset.tone).toBe(tone))
    expect(tag).toHaveTextContent(text)
  })

  it('meta 请求失败：标签落「未知环境」，不猜一个环境出来', async () => {
    stubMeta(null, new Error('网络不通'))
    renderLayout()

    const tag = await screen.findByTestId('env-tag')
    await waitFor(() => expect(tag).toHaveTextContent('未知环境'))
    expect(tag.dataset.tone).toBe('unknown')
  })

  it('meta 还在路上：环境标签暂时隐藏', () => {
    stubMeta(null)
    renderLayout()

    expect(screen.queryByTestId('env-tag')).not.toBeInTheDocument()
    expect(screen.getByText('Deda Dashboard')).toBeInTheDocument()
  })
})

describe('AdminLayout 菜单与路由', () => {
  it('菜单里有「提示词管理」，点击后路由变 /prompts 并挂载对应页面', async () => {
    stubMeta({
      nodeEnv: 'staging',
      promptWriteEnabled: true,
      publishConfirmCode: 'DEDA2025',
    })
    renderLayout()

    const item = screen.getByRole('menuitem', { name: /提示词管理/ })
    await userEvent.click(item)

    await waitFor(() =>
      expect(screen.getByTestId('location-pathname')).toHaveTextContent(
        '/prompts',
      ),
    )
    expect(screen.getByTestId('page-prompts')).toBeInTheDocument()
    expect(item).toHaveClass('ant-menu-item-selected')
  })

  it('直接进 /prompts 时菜单高亮 提示词管理', async () => {
    stubMeta({
      nodeEnv: 'production',
      promptWriteEnabled: false,
      publishConfirmCode: 'DEDA2025',
    })
    renderLayout('/prompts')

    expect(screen.getByTestId('page-prompts')).toBeInTheDocument()
    expect(
      screen.getByRole('menuitem', { name: /提示词管理/ }),
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

  it('用户详情页 /users/:deviceId 高亮「用户画像」（此前无选中项）', () => {
    stubMeta({
      nodeEnv: 'development',
      promptWriteEnabled: true,
      publishConfirmCode: 'DEDA2025',
    })
    renderLayout('/users/dev-001')

    expect(screen.getByTestId('page-user-device')).toBeInTheDocument()
    expect(
      screen.getByRole('menuitem', { name: /用户画像/ }),
    ).toHaveClass('ant-menu-item-selected')
  })

  it('冒险内容工作台 /adventure 高亮「冒险内容」', () => {
    stubMeta({
      nodeEnv: 'development',
      promptWriteEnabled: true,
      publishConfirmCode: 'DEDA2025',
    })
    renderLayout('/adventure')

    expect(screen.getByTestId('page-adventure')).toBeInTheDocument()
    expect(
      screen.getByRole('menuitem', { name: /冒险内容/ }),
    ).toHaveClass('ant-menu-item-selected')
  })
})

/**
 * 菜单分组：12 项扁平列表已到可读性上限，按阅读动线显式分四组。
 * 分组标题只是视觉分隔（antd Menu 的 group），不改路由、不加折叠层级。
 */
describe('AdminLayout 菜单分组', () => {
  const GROUPS = ['概览与增长', '用户与体验', '资产与明细', '运维与配置']

  it.each([
    ['/overview', ['/overview']],
    ['/users/dev-001', ['/users']],
    ['/memories/dev-001', ['/memories']],
    ['/adventure', ['/adventure']],
    ['/', []],
  ])('路径 %s 的选中菜单项是 %j', (pathname, expected) => {
    expect(selectedMenuKey(pathname)).toEqual(expected)
  })

  it('四个分组标题都渲染出来', () => {
    stubMeta({
      nodeEnv: 'development',
      promptWriteEnabled: true,
      publishConfirmCode: 'DEDA2025',
    })
    renderLayout()

    for (const title of GROUPS) {
      expect(screen.getByText(title)).toBeInTheDocument()
    }
  })

  it('14 个入口一个不少（分组不能顺手丢菜单项）', () => {
    stubMeta({
      nodeEnv: 'development',
      promptWriteEnabled: true,
      publishConfirmCode: 'DEDA2025',
    })
    renderLayout()

    const expected = [
      '总览',
      '留存与激活',
      '使用行为',
      '用户画像',
      '记忆档案',
      '内容与质量',
      '用户反馈',
      '设备舰队',
      '消息明细',
      '模型监控',
      '冒险内容',
      '测试设备白名单',
      '提示词管理',
      '语速与音色',
    ]
    const items = screen.getAllByRole('menuitem')
    expect(items).toHaveLength(expected.length)
    // 顺序也要钉住：冒险内容必须落在运维组内部，而不是回到用户组
    expect(items.map((item) => item.textContent)).toEqual(
      expected.map((label) => expect.stringContaining(label)),
    )
    for (const label of expected) {
      expect(screen.getByRole('menuitem', { name: new RegExp(label) })).toBeInTheDocument()
    }
  })

  it('普通 admin 在运维组标题旁看到锁标（菜单仍可点，进去才会出雾）', async () => {
    stubMeta({
      nodeEnv: 'development',
      promptWriteEnabled: true,
      publishConfirmCode: 'DEDA2025',
      admin: { username: 'ops', displayName: '运营', role: 'admin' },
    })
    renderLayout()

    expect(
      await screen.findByLabelText('仅超级管理员可访问'),
    ).toBeInTheDocument()
    // 菜单项不能禁用：点不进去就看不到「雾 + 原因」
    expect(
      screen.getByRole('menuitem', { name: /提示词管理/ }),
    ).not.toHaveAttribute('aria-disabled', 'true')
  })

  it('superadmin 没有锁标', async () => {
    stubMeta({
      nodeEnv: 'development',
      promptWriteEnabled: true,
      publishConfirmCode: 'DEDA2025',
      admin: { username: 'superadmin', displayName: '超管', role: 'superadmin' },
    })
    renderLayout()

    // 等 meta 落地，避免把「还没确认权限」误判成 superadmin
    await waitFor(() =>
      expect(screen.getByTestId('env-tag')).toHaveTextContent('本地'),
    )
    expect(screen.queryByLabelText('仅超级管理员可访问')).toBeNull()
  })
})

describe('AdminLayout 退出登录', () => {
  it('清掉 localStorage 的 token 并跳到 /login', async () => {
    stubMeta({
      nodeEnv: 'staging',
      promptWriteEnabled: true,
      publishConfirmCode: 'DEDA2025',
    })
    localStorage.setItem(TOKEN_KEY, 'a-token')
    renderLayout()

    await userEvent.click(screen.getByRole('button', { name: '退出登录' }))

    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
    await waitFor(() =>
      expect(screen.getByTestId('location-pathname')).toHaveTextContent(
        '/login',
      ),
    )
  })
})
