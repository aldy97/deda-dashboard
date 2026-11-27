import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { apiClient } from '../../api/client'
import Messages from './index'
import type {
  InterruptionRateResponse,
  MessageListItem,
  MessageListResponse,
  MessageModesResponse,
} from '../../types/analytics'

/**
 * mode 平级化后消息明细页的筛选契约。
 *
 * 只考核三件事：子模式维度彻底消失（下拉不再渲染、查询参数不再携带
 * conversationModeKey）、模式列只按 mode 单维翻译（含 legacy 值与本次新增的
 * free_story）、模式选项源改吃 /analytics/messages/modes 的平级响应并能被
 * 真正选中后进入查询参数。
 */
vi.mock('../../api/client', () => ({
  apiClient: { get: vi.fn() },
  TOKEN_KEY: 'deda_dashboard_token',
}))

const mockGet = apiClient.get as unknown as ReturnType<typeof vi.fn>

function makeMessage(overrides: Partial<MessageListItem> = {}): MessageListItem {
  return {
    id: 'm-1',
    turnId: 't-1',
    conversationId: 'c-1',
    role: 'user',
    content: '今天想听什么故事',
    status: 'completed',
    mode: 'free_story',
    cefrLevel: null,
    spokeAt: '2026-11-10T02:00:00.000Z',
    createdAt: '2026-11-10T02:00:00.000Z',
    device: { deviceId: 'dev-1', deviceCode: 'D001', characterKey: 'elly' },
    ...overrides,
  }
}

function makeList(items: MessageListItem[]): MessageListResponse {
  return { total: items.length, page: 1, pageSize: 20, items }
}

const MODES_RESPONSE: MessageModesResponse = {
  modes: [
    { key: 'free_chat', name: '自由对话', messageCount: 12 },
    { key: 'free_story', name: '自由故事', messageCount: 3 },
    // 服务端 MODE_LABELS 把 adventure_story 叫「每日冒险」，前端统一文案是「冒险故事」
    { key: 'adventure_story', name: '每日冒险', messageCount: 7 },
  ],
}

const INTERRUPTION_RESPONSE: InterruptionRateResponse = {
  assistantTotal: 0,
  interrupted: 0,
  interruptionRate: null,
  byMode: [],
}

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="search">{location.search}</div>
}

function renderPage(entry = '/messages') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <Messages />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** 最后一次 /analytics/messages 调用的查询参数 */
function lastListParams(): Record<string, unknown> | undefined {
  const listCalls = callsTo('/analytics/messages')
  if (listCalls.length === 0) return undefined
  return (listCalls[listCalls.length - 1][1] as { params?: Record<string, unknown> })
    ?.params
}

function search(): string {
  return screen.getByTestId('search').textContent ?? ''
}

/** 取出对某个 URL 的所有调用，便于断言真实发出的查询参数 */
function callsTo(url: string) {
  return mockGet.mock.calls.filter((call: unknown[]) => call[0] === url)
}

describe('消息明细页 · mode 平级化', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockGet.mockImplementation((url: string) => {
      if (url === '/analytics/messages/modes') {
        return Promise.resolve({ data: MODES_RESPONSE })
      }
      if (url === '/analytics/messages/interruption-rate') {
        return Promise.resolve({ data: INTERRUPTION_RESPONSE })
      }
      if (url === '/analytics/messages') {
        return Promise.resolve({
          data: makeList([
            makeMessage(),
            makeMessage({
              id: 'm-2',
              turnId: 't-2',
              role: 'assistant',
              content: '从前有座山',
              mode: 'free_chat_casual',
            }),
          ]),
        })
      }
      return Promise.resolve({ data: null })
    })
  })

  it('模式列只按 mode 单维翻译：新桶 free_story 与 legacy 值都能出中文', async () => {
    renderPage()
    expect(await screen.findByText('自由故事')).toBeTruthy()
    expect(screen.getByText('自由闲聊')).toBeTruthy()
  })

  it('子模式维度彻底移除：下拉不再渲染，查询参数不再携带 conversationModeKey', async () => {
    renderPage()
    await screen.findByText('自由故事')

    expect(screen.queryByText('子模式')).toBeNull()

    const listCalls = callsTo('/analytics/messages')
    expect(listCalls.length).toBeGreaterThan(0)
    const params = (listCalls[0][1] as { params?: Record<string, unknown> })
      ?.params
    expect(params).toBeTruthy()
    expect(Object.keys(params ?? {})).not.toContain('conversationModeKey')
    expect(params?.mode).toBeUndefined()
  })

  it('模式选项源改吃平级 modes 响应，且列表加载不报错', async () => {
    renderPage()
    await screen.findByText('自由故事')

    expect(callsTo('/analytics/messages/modes').length).toBeGreaterThan(0)
    expect(screen.queryByText('消息列表加载失败')).toBeNull()
  })

  it('对话模式筛选用前端统一文案：服务端的「每日冒险」显示为「冒险故事」', async () => {
    renderPage()
    await screen.findByText('自由故事')

    const modeSelect = screen.getByText('对话模式').closest('.ant-select')
    fireEvent.mouseDown(modeSelect as Element)

    expect(await screen.findByText('冒险故事（7）')).toBeInTheDocument()
    expect(screen.queryByText('每日冒险（7）')).toBeNull()
  })

  it('选中对话模式后点查询：mode 是唯一进查询参数的模式维度', async () => {
    renderPage()
    await screen.findByText('自由故事')

    // antd 6 的 Select 结构是 .ant-select > .ant-select-content > .ant-select-placeholder，
    // 展开靠根节点上的 mousedown，选项渲染在 body 上的 portal 里
    const modeSelect = screen.getByText('对话模式').closest('.ant-select')
    expect(modeSelect).toBeTruthy()
    fireEvent.mouseDown(modeSelect as Element)
    fireEvent.click(await screen.findByText('自由对话（12）'))

    fireEvent.click(screen.getByRole('button', { name: /查\s*询/ }))

    await waitFor(() => {
      const listCalls = callsTo('/analytics/messages')
      const params = (
        listCalls[listCalls.length - 1][1] as { params?: Record<string, unknown> }
      )?.params
      expect(params?.mode).toBe('free_chat')
      expect(Object.keys(params ?? {})).not.toContain('conversationModeKey')
    })
  })
})

/**
 * URL 即筛选状态。
 *
 * 消息明细是全站下钻的落点（记忆版本时间线、设备档案、安全复核队列、慢调用都往这里跳），
 * 所以筛选条件、turnId 与打开的抽屉都必须在 URL 上：跳过来要带着上下文，
 * 刷新与分享要能还原现场。这里考核读、写、清三个方向。
 */
describe('消息明细页 · URL 即筛选状态', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockGet.mockImplementation((url: string) => {
      if (url === '/analytics/messages/modes') {
        return Promise.resolve({ data: MODES_RESPONSE })
      }
      if (url === '/analytics/messages/interruption-rate') {
        return Promise.resolve({ data: INTERRUPTION_RESPONSE })
      }
      if (url.startsWith('/analytics/messages/')) {
        const id = url.split('/').pop() as string
        return Promise.resolve({
          data: {
            ...makeMessage({ id, role: 'assistant', content: '从前有座山' }),
            rawPayload: { filler: '嗯——', answer: '从前有座山' },
          },
        })
      }
      if (url === '/analytics/messages') {
        return Promise.resolve({
          data: makeList([
            makeMessage(),
            makeMessage({
              id: 'm-2',
              turnId: 't-2',
              role: 'assistant',
              content: '从前有座山',
              mode: 'free_chat_casual',
            }),
          ]),
        })
      }
      return Promise.resolve({ data: null })
    })
  })

  it('带条件进入：URL 上的筛选原样进查询参数', async () => {
    renderPage(
      '/messages?deviceId=dev-9&mode=free_chat&role=user&status=completed&keyword=故事&startDate=2026-11-01&endDate=2026-11-07',
    )
    await screen.findByText('自由故事')

    const params = lastListParams()
    expect(params?.deviceId).toBe('dev-9')
    expect(params?.mode).toBe('free_chat')
    expect(params?.role).toBe('user')
    expect(params?.status).toBe('completed')
    expect(params?.keyword).toBe('故事')
    expect(params?.startDate).toBe('2026-11-01')
    expect(params?.endDate).toBe('2026-11-07')
  })

  it('非法枚举值被忽略，不拿脏值去查后端', async () => {
    renderPage('/messages?role=admin&status=bogus')
    await screen.findByText('自由故事')

    const params = lastListParams()
    expect(params?.role).toBeUndefined()
    expect(params?.status).toBeUndefined()
  })

  it('只给一端的日期区间视为未设置', async () => {
    renderPage('/messages?startDate=2026-11-01')
    await screen.findByText('自由故事')

    const params = lastListParams()
    expect(params?.startDate).toBeUndefined()
    expect(params?.endDate).toBeUndefined()
  })

  it('输入条件后点「查询」才写进 URL', async () => {
    renderPage()
    await screen.findByText('自由故事')
    expect(search()).toBe('')

    fireEvent.change(
      screen.getByPlaceholderText('设备 ID（业务 ID）'),
      { target: { value: 'dev-7' } },
    )
    // 只输入不查询：URL 不变，查询参数也不变
    expect(search()).toBe('')
    expect(lastListParams()?.deviceId).toBeUndefined()

    fireEvent.click(screen.getByRole('button', { name: /查\s*询/ }))
    await waitFor(() => expect(search()).toContain('deviceId=dev-7'))
    await waitFor(() => expect(lastListParams()?.deviceId).toBe('dev-7'))
  })

  it('重置清掉 URL 上的筛选与 turnId', async () => {
    renderPage('/messages?deviceId=dev-9&mode=free_chat&turnId=t-1')
    await screen.findByText('自由故事')
    expect(search()).toContain('deviceId=dev-9')

    fireEvent.click(screen.getByRole('button', { name: /重\s*置/ }))
    await waitFor(() => expect(search()).toBe(''))
    await waitFor(() => expect(lastListParams()?.deviceId).toBeUndefined())
    expect(screen.queryByText(/同一轮问答/)).toBeNull()
  })

  it('?turnId= 进入即过滤同轮问答，并渲染可关闭的标签', async () => {
    renderPage('/messages?turnId=t-2')
    await screen.findByText('自由故事')

    expect(lastListParams()?.turnId).toBe('t-2')
    expect(screen.getByText(/同一轮问答：t-2/)).toBeInTheDocument()
  })

  it('?messageId= 直接打开详情抽屉（分享链接可还原现场）', async () => {
    renderPage('/messages?messageId=m-2')
    await screen.findByText('消息详情')

    const detailCalls = mockGet.mock.calls.filter((call: unknown[]) =>
      String(call[0]).startsWith('/analytics/messages/'),
    )
    expect(detailCalls.map((call) => call[0])).toContain('/analytics/messages/m-2')
  })

  it('点行把 messageId 写进 URL', async () => {
    renderPage()
    await screen.findByText('自由故事')

    fireEvent.click(screen.getByText('今天想听什么故事'))
    await waitFor(() => expect(search()).toContain('messageId=m-1'))
    expect(await screen.findByText('消息详情')).toBeInTheDocument()
  })

  it('关闭抽屉清掉 messageId，但保留筛选条件', async () => {
    renderPage('/messages?deviceId=dev-9&messageId=m-2')
    await screen.findByText('消息详情')

    const closeBtn = document.querySelector('.ant-drawer-close')
    expect(closeBtn).not.toBeNull()
    fireEvent.click(closeBtn as Element)

    await waitFor(() => expect(search()).not.toContain('messageId'))
    expect(search()).toContain('deviceId=dev-9')
  })
})

/**
 * 设备列的白名单备注。
 *
 * 白名单只对超管可见（/analytics/test-devices 由 SuperAdminGuard 把守），
 * 与设备舰队同一份数据、同一套视觉：在册设备在设备标识后面跟一个金色 Tag，
 * 有备注显示备注，备注为空回落「白名单」。普通 admin 既拿不到数据，也不该发这个请求。
 */
describe('消息明细页 · 设备列白名单备注', () => {
  const SUPERADMIN_META = {
    nodeEnv: 'staging',
    promptWriteEnabled: false,
    publishConfirmCode: 'PUBLISH',
    admin: { username: 'root', displayName: 'Root', role: 'superadmin' },
  }
  const ADMIN_META = {
    ...SUPERADMIN_META,
    admin: { username: 'ops', displayName: 'Ops', role: 'admin' },
  }

  function whitelistItem(deviceId: string, note: string | null) {
    return {
      id: `wl-${deviceId}`,
      active: true,
      note,
      addedBy: 'root',
      addedAt: '2026-11-22T10:00:00.000Z',
      addedReason: '需要验证新一集',
      revokedBy: null,
      revokedAt: null,
      revokeReason: null,
      device: {
        id: `uuid-${deviceId}`,
        deviceId,
        deviceCode: null,
        macAddress: null,
        characterKey: 'elly',
        firmwareVersion: '1.2.3',
      },
    }
  }

  function mockWhitelistScenario(meta: unknown) {
    mockGet.mockImplementation((url: string) => {
      if (url === '/analytics/meta') return Promise.resolve({ data: meta })
      if (url === '/analytics/test-devices') {
        return Promise.resolve({
          data: {
            enabled: { adventure: true },
            items: [
              whitelistItem('dev-1', '3 号样机-熊枫'),
              whitelistItem('dev-2', null),
              whitelistItem('dev-3', '   '),
            ],
            total: 3,
          },
        })
      }
      if (url === '/analytics/messages/modes') {
        return Promise.resolve({ data: MODES_RESPONSE })
      }
      if (url === '/analytics/messages/interruption-rate') {
        return Promise.resolve({ data: INTERRUPTION_RESPONSE })
      }
      if (url === '/analytics/messages') {
        return Promise.resolve({
          data: makeList([
            makeMessage({ id: 'm-1', content: '第一条', mode: 'free_story' }),
            makeMessage({
              id: 'm-2',
              content: '第二条',
              mode: 'free_story',
              device: { deviceId: 'dev-2', deviceCode: 'D002', characterKey: 'elly' },
            }),
            makeMessage({
              id: 'm-3',
              content: '第三条',
              mode: 'free_story',
              device: { deviceId: 'dev-3', deviceCode: 'D003', characterKey: 'elly' },
            }),
          ]),
        })
      }
      return Promise.resolve({ data: null })
    })
  }

  beforeEach(() => {
    mockGet.mockReset()
  })

  it('超管视角：有备注显示金色备注 Tag，空备注回落「白名单」', async () => {
    mockWhitelistScenario(SUPERADMIN_META)
    renderPage()

    await screen.findByText('第一条')
    await screen.findByText('3 号样机-熊枫')

    const tag = screen.getByText('3 号样机-熊枫')
    expect(tag.className).toContain('ant-tag')
    expect(tag.className).toContain('ant-tag-gold')
    // dev-2（null）与 dev-3（全空白）都回落「白名单」
    expect(screen.getAllByText('白名单')).toHaveLength(2)
    expect(callsTo('/analytics/test-devices').length).toBeGreaterThan(0)
  })

  it('备注 Tag 与设备标识同一行，Tag 左侧按固定列宽对齐', async () => {
    mockWhitelistScenario(SUPERADMIN_META)
    renderPage()

    const tag = await screen.findByText('3 号样机-熊枫')
    const cell = screen.getAllByTestId('message-device-cell')[0]
    const label = screen.getAllByTestId('message-device-label')[0]

    // 固定第一列宽度：设备 ID 长短不再影响 Tag 的左边缘
    expect(cell.style.display).toBe('grid')
    expect(cell.style.gridTemplateColumns).toBe('104px minmax(0px, 1fr)')
    expect(cell.style.columnGap).toBe('4px')
    const tagSlot = screen.getAllByTestId('message-device-tag')[0]
    expect(cell.children[0]).toBe(label)
    expect(cell.children[1]).toBe(tagSlot)
    expect(tagSlot.contains(tag)).toBe(true)

    // 只对齐左边缘：Tag 不随网格列拉伸，宽度由内容决定
    expect(tagSlot.style.justifySelf).toBe('start')

    // 超长设备 ID 在自己的第一列内省略，不推挤 Tag
    expect(label.style.minWidth).toBe('0px')
    expect(label.style.overflow).toBe('hidden')
    expect(label.style.textOverflow).toBe('ellipsis')
    expect(tag.style.flexShrink).toBe('0')
    expect(tag.style.maxWidth).toBe('96px')
  })

  it('普通 admin：不发白名单请求，也不显示任何金色 Tag', async () => {
    mockWhitelistScenario(ADMIN_META)
    renderPage()

    await screen.findByText('第一条')

    expect(callsTo('/analytics/test-devices')).toHaveLength(0)
    expect(screen.queryByText('3 号样机-熊枫')).toBeNull()
    expect(document.querySelectorAll('.ant-tag-gold')).toHaveLength(0)
  })
})
