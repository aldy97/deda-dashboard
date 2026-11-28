import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { apiClient } from '../../api/client'
import ParentDetail from './Detail'
import type { ParentDetailResponse } from '../../types/analytics'

/**
 * 家长档案页（以家长为锚）：一个家长可绑定多台设备。
 *
 * 设备信息与孩子档案共用同一份 /analytics/parents/:userId 响应、同一行设备，
 * 因此合并成一张表（设备 ID 不再重复出现两次），概览摘要挂到这张表的卡片表头；
 * 资料完整度整段下线（保留注释代码，不渲染）。
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
    phoneDuplicate: false,
    gender: 'female',
    birthday: '1990-05-20',
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

  it('按家长 ID 请求并渲染身份卡与合并后的单张表', async () => {
    renderPage()

    expect(await screen.findByText('家长档案')).toBeTruthy()
    expect(screen.getByText('以家长为锚：一个家长可绑定多台设备')).toBeTruthy()
    expect(mockGet).toHaveBeenCalledWith(
      `/analytics/parents/${encodeURIComponent(PARENT.user.id)}`,
    )
    expect(await screen.findByText('小明妈妈')).toBeTruthy()
    expect(screen.getByText('13800000000')).toBeTruthy()
    expect(screen.getByText('Apple')).toBeTruthy()
    expect(screen.getByText('女')).toBeTruthy()
    expect(screen.getByText('1990-05-20')).toBeTruthy()
    expect(screen.getAllByText(/2026-01-02/).length).toBeGreaterThanOrEqual(1)
    // 合并后全页只有一张表
    expect(document.querySelectorAll('.ant-table').length).toBe(1)
    // 品牌已定家长不支持自定义头像：页面上不应出现任何头像区块
    expect(screen.queryByText(/头像/)).toBeNull()
  })

  it('概览摘要挂到「绑定设备与孩子档案」卡片表头，不再是独立区块', async () => {
    renderPage()

    const cardTitle = await screen.findByText('绑定设备与孩子档案')
    const card = cardTitle.closest('.ant-card') as HTMLElement
    expect(card).toBeTruthy()
    expect(
      within(card).getByText('设备 2 台 · 孩子 1 位 · 反馈 3 条'),
    ).toBeTruthy()
    expect(screen.queryByText('概览')).toBeNull()
  })

  it('资料完整度整段下线：标题与四个完整度标记都不渲染', async () => {
    renderPage()

    expect(await screen.findByText('小明妈妈')).toBeTruthy()
    expect(screen.queryByText('资料完整度')).toBeNull()
    expect(screen.queryByText(/昵称：已填/)).toBeNull()
    expect(screen.queryByText(/手机号：已填/)).toBeNull()
    expect(screen.queryByText(/性别：已填/)).toBeNull()
    expect(screen.queryByText(/生日：已填/)).toBeNull()
  })

  it('同一行同时给出设备列与孩子档案列，设备 ID 不再重复', async () => {
    renderPage()

    // 身份卡的 Descriptions 也渲染成 table，必须按 antd 表格容器取表头
    const table = await waitFor(() => {
      const el = document.querySelector('.ant-table table')
      expect(el).toBeTruthy()
      return el as HTMLTableElement
    })

    const head = table.querySelector('thead') as HTMLElement
    for (const header of [
      '设备 ID',
      'IP',
      '固件',
      '角色',
      '绑定时间',
      '共享',
      '最近开机日',
      '孩子昵称',
      '英文名',
      '性别',
      '生日',
      '操作',
    ]) {
      expect(within(head).getByText(header)).toBeTruthy()
    }
    // 合并前设备 ID 在两张表里各出现一次；合并后每台设备只出现一次
    expect(screen.getAllByText('DEV-002').length).toBe(1)
    expect(screen.getByText('小宝')).toBeTruthy()
    expect(screen.getByText('Bao')).toBeTruthy()
    expect(screen.getByText('男')).toBeTruthy()
    expect(screen.getByText('2020-05-20')).toBeTruthy()
    expect(screen.getByText('未录入')).toBeTruthy()
    expect(screen.getByText('主账号')).toBeTruthy()
    expect(screen.getByText('绑定')).toBeTruthy()
    expect(screen.getByText('3 位家长')).toBeTruthy()
    expect(screen.getByText('2026-11-26')).toBeTruthy()
  })

  it('每行给出消息与设备反馈两个下钻链接', async () => {
    renderPage()

    const messageLinks = await screen.findAllByRole('link', { name: '消息' })
    expect(messageLinks.length).toBe(2)
    expect(
      messageLinks.map((a) => a.getAttribute('href')).sort(),
    ).toEqual(['/messages?deviceId=DEV-001', '/messages?deviceId=DEV-002'])

    const feedbackLinks = screen.getAllByRole('link', { name: '反馈' })
    expect(feedbackLinks.length).toBe(2)
    expect(
      feedbackLinks.map((a) => a.getAttribute('href')).sort(),
    ).toEqual([
      '/feedback?tab=user&deviceId=DEV-001',
      '/feedback?tab=user&deviceId=DEV-002',
    ])
  })

  it('手机号给复制图标，未绑定手机号时不渲染复制入口', async () => {
    const { unmount } = renderPage()

    expect(await screen.findByText('13800000000')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: '复制手机号' }),
    ).toBeTruthy()
    unmount()

    mockGet.mockResolvedValue({
      data: { ...PARENT, user: { ...PARENT.user, phone: null } },
    })
    renderPage()

    expect(await screen.findByText('未绑定')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '复制手机号' })).toBeNull()
  })

  it('手机号重复时展示黄色「重复」tag，未重复不展示', async () => {
    const { unmount } = renderPage()

    expect(await screen.findByText('13800000000')).toBeTruthy()
    expect(screen.queryByText('重复')).toBeNull()
    unmount()

    mockGet.mockResolvedValue({
      data: {
        ...PARENT,
        user: { ...PARENT.user, phoneDuplicate: true },
      },
    })
    renderPage()

    expect(await screen.findByText('重复')).toBeTruthy()
  })

  it('性别/生日缺失时给「未设置」', async () => {
    mockGet.mockResolvedValue({
      data: {
        ...PARENT,
        user: { ...PARENT.user, gender: null, birthday: null },
      },
    })
    renderPage()

    expect(await screen.findByText('13800000000')).toBeTruthy()
    expect(screen.getAllByText('未设置').length).toBeGreaterThanOrEqual(2)
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
          gender: null,
          birthday: null,
        },
      },
    })
    renderPage()

    expect(await screen.findByText('未设置昵称')).toBeTruthy()
    expect(screen.getByText('未绑定')).toBeTruthy()
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1)
  })

  it('点「刷新」重新拉取家长档案', async () => {
    renderPage()

    expect(await screen.findByText('小明妈妈')).toBeTruthy()
    const callsBefore = mockGet.mock.calls.length

    await userEvent.click(screen.getByRole('button', { name: /刷\s*新/ }))

    await waitFor(() =>
      expect(mockGet.mock.calls.length).toBeGreaterThan(callsBefore),
    )
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
