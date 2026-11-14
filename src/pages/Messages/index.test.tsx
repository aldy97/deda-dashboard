import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
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
  ],
}

const INTERRUPTION_RESPONSE: InterruptionRateResponse = {
  assistantTotal: 0,
  interrupted: 0,
  interruptionRate: null,
  byMode: [],
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/messages']}>
        <Messages />
      </MemoryRouter>
    </QueryClientProvider>,
  )
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
