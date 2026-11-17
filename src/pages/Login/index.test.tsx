import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { adminLogin } from '../../api/analytics'
import { TOKEN_KEY, getToken, setToken } from '../../utils/auth-token'
import { buildLoginSearch } from '../../router/redirect'
import Login from './index'

/**
 * 登录页的跳转契约。
 *
 * 这里守的是「拿到 /adventure 链接却没登录」那个 bug 的出口端：
 * RequireAuth 已经把原始目标编码进 ?next=，登录成功后必须跳回那里，
 * 而不是无条件落 /overview。同时守三条容易在重构里被悄悄弄坏的规则：
 *
 * 1. next 是地址栏里可以随便改的，非法值必须回落默认页（开放重定向）；
 * 2. 登录失败不能把 next 弄丢，否则第二次输对密码就回不到原页面；
 * 3. 已登录守卫只在**带有效 next** 时才自动跳走——裸访问 /login 一律显示
 *    表单，否则 A 标签页登录着、B 标签页想换账号会被无声跳走。
 */

vi.mock('../../api/analytics', () => ({ adminLogin: vi.fn() }))

const mockLogin = adminLogin as unknown as ReturnType<typeof vi.fn>

/** 落地页替身：把 pathname + search 回显出来，好断言深链接有没有被整串还原 */
function LocationProbe({ label }: { label: string }) {
  const location = useLocation()
  return (
    <div data-testid={label}>{`${location.pathname}${location.search}`}</div>
  )
}

/** 登录页替身：额外把 router 里的 search 回显出来。
 *  不能断言 window.location.search——MemoryRouter 不同步真实地址栏。 */
function LoginRoute() {
  const location = useLocation()
  return (
    <>
      <Login />
      <div data-testid="login-search">{location.search}</div>
    </>
  )
}

function renderAt(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/overview" element={<LocationProbe label="at-overview" />} />
        <Route
          path="/adventure"
          element={<LocationProbe label="at-adventure" />}
        />
        <Route path="/messages" element={<LocationProbe label="at-messages" />} />
      </Routes>
    </MemoryRouter>,
  )
}

/** 走一遍真实的表单提交流程 */
async function submit(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('用户名'), 'admin')
  await user.type(screen.getByLabelText('密码'), 'pw')
  await user.click(screen.getByRole('button', { name: /登\s*录/ }))
}

beforeEach(() => {
  mockLogin.mockReset()
  localStorage.clear()
  sessionStorage.clear()
})

describe('登录成功后的落地页', () => {
  it('跳回 ?next= 指定的页面，而不是默认页', async () => {
    const user = userEvent.setup()
    mockLogin.mockResolvedValue({ token: 'tk-1' })
    renderAt(`/login${buildLoginSearch('/adventure')}`)

    await submit(user)

    expect(await screen.findByTestId('at-adventure')).toHaveTextContent(
      '/adventure',
    )
    expect(getToken()).toBe('tk-1')
  })

  it('深链接的 query 整串还原，抽屉状态不丢', async () => {
    const user = userEvent.setup()
    mockLogin.mockResolvedValue({ token: 'tk-1' })
    renderAt(
      `/login${buildLoginSearch('/adventure', '?tab=episodes&episodeId=X')}`,
    )

    await submit(user)

    expect(await screen.findByTestId('at-adventure')).toHaveTextContent(
      '/adventure?tab=episodes&episodeId=X',
    )
  })

  it('没有 next 时落到默认页 /overview', async () => {
    const user = userEvent.setup()
    mockLogin.mockResolvedValue({ token: 'tk-1' })
    renderAt('/login')

    await submit(user)

    expect(await screen.findByTestId('at-overview')).toBeInTheDocument()
  })

  it('next 是站外地址时落到默认页，不跟着跳走', async () => {
    const user = userEvent.setup()
    mockLogin.mockResolvedValue({ token: 'tk-1' })
    renderAt('/login?next=%2F%2Fevil.com')

    await submit(user)

    expect(await screen.findByTestId('at-overview')).toBeInTheDocument()
    expect(screen.queryByTestId('at-adventure')).not.toBeInTheDocument()
  })

  it('next 指向登录页自身时落到默认页，不自我重定向成死循环', async () => {
    const user = userEvent.setup()
    mockLogin.mockResolvedValue({ token: 'tk-1' })
    renderAt('/login?next=%2Flogin')

    await submit(user)

    expect(await screen.findByTestId('at-overview')).toBeInTheDocument()
  })

  it('token 写进 localStorage，不写 sessionStorage（否则活不过标签页会话）', async () => {
    const user = userEvent.setup()
    mockLogin.mockResolvedValue({ token: 'tk-1' })
    renderAt('/login')

    await submit(user)

    await screen.findByTestId('at-overview')
    expect(localStorage.getItem(TOKEN_KEY)).toBe('tk-1')
    expect(sessionStorage.getItem(TOKEN_KEY)).toBeNull()
  })
})

describe('登录失败', () => {
  it('停在登录页并显示错误，next 原样保留', async () => {
    const user = userEvent.setup()
    mockLogin.mockRejectedValue(Object.assign(new Error('nope'), { status: 401 }))
    renderAt(`/login${buildLoginSearch('/messages', '?deviceId=d1')}`)

    await submit(user)

    expect(await screen.findByText('用户名或密码错误')).toBeInTheDocument()
    expect(screen.getByLabelText('用户名')).toBeInTheDocument()
    // 意图必须还在地址栏里，否则第二次输对密码就回不到原页面
    const search = screen.getByTestId('login-search').textContent ?? ''
    expect(new URLSearchParams(search).get('next')).toBe(
      '/messages?deviceId=d1',
    )
  })

  it('非 401 的 Error 直接显示它的 message', async () => {
    const user = userEvent.setup()
    mockLogin.mockRejectedValue(new Error('网络不通'))
    renderAt('/login')

    await submit(user)

    expect(await screen.findByText('网络不通')).toBeInTheDocument()
  })

  it('抛出的不是 Error 时回落到通用文案', async () => {
    const user = userEvent.setup()
    mockLogin.mockRejectedValue('boom')
    renderAt('/login')

    await submit(user)

    expect(await screen.findByText('登录失败，请稍后重试')).toBeInTheDocument()
  })

  it('第二次登录成功仍能跳回原意图', async () => {
    const user = userEvent.setup()
    mockLogin.mockRejectedValueOnce(Object.assign(new Error('nope'), { status: 401 }))
    mockLogin.mockResolvedValueOnce({ token: 'tk-2' })
    renderAt(`/login${buildLoginSearch('/messages', '?deviceId=d1')}`)

    await submit(user)
    await screen.findByText('用户名或密码错误')
    await submit(user)

    expect(await screen.findByTestId('at-messages')).toHaveTextContent(
      '/messages?deviceId=d1',
    )
  })
})

describe('已登录访问 /login 的守卫', () => {
  it('带着有效 next 时直接送回原页面，不再要求登录一次', () => {
    setToken('tk-existing')
    renderAt(`/login${buildLoginSearch('/adventure')}`)

    expect(screen.getByTestId('at-adventure')).toBeInTheDocument()
    expect(screen.queryByLabelText('用户名')).not.toBeInTheDocument()
  })

  it('裸访问 /login 时照常显示表单，方便换账号', () => {
    setToken('tk-existing')
    renderAt('/login')

    expect(screen.getByLabelText('用户名')).toBeInTheDocument()
    expect(screen.queryByTestId('at-overview')).not.toBeInTheDocument()
  })

  it('next 非法时不自动跳走，仍然显示表单', () => {
    setToken('tk-existing')
    renderAt('/login?next=%2F%2Fevil.com')

    expect(screen.getByLabelText('用户名')).toBeInTheDocument()
  })
})
