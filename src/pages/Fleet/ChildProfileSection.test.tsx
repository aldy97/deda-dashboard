import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { apiClient } from '../../api/client'
import ChildProfileSection from './ChildProfileSection'

vi.mock('../../api/client', () => ({
  apiClient: { get: vi.fn(), delete: vi.fn() },
}))

const mockGet = apiClient.get as unknown as ReturnType<typeof vi.fn>
const mockDelete = apiClient.delete as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  // 防跨用例泄漏：「加载中」用例的 pending 默认实现不清掉会挂住后续失效重试
  mockGet.mockReset()
  mockDelete.mockReset()
})

const PROFILE_URL = '/analytics/fleet/devices/dev-1/child-profile'

function makeProfile(overrides: Record<string, unknown> = {}) {
  return {
    name: '二狗',
    birthday: '2018-05-20',
    englishName: 'Lebron',
    gender: 'male',
    ...overrides,
  }
}

function renderSection() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ChildProfileSection deviceId="dev-1" />
    </QueryClientProvider>,
  )
}

describe('ChildProfileSection', () => {
  it('加载中显示加载态，不渲染清空按钮', () => {
    mockGet.mockReturnValue(new Promise(() => {}))
    renderSection()

    expect(screen.getByText('孩子信息')).toBeTruthy()
    expect(screen.getByText('加载中…')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /清\s*空/ })).toBeNull()
  })

  it('展示姓名/英文名/性别/生日与换算年龄', async () => {
    mockGet.mockResolvedValueOnce({ data: { profile: makeProfile() } })
    renderSection()

    expect(await screen.findByText('孩子信息')).toBeTruthy()
    expect(await screen.findByText('二狗')).toBeTruthy()
    expect(screen.getByText('Lebron')).toBeTruthy()
    expect(screen.getByText('男')).toBeTruthy()
    // birthday 2018-05-20 在 2027 年前恒为 8 岁
    expect(screen.getByText(/2018-05-20.*8岁|8岁.*2018-05-20/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /清\s*空/ })).toBeTruthy()
  })

  it('女性档案渲染「女」', async () => {
    mockGet.mockResolvedValueOnce({
      data: { profile: makeProfile({ gender: 'female' }) },
    })
    renderSection()

    expect(await screen.findByText('女')).toBeTruthy()
  })

  it('档案未设置：空态文案且不渲染清空按钮', async () => {
    mockGet.mockResolvedValueOnce({ data: { profile: null } })
    renderSection()

    expect(await screen.findByText('未设置孩子档案')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /清\s*空/ })).toBeNull()
  })

  it('英文名/性别/生日为空时渲染占位符 —', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        profile: makeProfile({
          birthday: null,
          englishName: null,
          gender: null,
        }),
      },
    })
    renderSection()

    expect(await screen.findByText('二狗')).toBeTruthy()
    // 英文名、性别、生日三处占位
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3)
  })

  it('加载失败：错误态且不渲染清空按钮', async () => {
    mockGet.mockRejectedValueOnce(new Error('boom'))
    renderSection()

    expect(await screen.findByText(/加载失败/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /清\s*空/ })).toBeNull()
  })

  it('Popconfirm 取消：不发起 DELETE', async () => {
    const user = userEvent.setup()
    mockGet.mockResolvedValueOnce({ data: { profile: makeProfile() } })
    renderSection()
    await screen.findByText('二狗')

    await user.click(screen.getByRole('button', { name: /清\s*空/ }))
    await user.click(await screen.findByRole('button', { name: /取\s*消/ }))

    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('Popconfirm 确认：DELETE 后失效缓存回到未设置态', async () => {
    const user = userEvent.setup()
    mockGet
      .mockResolvedValueOnce({ data: { profile: makeProfile() } })
      .mockResolvedValueOnce({ data: { profile: null } })
    mockDelete.mockResolvedValueOnce({ data: { deleted: true } })
    renderSection()
    await screen.findByText('二狗')

    await user.click(screen.getByRole('button', { name: /清\s*空/ }))
    await user.click(
      await screen.findByRole('button', { name: /确\s*认/ }),
    )

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith(PROFILE_URL))
    expect(await screen.findByText('未设置孩子档案')).toBeTruthy()
  })

  it('DELETE 失败：提示清空失败且不改动展示', async () => {
    const user = userEvent.setup()
    mockGet.mockResolvedValueOnce({ data: { profile: makeProfile() } })
    mockDelete.mockRejectedValueOnce(new Error('server exploded'))
    renderSection()
    await screen.findByText('二狗')

    await user.click(screen.getByRole('button', { name: /清\s*空/ }))
    await user.click(
      await screen.findByRole('button', { name: /确\s*认/ }),
    )

    expect(await screen.findByText(/清空失败/)).toBeTruthy()
    expect(screen.getByText('二狗')).toBeTruthy()
  })
})
