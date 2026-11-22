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
