import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useLlmCallsByTurn, useMessageDetail, useMessages } from '../../api/queries'
import { useAnalyticsMeta } from '../../api/meta'
import type {
  MessageAdventureEpisode,
  MessageListItem,
} from '../../types/analytics'
import MessageDetailDrawer from './MessageDetailDrawer'
import { stubClipboard } from '../../test/clipboard'

vi.mock('../../api/queries', () => ({
  useMessageDetail: vi.fn(),
  useMessages: vi.fn(),
  useLlmCallsByTurn: vi.fn(),
}))

vi.mock('../../api/meta', () => ({
  useAnalyticsMeta: vi.fn(),
}))

const mockDetail = vi.mocked(useMessageDetail)
const mockMessages = vi.mocked(useMessages)
const mockCalls = vi.mocked(useLlmCallsByTurn)
const mockMeta = vi.mocked(useAnalyticsMeta)

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
  mockMeta.mockReturnValue({
    data: { admin: { role: 'superadmin' } },
  } as never)
})

describe('MessageDetailDrawer 复制入口', () => {
  it('ID 与轮次 ID 都可复制，轮次标签不再带 turnId 后缀', async () => {
    renderDrawer({ message: makeMessage() })

    expect(await screen.findByText('轮次 ID')).toBeInTheDocument()
    expect(screen.queryByText('轮次 ID（turnId）')).not.toBeInTheDocument()

    const writeText = stubClipboard()
    const copyId = screen.getByRole('button', { name: '复制 ID' })
    const copyTurn = screen.getByRole('button', { name: '复制轮次 ID' })
    expect(copyId).toBeInTheDocument()
    expect(copyTurn).toBeInTheDocument()
    expect(copyTurn).toBeInTheDocument()

    fireEvent.click(copyId)
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('m-1'))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '已复制' })).toBeInTheDocument(),
    )

    fireEvent.click(copyTurn)
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('t-1'))

    fireEvent.click(screen.getByRole('button', { name: '复制设备 ID' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('dev-1'))
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

describe('MessageDetailDrawer 冒险故事', () => {
  const adventureEpisode: MessageAdventureEpisode = {
    episodeId: 'ep-1',
    businessKey: 'elly/1/1',
    characterKey: 'elly',
    season: 1,
    episodeNumber: 1,
    title: '星海奇遇',
    versionId: 'ver-2',
    version: 2,
  }

  function withAdventure(
    adventure: typeof adventureEpisode | null = adventureEpisode,
    mode = 'adventure_story',
  ) {
    mockDetail.mockReturnValue({
      data: {
        ...makeMessage({ role: 'assistant', mode }),
        rawPayload: { filler: null, answer: '我们继续冒险吧。' },
        adventureEpisode: adventure,
      },
      isLoading: false,
      error: null,
    } as never)
  }

  it('冒险故事轮次展示集身份、当时标题与时间点版本链接', async () => {
    withAdventure()

    renderDrawer({
      message: makeMessage({ role: 'assistant', mode: 'adventure_story' }),
    })

    expect(await screen.findByText('故事')).toBeInTheDocument()
    expect(screen.getByText('elly/1/1')).toBeInTheDocument()
    expect(screen.getByText('星海奇遇')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /查看当时版本 v2/ })
    expect(link).toHaveAttribute(
      'href',
      '/adventure?tab=episodes&episodeId=ep-1&versionId=ver-2',
    )
    expect(screen.queryByText('版本未记录')).not.toBeInTheDocument()
  })

  it('没有版本记录时标注版本未记录，只链接到该集版本历史', async () => {
    withAdventure({ ...adventureEpisode, versionId: null, version: null })

    renderDrawer({
      message: makeMessage({ role: 'assistant', mode: 'adventure_story' }),
    })

    expect(await screen.findByText('版本未记录')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /查看该集版本历史/ })
    expect(link).toHaveAttribute(
      'href',
      '/adventure?tab=episodes&episodeId=ep-1',
    )
  })

  it('普通 admin 只展示故事信息，不给冒险工作台的链接', async () => {
    mockMeta.mockReturnValue({
      data: { admin: { role: 'admin' } },
    } as never)
    withAdventure()

    renderDrawer({
      message: makeMessage({ role: 'assistant', mode: 'adventure_story' }),
    })

    expect(await screen.findByText('elly/1/1')).toBeInTheDocument()
    expect(screen.getByText('星海奇遇')).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /查看当时版本|查看该集版本历史/ }),
    ).not.toBeInTheDocument()
  })

  it('非冒险故事模式不展示故事行，即使服务端误带字段', async () => {
    withAdventure(adventureEpisode, 'free_chat')

    renderDrawer({ message: makeMessage({ mode: 'free_chat' }) })

    expect(await screen.findByText('轮次 ID')).toBeInTheDocument()
    expect(screen.queryByText('故事')).not.toBeInTheDocument()
    expect(screen.queryByText('elly/1/1')).not.toBeInTheDocument()
  })
})
