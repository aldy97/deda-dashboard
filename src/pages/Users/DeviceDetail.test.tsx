import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { apiClient } from '../../api/client'
import UserDeviceDetail from './DeviceDetail'
import { stubClipboard } from '../../test/clipboard'

/**
 * 用户详情页（设备 360）的扩展契约。
 *
 * 1. 渲染设备舰队卡片（设备信息 / 实时状态 / 开机日历 / 对话趋势）
 * 2. Fleet 404 时显示轻提示，不炸页面
 * 3. 近期消息行点击打开消息详情抽屉（?messageId=）
 * 4. 关闭抽屉清 messageId
 */
vi.mock('../../api/client', () => ({
  apiClient: { get: vi.fn() },
  TOKEN_KEY: 'deda_dashboard_token',
}))

const mockGet = apiClient.get as unknown as ReturnType<typeof vi.fn>

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="search">{location.search}</div>
}

function makeParentReportResponse() {
  return {
    total: 2,
    page: 1,
    pageSize: 10,
    device: {
      deviceId: 'dev-360',
      deviceCode: 'D-360',
      characterKey: 'elly',
    },
    items: [
      {
        reportDate: '2026-11-13',
        generationStatus: 'completed',
        generatorModel: 'gpt-4',
        expressionObservation: '孩子今天表达很流畅',
        emotionObservation: '情绪平稳',
        thinkingObservation: '逻辑清晰',
        suggestion: '可以增加阅读量',
        feedbacks: [],
      },
    ],
  }
}

function makeMemoriesResponse() {
  return {
    deviceId: 'dev-360',
    memories: [],
  }
}

function makeUserFeedbacksResponse() {
  return { total: 0, page: 1, pageSize: 10, items: [] }
}

function makeMessagesResponse() {
  return {
    total: 2,
    page: 1,
    pageSize: 10,
    items: [
      {
        id: 'msg-1',
        turnId: 'turn-1',
        conversationId: 'conv-1',
        role: 'user',
        content: '今天想听什么故事',
        status: 'completed',
        mode: 'free_chat',
        cefrLevel: null,
        spokeAt: '2026-11-14T02:00:00.000Z',
        createdAt: '2026-11-14T02:00:00.000Z',
        device: { deviceId: 'dev-360', deviceCode: 'D-360', characterKey: 'elly' },
      },
      {
        id: 'msg-2',
        turnId: 'turn-1',
        conversationId: 'conv-1',
        role: 'assistant',
        content: '从前有座山',
        status: 'completed',
        mode: 'free_chat',
        cefrLevel: null,
        spokeAt: '2026-11-14T02:00:01.000Z',
        createdAt: '2026-11-14T02:00:01.000Z',
        device: { deviceId: 'dev-360', deviceCode: 'D-360', characterKey: 'elly' },
      },
    ],
  }
}

function makeFleetDetail() {
  return {
    deviceId: 'dev-360',
    deviceUuid: 'uuid-360',
    characterKey: 'elly',
    deviceCode: 'D-360',
    firmwareVersion: '1.0.0',
    macAddress: 'aa:bb:cc:dd:ee:ff',
    wifiName: 'HomeWiFi',
    ipAddress: '192.168.1.1',
    networkType: 'wifi',
    timezone: 'Asia/Shanghai',
    createdAt: '2026-01-01T00:00:00.000Z',
    realtime: {
      online: true,
      battery: 85,
      volume: 60,
      version: '1.0.0',
      charging: false,
      lastSeenAt: 1700000000000,
    },
    boundUsers: [],
    presence: [
      { date: '2026-11-10', reportCount: 3, firstSeenAt: '2026-11-10T08:00:00Z', lastSeenAt: '2026-11-10T20:00:00Z' },
      { date: '2026-11-11', reportCount: 5, firstSeenAt: '2026-11-11T08:00:00Z', lastSeenAt: '2026-11-11T20:00:00Z' },
    ],
    dailyTurns: [
      { date: '2026-11-10', turns: 10 },
      { date: '2026-11-11', turns: 15 },
    ],
    totals: { presenceDays: 2, turns: 25 },
  }
}

function makeMessageDetail(msgId: string) {
  return {
    id: msgId,
    turnId: 'turn-1',
    conversationId: 'conv-1',
    role: 'user',
    content: '今天想听什么故事',
    status: 'completed',
    mode: 'free_chat',
    cefrLevel: null,
    spokeAt: '2026-11-14T02:00:00.000Z',
    createdAt: '2026-11-14T02:00:00.000Z',
    device: { deviceId: 'dev-360', deviceCode: 'D-360', characterKey: 'elly' },
    rawPayload: null,
  }
}

function stubAllApi(fleet404 = false) {
  mockGet.mockImplementation((url: string) => {
    if (url === '/analytics/parent-reports') {
      return Promise.resolve({ data: makeParentReportResponse() })
    }
    if (url === '/analytics/memories/current') {
      return Promise.resolve({ data: makeMemoriesResponse() })
    }
    if (url === '/analytics/feedback/user-feedbacks') {
      return Promise.resolve({ data: makeUserFeedbacksResponse() })
    }
    if (url === '/analytics/messages') {
      return Promise.resolve({ data: makeMessagesResponse() })
    }
    if (url === '/analytics/fleet/devices/dev-360') {
      if (fleet404) {
        return Promise.reject(Object.assign(new Error('Not Found'), { status: 404 }))
      }
      return Promise.resolve({ data: makeFleetDetail() })
    }
    if (url.startsWith('/analytics/messages/')) {
      const id = url.split('/').pop() as string
      return Promise.resolve({ data: makeMessageDetail(id) })
    }
    return Promise.resolve({ data: null })
  })
}

function renderPage(entry = '/users/dev-360') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/users/:deviceId" element={<UserDeviceDetail />} />
          <Route path="/messages" element={<div>Messages Page</div>} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function search(): string {
  return screen.getByTestId('search').textContent ?? ''
}

describe('Users/DeviceDetail · 设备 360 舰队卡片', () => {
  beforeEach(() => {
    mockGet.mockReset()
    stubAllApi()
  })

  it('渲染设备与在线状态卡片', async () => {
    renderPage()
    await screen.findByText('用户详情')

    // 等待舰队卡片出现
    await waitFor(() => {
      expect(screen.getByText('设备与在线状态')).toBeTruthy()
    })
  })

  it('渲染设备信息（UUID / 角色 / 固件等）', async () => {
    renderPage()
    await screen.findByText('用户详情')

    await waitFor(() => {
      expect(screen.getByText('uuid-360')).toBeTruthy()
      // elly 出现在 header Tag 和舰队卡片 Descriptions 两处
      expect(screen.getAllByText('elly').length).toBeGreaterThanOrEqual(1)
      // 1.0.0 出现在固件版本和 realtime.version 两处
      expect(screen.getAllByText('1.0.0').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('设备 ID 与 UUID 的复制图标把完整值写入剪贴板', async () => {
    renderPage()
    await screen.findByText('用户详情')
    await screen.findByText('uuid-360')

    const writeText = stubClipboard()

    fireEvent.click(screen.getByRole('button', { name: '复制设备 ID' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('dev-360'))

    fireEvent.click(screen.getByRole('button', { name: '复制' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('uuid-360'))
  })

  it('渲染实时状态', async () => {
    renderPage()
    await screen.findByText('用户详情')

    await waitFor(() => {
      expect(screen.getAllByText('在线').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('85%').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('60%').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('渲染近 N 天汇总', async () => {
    renderPage()
    await screen.findByText('用户详情')

    await waitFor(() => {
      expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1) // presenceDays
      expect(screen.getAllByText('25').length).toBeGreaterThanOrEqual(1) // turns
    })
  })

  it('渲染开机日历和对话趋势', async () => {
    renderPage()
    await screen.findByText('用户详情')

    await waitFor(() => {
      expect(screen.getByText(/开机日历/)).toBeTruthy()
      expect(screen.getByText(/对话趋势/)).toBeTruthy()
    })
  })

  it('包含"在设备舰队中查看"出口链接', async () => {
    renderPage()
    await screen.findByText('用户详情')

    await waitFor(() => {
      const link = screen.getByText(/在设备舰队中查看/)
      expect(link.closest('a')?.getAttribute('href')).toBe('/fleet?deviceId=dev-360')
    })
  })

  it('Fleet 404 时显示轻提示，不炸页面', async () => {
    mockGet.mockReset()
    stubAllApi(true) // fleet404 = true，但 parent-reports 正常
    renderPage()
    await screen.findByText('用户详情')

    await waitFor(() => {
      expect(screen.getByText(/设备舰队中未找到该设备/)).toBeTruthy()
    })

    // 页面没有崩溃，其他卡片正常
    expect(screen.getByText('记忆槽位')).toBeTruthy()
    expect(screen.getByText('家长日报')).toBeTruthy()
  })

  it('parent-reports 404 时仍显示原有 notFound 态', async () => {
    mockGet.mockReset()
    mockGet.mockImplementation((url: string) => {
      if (url === '/analytics/parent-reports') {
        return Promise.reject(Object.assign(new Error('Not Found'), { status: 404 }))
      }
      return Promise.resolve({ data: null })
    })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/未找到设备/)).toBeTruthy()
    })
  })
})

describe('Users/DeviceDetail · 消息详情抽屉', () => {
  beforeEach(() => {
    mockGet.mockReset()
    stubAllApi()
  })

  it('近期消息表格行可点开消息详情抽屉', async () => {
    renderPage('/users/dev-360')
    await screen.findByText('用户详情')

    await waitFor(() => {
      expect(screen.getByText('今天想听什么故事')).toBeTruthy()
    })

    // 点击消息行
    fireEvent.click(screen.getByText('今天想听什么故事'))

    await waitFor(() => {
      expect(search()).toContain('messageId=msg-1')
      expect(screen.getByText('消息详情')).toBeTruthy()
    })
  })

  it('关闭抽屉清掉 messageId（replace）', async () => {
    renderPage('/users/dev-360?messageId=msg-1')
    await screen.findByText('用户详情')

    await waitFor(() => {
      expect(screen.getByText('消息详情')).toBeTruthy()
    })

    // 点关闭
    const closeBtn = document.querySelector('.ant-drawer-close')
    fireEvent.click(closeBtn as Element)

    await waitFor(() => {
      expect(search()).not.toContain('messageId')
    })
  })

  it('?messageId= 进入时直接打开抽屉（分享可还原）', async () => {
    renderPage('/users/dev-360?messageId=msg-2')
    await screen.findByText('用户详情')

    await waitFor(() => {
      expect(screen.getByText('消息详情')).toBeTruthy()
      expect(search()).toContain('messageId=msg-2')
    })
  })

  it('onViewTurn 跳转到 /messages?turnId=&deviceId=', async () => {
    renderPage('/users/dev-360?messageId=msg-1')
    await screen.findByText('用户详情')

    await waitFor(() => {
      expect(screen.getByText('消息详情')).toBeTruthy()
    })

    // 点击"查看同一轮问答"按钮
    const viewTurnBtn = await screen.findByRole('button', { name: /查看同一轮问答/ })
    fireEvent.click(viewTurnBtn)

    await waitFor(() => {
      // 应跳转到 /messages 页面
      expect(screen.getByText('Messages Page')).toBeTruthy()
    })
  })
})
