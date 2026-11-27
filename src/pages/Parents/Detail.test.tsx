import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { apiClient } from '../../api/client'
import ParentDetail from './Detail'
import type { ParentDetailResponse } from '../../types/analytics'

/**
 * 家长档案页（以家长为锚）：一个家长可绑定多台设备，设备表与孩子档案表
 * 由同一份 /analytics/parents/:userId 响应驱动。
 */

vi.mock('../../api/client', () => ({
  apiClient: { get: vi.fn() },
}))

const mockGet = apiClient.get as unknown as ReturnType<typeof vi.fn>

const PARENT: ParentDetailResponse = {
  user: {
    id: '9f8b7c6d-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
    nickname: '小明妈妈',
    phone: '13800000000',
    registeredAt: '2026-01-02T03:04:05.000Z',
    phoneMaker: 'Apple',
  },
  summary: { deviceCount: 2, childCount: 1, feedbackCount: 3 },
  devices: [
    {
      deviceId: 'DEV-001',
      deviceCode: 'CODE-001',
      characterKey: 'elly',
      firmwareVersion: '1.2.3',
      networkType: 'wifi',
      isOwner: true,
      boundAt: '2026-03-01T08:00:00.000Z',
      boundUserCount: 3,
      lastPresenceDate: '2026-11-26',
      childProfile: {
        name: '小宝',
        englishName: 'Bao',
        gender: 'male',
        birthday: '2020-05-20',
      },
    },
    {
      deviceId: 'DEV-002',
      deviceCode: null,
      characterKey: 'polly',
      firmwareVersion: null,
      networkType: null,
      isOwner: false,
      boundAt: '2026-04-02T09:30:00.000Z',
      boundUserCount: 1,
      lastPresenceDate: null,
      childProfile: null,
    },
  ],
}

function renderPage(userId = PARENT.user.id) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/parents/${userId}`]}>
        <Routes>
          <Route path="/parents/:userId" element={<ParentDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('家长档案页', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockGet.mockResolvedValue({ data: PARENT })
  })

  it('按家长 ID 请求并渲染身份卡、资料完整度与概览', async () => {
    renderPage()

    expect(await screen.findByText('家长档案')).toBeTruthy()
    expect(screen.getByText('以家长为锚：一个家长可绑定多台设备')).toBeTruthy()
    expect(mockGet).toHaveBeenCalledWith(
      `/analytics/parents/${encodeURIComponent(PARENT.user.id)}`,
    )
    expect(await screen.findByText('小明妈妈')).toBeTruthy()
    expect(screen.getByText('13800000000')).toBeTruthy()
    expect(screen.getByText('Apple')).toBeTruthy()
    expect(screen.getAllByText(/2026-01-02/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('昵称：已填')).toBeTruthy()
    expect(screen.getByText('手机号：已填')).toBeTruthy()
    expect(screen.getByText('设备 2 台 · 孩子 1 位 · 反馈 3 条')).toBeTruthy()
    // 品牌已定家长不支持自定义头像：页面上不应出现任何头像区块
    expect(screen.queryByText(/头像/)).toBeNull()
  })

  it('设备表渲染链接、角色、共享与最近开机日，孩子档案缺失给「未录入」', async () => {
    renderPage()

    const link = await screen.findByRole('link', { name: 'DEV-001' })
    expect(link.getAttribute('href')).toBe('/users/DEV-001')
    expect(screen.getAllByText('DEV-002').length).toBe(2)
    expect(screen.getByText('主账号')).toBeTruthy()
    expect(screen.getByText('绑定')).toBeTruthy()
    expect(screen.getByText('elly')).toBeTruthy()
    expect(screen.getByText('polly')).toBeTruthy()
    expect(screen.getByText('3 位家长')).toBeTruthy()
    expect(screen.getByText('2026-11-26')).toBeTruthy()
    expect(screen.getByText('小宝')).toBeTruthy()
    expect(screen.getByText('Bao')).toBeTruthy()
    expect(screen.getByText('男')).toBeTruthy()
    expect(screen.getByText('2020-05-20')).toBeTruthy()
    expect(screen.getByText('未录入')).toBeTruthy()
  })

  it('昵称/手机号/厂商缺失时给可见占位', async () => {
    mockGet.mockResolvedValue({
      data: {
        ...PARENT,
        user: {
          ...PARENT.user,
          nickname: null,
          phone: null,
          phoneMaker: null,
        },
      },
    })
    renderPage()

    expect(await screen.findByText('未设置昵称')).toBeTruthy()
    expect(screen.getByText('未绑定')).toBeTruthy()
    expect(screen.getByText('昵称：未填')).toBeTruthy()
    expect(screen.getByText('手机号：未填')).toBeTruthy()
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1)
  })

  it('家长不存在（404）给空态而不是错误横幅', async () => {
    mockGet.mockRejectedValue(
      Object.assign(new Error('parent not found'), { status: 404 }),
    )
    renderPage()

    expect(await screen.findByText('家长不存在')).toBeTruthy()
  })

  it('其它错误渲染 Alert 并带出服务端消息', async () => {
    mockGet.mockRejectedValue(new Error('boom'))
    renderPage()

    expect(await screen.findByText('家长档案加载失败')).toBeTruthy()
    expect(screen.getByText('boom')).toBeTruthy()
  })

  it('设备为 0 台时整页给 Empty', async () => {
    mockGet.mockResolvedValue({
      data: {
        ...PARENT,
        summary: { deviceCount: 0, childCount: 0, feedbackCount: 0 },
        devices: [],
      },
    })
    renderPage()

    expect(await screen.findByText('该家长尚未绑定设备')).toBeTruthy()
  })

  it('提供返回用户画像入口', async () => {
    renderPage()

    const back = await screen.findByRole('link', { name: /返回用户画像/ })
    expect(back.getAttribute('href')).toBe('/users')
  })
})
