import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { apiClient } from '../../api/client'
import ParentDetail from './Detail'
import type { ParentDetailResponse } from '../../types/analytics'
import { stubClipboard } from '../../test/clipboard'

/**
 * 家长档案页（以家长为锚）：一个家长可绑定多台设备。
 *
 * 设备信息与孩子档案共用同一份 /analytics/parents/:userId 响应、同一行设备，
 * 因此合并成一张表；概览摘要挂到卡片表头；资料完整度、共享、角色三块整段下线
 * （保留注释代码，不渲染）。设备 ID 补白名单备注与复制，IP 列直达角色人设提示词，
 * 操作收敛成一个下拉。
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

const META_SUPERADMIN = {
  nodeEnv: 'development',
  promptWriteEnabled: true,
  publishConfirmCode: 'X',
  admin: { username: 'u', displayName: 'U', role: 'superadmin' },
}

const WHITELIST = {
  enabled: { adventure: true },
  total: 1,
  items: [
    {
      id: 'w1',
      active: true,
      note: '3 号样机-熊枫',
      addedBy: 'u',
      addedAt: '2026-11-01T00:00:00.000Z',
      addedReason: null,
      revokedBy: null,
      revokedAt: null,
      revokeReason: null,
      device: {
        id: 'uuid-1',
        deviceId: 'DEV-001',
        deviceCode: null,
        macAddress: null,
        characterKey: 'elly',
        firmwareVersion: null,
      },
    },
  ],
}

function mockRoutes(overrides: Record<string, unknown> = {}) {
  mockGet.mockImplementation((url: string) => {
    if (url in overrides) return Promise.resolve({ data: overrides[url] })
    if (url === '/analytics/meta') return Promise.resolve({ data: META_SUPERADMIN })
    if (url === '/analytics/test-devices')
      return Promise.resolve({ data: WHITELIST })
    if (url.startsWith('/analytics/parents/'))
      return Promise.resolve({ data: PARENT })
    return Promise.resolve({ data: null })
  })
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

function mergedTableHead() {
  const table = document.querySelector('.ant-table table') as HTMLTableElement
  return within(table.querySelector('thead') as HTMLElement)
}

describe('家长档案页', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockRoutes()
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
    expect(screen.queryByText(/头像/)).toBeNull()
  })

  it('概览摘要挂到「绑定设备与孩子档案」卡片表头，不再是独立区块', async () => {
    renderPage()

    const cardTitle = await screen.findByText('绑定设备与孩子档案')
    const card = cardTitle.closest('.ant-card') as HTMLElement
    expect(
      within(card).getByText('设备 2 台 · 孩子 1 位 · 反馈 3 条'),
    ).toBeTruthy()
    expect(screen.queryByText('概览')).toBeNull()
  })

  it('资料完整度、共享、角色三块整段下线', async () => {
    renderPage()

    expect(await screen.findByText('小明妈妈')).toBeTruthy()
    expect(screen.queryByText('资料完整度')).toBeNull()
    expect(screen.queryByText(/昵称：已填/)).toBeNull()
    expect(screen.queryByText(/手机号：已填/)).toBeNull()
    expect(screen.queryByText(/性别：已填/)).toBeNull()
    expect(screen.queryByText(/生日：已填/)).toBeNull()

    // 共享 / 角色两列不再出现在表头与单元格
    expect(mergedTableHead().queryByText('共享')).toBeNull()
    expect(mergedTableHead().queryByText('角色')).toBeNull()
    expect(screen.queryByText('主账号')).toBeNull()
    expect(screen.queryByText('3 位家长')).toBeNull()
  })

  it('同一行同时给出设备列与孩子档案列，设备 ID 不再重复', async () => {
    renderPage()

    const head = await waitFor(() => {
      const el = document.querySelector('.ant-table thead')
      expect(el).toBeTruthy()
      return el as HTMLElement
    })

    for (const header of [
      '设备 ID',
      'IP',
      '固件',
      '绑定时间',
      '最近开机日',
      '孩子昵称',
      '英文名',
      '性别',
      '生日',
      '操作',
    ]) {
      expect(within(head).getByText(header)).toBeTruthy()
    }
    expect(screen.getAllByText('DEV-002').length).toBe(1)
    expect(screen.getByText('小宝')).toBeTruthy()
    expect(screen.getByText('Bao')).toBeTruthy()
    expect(screen.getByText('男')).toBeTruthy()
    expect(screen.getByText('2020-05-20')).toBeTruthy()
    expect(screen.getByText('未录入')).toBeTruthy()
    expect(screen.getByText('2026-11-26')).toBeTruthy()
  })

  it('IP 列直达该角色的人设提示词，角色 key 非法时退化为纯文本', async () => {
    renderPage()

    expect(await screen.findByText('小明妈妈')).toBeTruthy()
    const elly = screen.getByRole('link', { name: 'elly' })
    expect(elly.getAttribute('href')).toBe('/prompts?key=persona_elly')
    const polly = screen.getByRole('link', { name: 'polly' })
    expect(polly.getAttribute('href')).toBe('/prompts?key=persona_polly')

    mockGet.mockReset()
    mockRoutes({
      '/analytics/parents/9f8b7c6d-1a2b-4c3d-8e9f-0a1b2c3d4e5f': {
        ...PARENT,
        devices: [{ ...PARENT.devices[0], characterKey: 'Bad Key' }],
      },
    })
    renderPage()

    expect(await screen.findByText('Bad Key')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Bad Key' })).toBeNull()
  })

  it('超管：设备 ID 带白名单备注 Tag，复制按钮复制的是业务设备 ID', async () => {
    const writeText = stubClipboard()
    renderPage()

    expect(await screen.findByText('3 号样机-熊枫')).toBeTruthy()
    expect(mockGet.mock.calls.some(([url]) => url === '/analytics/test-devices')).toBe(
      true,
    )

    const cells = screen.getAllByTestId('device-id-cell')
    expect(cells.length).toBe(2)
    // 业务设备 ID 比舰队页更长：首列放宽到 116px，避免被省略号截断
    expect(cells[0].style.gridTemplateColumns).toContain('116px')

    // 设备 ID 列的单元格右侧不留 padding，复制图标/备注 Tag 贴住列边界
    // 跳过 scroll.x 渲染的隐藏测量行
    const firstCell = document.querySelector(
      '.ant-table-tbody tr.ant-table-row td:first-child',
    ) as HTMLElement
    expect(firstCell.style.paddingRight).toBe('0px')
    // 不在册的那台没有 Tag
    expect(
      within(cells[1]).queryByTestId('device-whitelist-tag'),
    ).toBeNull()

    await userEvent.click(
      within(cells[0]).getByRole('button', { name: '复制设备 ID' }),
    )
    expect(writeText).toHaveBeenCalledWith('DEV-001')
  })

  it('非超管：不请求白名单、不显示 Tag，但复制入口照常可用', async () => {
    mockGet.mockReset()
    mockRoutes({
      '/analytics/meta': {
        ...META_SUPERADMIN,
        admin: { username: 'u', displayName: 'U', role: 'admin' },
      },
    })
    renderPage()

    expect(await screen.findByText('小明妈妈')).toBeTruthy()
    expect(mockGet.mock.calls.some(([url]) => url === '/analytics/test-devices')).toBe(
      false,
    )
    expect(screen.queryByText('3 号样机-熊枫')).toBeNull()
    expect(
      screen.getAllByRole('button', { name: '复制设备 ID' }).length,
    ).toBe(2)
  })

  it('操作列是聚合下拉：查看消息 / 查看反馈带设备预筛', async () => {
    renderPage()

    expect(await screen.findByText('小明妈妈')).toBeTruthy()
    await userEvent.click(
      screen.getAllByRole('button', { name: '操作' })[0],
    )

    const messageLink = await screen.findByRole('link', { name: '查看消息' })
    expect(messageLink.getAttribute('href')).toBe('/messages?deviceId=DEV-001')
    const feedbackLink = screen.getByRole('link', { name: '查看反馈' })
    expect(feedbackLink.getAttribute('href')).toBe(
      '/feedback?tab=user&deviceId=DEV-001',
    )
  })

  it('手机号给复制图标，未绑定手机号时不渲染复制入口', async () => {
    const { unmount } = renderPage()

    expect(await screen.findByText('13800000000')).toBeTruthy()
    expect(screen.getByRole('button', { name: '复制手机号' })).toBeTruthy()
    unmount()

    mockGet.mockReset()
    mockRoutes({
      '/analytics/parents/9f8b7c6d-1a2b-4c3d-8e9f-0a1b2c3d4e5f': {
        ...PARENT,
        user: { ...PARENT.user, phone: null },
      },
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

    mockGet.mockReset()
    mockRoutes({
      '/analytics/parents/9f8b7c6d-1a2b-4c3d-8e9f-0a1b2c3d4e5f': {
        ...PARENT,
        user: { ...PARENT.user, phoneDuplicate: true },
      },
    })
    renderPage()

    expect(await screen.findByText('重复')).toBeTruthy()
  })

  it('性别/生日缺失时给「未设置」', async () => {
    mockGet.mockReset()
    mockRoutes({
      '/analytics/parents/9f8b7c6d-1a2b-4c3d-8e9f-0a1b2c3d4e5f': {
        ...PARENT,
        user: { ...PARENT.user, gender: null, birthday: null },
      },
    })
    renderPage()

    expect(await screen.findByText('13800000000')).toBeTruthy()
    expect(screen.getAllByText('未设置').length).toBeGreaterThanOrEqual(2)
  })

  it('昵称/手机号/厂商缺失时给可见占位', async () => {
    mockGet.mockReset()
    mockRoutes({
      '/analytics/parents/9f8b7c6d-1a2b-4c3d-8e9f-0a1b2c3d4e5f': {
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
    mockGet.mockReset()
    mockRoutes({
      '/analytics/parents/9f8b7c6d-1a2b-4c3d-8e9f-0a1b2c3d4e5f': {
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
