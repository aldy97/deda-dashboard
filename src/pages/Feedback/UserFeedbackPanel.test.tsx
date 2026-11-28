import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { apiClient } from '../../api/client'
import UserFeedbackPanel from './UserFeedbackPanel'
import type {
  UserFeedbackItem,
  UserFeedbackListResponse,
} from '../../types/analytics'

vi.mock('../../api/client', () => ({
  apiClient: { get: vi.fn() },
  TOKEN_KEY: 'deda_dashboard_token',
}))

const mockGet = apiClient.get as unknown as ReturnType<typeof vi.fn>

const EMPTY_RESPONSE: UserFeedbackListResponse = {
  total: 0,
  page: 1,
  pageSize: 20,
  items: [],
}

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="search">{location.search}</div>
}

function renderPanel(entry = '/feedback?tab=user') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <UserFeedbackPanel />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function search(): string {
  return screen.getByTestId('search').textContent ?? ''
}

/** 最后一次 /analytics/feedback/user-feedbacks 调用的查询参数 */
function lastUserFeedbackParams(): Record<string, unknown> | undefined {
  const calls = mockGet.mock.calls.filter(
    (call: unknown[]) => call[0] === '/analytics/feedback/user-feedbacks',
  )
  if (calls.length === 0) return undefined
  return (calls[calls.length - 1][1] as { params?: Record<string, unknown> })?.params
}

describe('UserFeedbackPanel · deviceId 预筛', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockGet.mockResolvedValue({ data: EMPTY_RESPONSE })
  })

  it('?deviceId= 传入后 API 请求带 deviceId 参数', async () => {
    renderPanel('/feedback?tab=user&deviceId=dev-abc')

    await waitFor(() => {
      const params = lastUserFeedbackParams()
      expect(params?.deviceId).toBe('dev-abc')
    })
  })

  it('无 ?deviceId= 时 API 请求不带 deviceId', async () => {
    renderPanel('/feedback?tab=user')

    // 先确认请求真的发出去了，否则「deviceId 是 undefined」会因为根本没调用而假通过
    await waitFor(() => {
      expect(lastUserFeedbackParams()).toBeDefined()
    })
    expect(lastUserFeedbackParams()?.deviceId).toBeUndefined()
  })

  it('渲染可关闭 Tag「设备：X」', async () => {
    renderPanel('/feedback?tab=user&deviceId=dev-abc')

    expect(await screen.findByText(/设备：dev-abc/)).toBeTruthy()
  })

  it('关闭 Tag 后清掉 deviceId 并恢复全量', async () => {
    renderPanel('/feedback?tab=user&deviceId=dev-abc')

    const tag = await screen.findByText(/设备：dev-abc/)
    const closeBtn = tag.querySelector('.ant-tag-close-icon')
    expect(closeBtn).not.toBeNull()
    fireEvent.click(closeBtn as Element)

    // URL 不再有 deviceId
    await waitFor(() => {
      expect(search()).not.toContain('deviceId')
    })

    // API 请求也不带 deviceId
    const params = lastUserFeedbackParams()
    expect(params?.deviceId).toBeUndefined()
  })
})
describe('UserFeedbackPanel · 联系方式链接/复制/重复标记', () => {
  const ITEM: UserFeedbackItem = {
    id: 'fb1',
    userId: '9f8b7c6d-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
    content: '希望增加夜间模式',
    contact: '13800138000',
    contactDuplicate: true,
    createdAt: '2026-11-05T02:00:00.000Z',
    user: { nickname: '熊妈妈', phone: '13800138000' },
  }

  beforeEach(() => {
    mockGet.mockReset()
  })

  it('联系方式链接到对应家长画像，带复制按钮与「重复」标记', async () => {
    mockGet.mockResolvedValue({
      data: { total: 1, page: 1, pageSize: 20, items: [ITEM] },
    })

    renderPanel()

    const link = await screen.findByRole('link', { name: '13800138000' })
    expect(link.getAttribute('href')).toBe(
      `/parents/${encodeURIComponent(ITEM.userId!)}`,
    )
    expect(screen.getByText('重复')).toBeTruthy()
    expect(document.querySelector('.ant-typography-copy')).not.toBeNull()
  })

  it('不重复时不渲染「重复」标记', async () => {
    mockGet.mockResolvedValue({
      data: {
        total: 1,
        page: 1,
        pageSize: 20,
        items: [{ ...ITEM, contactDuplicate: false }],
      },
    })

    renderPanel()

    expect(await screen.findByRole('link', { name: '13800138000' })).toBeTruthy()
    expect(screen.queryByText('重复')).toBeNull()
  })

  it('用户已注销（userId=null）时号码不渲染成链接', async () => {
    mockGet.mockResolvedValue({
      data: {
        total: 1,
        page: 1,
        pageSize: 20,
        items: [{ ...ITEM, userId: null, user: null }],
      },
    })

    renderPanel()

    expect(await screen.findByText('13800138000')).toBeTruthy()
    expect(
      screen.queryByRole('link', { name: '13800138000' }),
    ).toBeNull()
  })

  it('联系方式为空时只显示占位，不渲染复制与重复标记', async () => {
    mockGet.mockResolvedValue({
      data: {
        total: 1,
        page: 1,
        pageSize: 20,
        items: [{ ...ITEM, contact: null, contactDuplicate: false }],
      },
    })

    renderPanel()

    expect(await screen.findByText('—')).toBeTruthy()
    expect(screen.queryByText('重复')).toBeNull()
    expect(document.querySelector('.ant-typography-copy')).toBeNull()
  })
})
