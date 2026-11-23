import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useLlmCallsByTurn, useMessageDetail, useMessages } from '../../api/queries'
import type { MessageListItem } from '../../types/analytics'
import MessageDetailDrawer from './MessageDetailDrawer'

vi.mock('../../api/queries', () => ({
  useMessageDetail: vi.fn(),
  useMessages: vi.fn(),
  useLlmCallsByTurn: vi.fn(),
}))

const mockDetail = vi.mocked(useMessageDetail)
const mockMessages = vi.mocked(useMessages)
const mockCalls = vi.mocked(useLlmCallsByTurn)

function makeMessage(overrides: Partial<MessageListItem> = {}): MessageListItem {
  return {
    id: 'm-1',
    turnId: 't-1',
    conversationId: 'c-1',
    role: 'user',
    content: '我想听故事',
    status: 'completed',
    mode: 'free_chat',
    cefrLevel: null,
    spokeAt: '2026-11-22T02:00:00.000Z',
    createdAt: '2026-11-22T02:00:01.000Z',
    device: { deviceId: 'dev-1', deviceCode: 'D001', characterKey: 'elly' },
    ...overrides,
  }
}

function renderDrawer(props: {
  message?: MessageListItem | null
  messageId?: string | null
}) {
  const onClose = vi.fn()
  const onViewTurn = vi.fn()
  render(
    <MemoryRouter>
      <MessageDetailDrawer
        message={props.message ?? null}
        messageId={props.messageId ?? null}
        onClose={onClose}
        onViewTurn={onViewTurn}
      />
    </MemoryRouter>,
  )
  return { onClose, onViewTurn }
}

beforeEach(() => {
  mockDetail.mockReturnValue({
    data: undefined,
    isLoading: false,
    error: null,
  } as never)
  mockMessages.mockReturnValue({
    data: { total: 1, page: 1, pageSize: 10, items: [] },
  } as never)
  mockCalls.mockReturnValue({
    data: { turnId: 't-1', calls: [] },
    isLoading: false,
    error: null,
  } as never)
})

describe('MessageDetailDrawer 复制入口', () => {
  it('ID 与轮次 ID 都可复制，轮次标签不再带 turnId 后缀', async () => {
    renderDrawer({ message: makeMessage() })

    expect(await screen.findByText('轮次 ID')).toBeInTheDocument()
    expect(screen.queryByText('轮次 ID（turnId）')).not.toBeInTheDocument()

    const copyId = screen.getByRole('button', { name: '复制 ID' })
    const copyTurn = screen.getByRole('button', { name: '复制轮次 ID' })
    expect(copyId).toBeInTheDocument()
    expect(copyTurn).toBeInTheDocument()
    expect(copyTurn).toBeInTheDocument()

    fireEvent.click(copyId)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '已复制' })).toBeInTheDocument(),
    )
  })

  it('仅凭 URL 打开时，详情回来后可复制且查看同轮仍可用', async () => {
    mockDetail.mockReturnValue({
      data: {
        ...makeMessage({ role: 'assistant' }),
      },
      isLoading: false,
      error: null,
    } as never)
    const { onViewTurn } = renderDrawer({ messageId: 'm-1' })

    expect(await screen.findByRole('button', { name: '复制 ID' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '复制轮次 ID' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /查看同一轮问答/ }))
    expect(onViewTurn).toHaveBeenCalledWith('t-1')
  })
})

describe('MessageDetailDrawer 本轮安全判定', () => {
  it('展示回补的原始判定', async () => {
    mockDetail.mockReturnValue({
      data: {
        ...makeMessage({ role: 'assistant' }),
        rawPayload: {
          filler: null,
          answer: '我们先回到故事里，好吗？',
          safety: {
            layer: 'L2',
            category: 'violence',
            blocked: true,
            source: 'l2_model',
            matched: null,
            reply: 'canned_block',
            inferred: false,
            backfilledAt: '2026-11-23T10:00:00.000Z',
          },
        },
      },
      isLoading: false,
      error: null,
    } as never)

    renderDrawer({ message: makeMessage({ role: 'assistant' }) })

    expect(await screen.findByText('本轮安全判定')).toBeInTheDocument()
    expect(screen.getByText('L2')).toBeInTheDocument()
    expect(screen.getByText('暴力')).toBeInTheDocument()
    expect(screen.getByText('已拦截')).toBeInTheDocument()
    expect(screen.getByText('L2 小模型判定')).toBeInTheDocument()
    expect(screen.getByText('代码固定话术')).toBeInTheDocument()
    expect(screen.getByText('历史回补')).toBeInTheDocument()
  })

  it('推断回补必须标注来源，不能伪装成模型原始判定', async () => {
    mockDetail.mockReturnValue({
      data: {
        ...makeMessage({ role: 'assistant' }),
        rawPayload: {
          answer: '我们先回到故事里，好吗？',
          safety: {
            layer: null,
            category: null,
            blocked: false,
            source: 'inferred_from_reply',
            matched: null,
            reply: 'unsafe_line_echo',
            inferred: true,
            backfilledAt: '2026-11-23T10:00:00.000Z',
          },
        },
      },
      isLoading: false,
      error: null,
    } as never)

    renderDrawer({ message: makeMessage({ role: 'assistant' }) })

    expect(await screen.findByText('由 AI 回复推断')).toBeInTheDocument()
    expect(screen.getByText('推断回补')).toBeInTheDocument()
    expect(screen.getByText('模型回抄安全句')).toBeInTheDocument()
    expect(screen.getByText('未能判定')).toBeInTheDocument()
    expect(screen.queryByText('L2 小模型判定')).not.toBeInTheDocument()
  })

  it('没有快照时明确显示未记录，不能显示成安全', async () => {
    mockDetail.mockReturnValue({
      data: {
        ...makeMessage({ role: 'assistant' }),
        rawPayload: { filler: null, answer: '我们继续吧。' },
      },
      isLoading: false,
      error: null,
    } as never)

    renderDrawer({ message: makeMessage({ role: 'assistant' }) })

    expect(await screen.findByText('本轮安全判定')).toBeInTheDocument()
    expect(screen.getByText(/本轮未记录安全判定/)).toBeInTheDocument()
    expect(screen.queryByText('安全')).not.toBeInTheDocument()
  })
})

/**
 * 标签列曾被值列的长 UUID 挤到一字一行（2026-11-22 线上截图）。
 * jsdom 没有布局引擎，这里守的是根因约束：标签单元格必须声明 nowrap，
 * 浏览器才会把标签列的 min-content 撑到整段标签宽度。
 */
describe('MessageDetailDrawer 标签排版', () => {
  it('每个字段标签单元格都禁止换行', async () => {
    renderDrawer({ message: makeMessage() })
    expect(await screen.findByText('轮次 ID')).toBeInTheDocument()

    const labels = Array.from(
      document.querySelectorAll<HTMLElement>('.ant-descriptions-item-label'),
    )
    expect(labels.length).toBeGreaterThanOrEqual(10)
    labels.forEach((label) => {
      expect(label).toHaveStyle({ whiteSpace: 'nowrap' })
    })
  })
})
