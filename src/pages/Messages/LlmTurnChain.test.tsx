import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useLlmCallsByTurn } from '../../api/queries'
import type { LlmTurnCall } from '../../types/analytics'
import LlmTurnChain from './LlmTurnChain'

vi.mock('../../api/queries', () => ({
  useLlmCallsByTurn: vi.fn(),
}))

const mockCalls = vi.mocked(useLlmCallsByTurn)

const BASE = Date.parse('2026-11-27T10:00:00.000Z')
const iso = (offsetMs: number) => new Date(BASE + offsetMs).toISOString()

function makeCall(overrides: Partial<LlmTurnCall> = {}): LlmTurnCall {
  return {
    id: 'c-1',
    scene: 'intent_classify',
    model: 'qwen-flash',
    tier: 'small',
    success: true,
    failureReason: null,
    failureDetail: null,
    latencyMs: 100,
    firstTokenMs: null,
    promptTokens: null,
    completionTokens: null,
    totalTokens: null,
    createdAt: iso(100),
    ...overrides,
  }
}

function mockQuery(overrides: Record<string, unknown>) {
  mockCalls.mockReturnValue({
    data: undefined,
    isLoading: false,
    error: null,
    ...overrides,
  } as never)
}

beforeEach(() => {
  mockQuery({})
})

describe('LlmTurnChain', () => {
  it('加载失败时展示错误信息', () => {
    mockQuery({ error: new Error('request failed') })
    render(<LlmTurnChain turnId="t-1" />)

    expect(screen.getByText('LLM 调用链路加载失败')).toBeInTheDocument()
    expect(screen.getByText('request failed')).toBeInTheDocument()
  })

  it('非 Error 异常兜底成「加载失败」', () => {
    mockQuery({ error: 'boom' })
    render(<LlmTurnChain turnId="t-1" />)

    expect(screen.getByText('加载失败')).toBeInTheDocument()
  })

  it('加载中渲染 Spin', () => {
    mockQuery({ isLoading: true })
    const { container } = render(<LlmTurnChain turnId="t-1" />)

    expect(container.querySelector('.ant-spin-spinning')).not.toBeNull()
  })

  it('本轮没有调用记录时说明原因', () => {
    mockQuery({ data: { turnId: 't-1', calls: [] } })
    render(<LlmTurnChain turnId="t-1" />)

    expect(
      screen.getByText(/本轮暂无 LLM 调用记录/),
    ).toBeInTheDocument()
  })

  it('按真实区间渲染横向时间轴', () => {
    mockQuery({
      data: {
        turnId: 't-1',
        calls: [
          makeCall({ id: 'intent', scene: 'intent_classify', latencyMs: 340 }),
          makeCall({
            id: 'chat',
            scene: 'chat_main',
            tier: 'main',
            latencyMs: 441,
            firstTokenMs: 150,
          }),
        ],
      },
    })
    render(<LlmTurnChain turnId="t-1" />)

    expect(screen.getByText('最早调用 +0ms')).toBeInTheDocument()
    expect(screen.getByText('意图分类')).toBeInTheDocument()
    expect(screen.getByText('主对话回答')).toBeInTheDocument()
  })

  it('历史 filler 链路照旧给出防死空气 gap', () => {
    mockQuery({
      data: {
        turnId: 't-1',
        calls: [
          makeCall({
            id: 'filler',
            scene: 'filler',
            latencyMs: 200,
            createdAt: iso(2000),
          }),
          makeCall({
            id: 'chat',
            scene: 'chat_main',
            tier: 'main',
            latencyMs: 400,
            firstTokenMs: 100,
            createdAt: iso(2500),
          }),
        ],
      },
    })
    render(<LlmTurnChain turnId="t-1" />)

    expect(
      screen.getByText(/防死空气 gap（filler 收尾 → 主回答首包，历史链路）：200 ms/),
    ).toBeInTheDocument()
  })

  it('主回答首包早于 filler 收尾时如实写重叠', () => {
    mockQuery({
      data: {
        turnId: 't-1',
        calls: [
          makeCall({
            id: 'filler',
            scene: 'filler',
            latencyMs: 300,
            createdAt: iso(2300),
          }),
          makeCall({
            id: 'chat',
            scene: 'chat_main',
            tier: 'main',
            latencyMs: 400,
            firstTokenMs: 100,
            createdAt: iso(2400),
          }),
        ],
      },
    })
    render(<LlmTurnChain turnId="t-1" />)

    expect(screen.getByText(/重叠 200 ms/)).toBeInTheDocument()
  })

  it('没有 filler 记录时不显示 gap 文案', () => {
    mockQuery({
      data: {
        turnId: 't-1',
        calls: [
          makeCall({
            id: 'chat',
            scene: 'chat_main',
            tier: 'main',
            latencyMs: 400,
            firstTokenMs: 100,
          }),
        ],
      },
    })
    render(<LlmTurnChain turnId="t-1" />)

    expect(screen.queryByText(/防死空气 gap/)).toBeNull()
    expect(screen.queryByText(/重叠/)).toBeNull()
  })
})
