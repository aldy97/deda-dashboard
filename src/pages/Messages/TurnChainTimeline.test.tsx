import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { LlmTurnCall } from '../../types/analytics'
import { buildTurnChainLayout } from './turn-chain-layout'
import TurnChainTimeline from './TurnChainTimeline'

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

function renderTimeline(calls: LlmTurnCall[]) {
  return render(<TurnChainTimeline layout={buildTurnChainLayout(calls)} />)
}

const chain: LlmTurnCall[] = [
  makeCall({
    id: 'intent',
    scene: 'intent_classify',
    latencyMs: 340,
    createdAt: iso(1000),
  }),
  makeCall({
    id: 'safety',
    scene: 'safety_l2',
    latencyMs: 362,
    createdAt: iso(1023),
  }),
  makeCall({
    id: 'memory',
    scene: 'memory_extract',
    latencyMs: 288,
    createdAt: iso(1312),
  }),
  makeCall({
    id: 'chat',
    scene: 'chat_main',
    model: 'deepseek-flash',
    tier: 'main',
    latencyMs: 441,
    firstTokenMs: 150,
    totalTokens: 120,
    createdAt: iso(1465),
  }),
]

describe('TurnChainTimeline', () => {
  it('每条调用一行，展示场景、模型档位与耗时', () => {
    renderTimeline(chain)

    expect(screen.getByText('最早调用 +0ms')).toBeInTheDocument()
    expect(screen.getByText('总跨度 805 ms')).toBeInTheDocument()

    expect(screen.getByText('意图分类')).toBeInTheDocument()
    expect(screen.getByText('安全语义分类')).toBeInTheDocument()
    expect(screen.getByText('记忆抽取')).toBeInTheDocument()
    expect(screen.getByText('主对话回答')).toBeInTheDocument()

    expect(screen.getAllByText('小模型')).toHaveLength(3)
    expect(screen.getByText('主模型')).toBeInTheDocument()
    expect(screen.getAllByText(/qwen-flash/)).toHaveLength(3)
    expect(screen.getByText(/deepseek-flash/)).toBeInTheDocument()
    expect(screen.getByText(/耗时 340 ms/)).toBeInTheDocument()
    expect(screen.getByText(/耗时 441 ms/)).toBeInTheDocument()
    expect(screen.getByText(/首包 150 ms/)).toBeInTheDocument()
    expect(screen.getByText(/120 tokens/)).toBeInTheDocument()
    expect(screen.getAllByText('成功')).toHaveLength(4)
  })

  it('重叠区间标注并行，并写清与谁并行', () => {
    renderTimeline(chain)

    expect(screen.getByTitle('与「安全语义分类」并行')).toBeInTheDocument()
    expect(screen.getByTitle('与「意图分类」并行')).toBeInTheDocument()
    expect(screen.getByTitle('与「主对话回答」并行')).toBeInTheDocument()
    expect(screen.getByTitle('与「记忆抽取」并行')).toBeInTheDocument()
  })

  it('流式调用的条拆成首包等待与生成两段', () => {
    renderTimeline(chain)
    expect(screen.getByTitle('首包等待 150 ms')).toBeInTheDocument()
  })

  it('失败行展示原因与细节，fail-open 场景标注静默降级', () => {
    renderTimeline([
      makeCall({
        id: 'safety',
        scene: 'safety_l2',
        success: false,
        failureReason: 'timeout',
        failureDetail: 'HTTP 500: boom',
        latencyMs: 100,
      }),
      makeCall({
        id: 'filler',
        scene: 'filler',
        success: false,
        failureReason: 'upstream_error',
        latencyMs: 300,
        createdAt: iso(300),
      }),
    ])

    expect(screen.getByText('超时（已静默降级）')).toBeInTheDocument()
    expect(screen.getByText('HTTP 500: boom')).toBeInTheDocument()
    expect(screen.getByText('上游错误（已静默降级）')).toBeInTheDocument()
    expect(screen.queryByTitle(/首包等待/)).toBeNull()
  })

  it('耗时未知或时间非法的行如实标注，不画假条', () => {
    renderTimeline([
      makeCall({ id: 'memory', scene: 'memory_extract', latencyMs: null }),
      makeCall({ id: 'broken', scene: 'sleep_story_generate', createdAt: 'bad' }),
    ])

    expect(screen.getAllByText(/耗时未知/)).toHaveLength(2)
    expect(screen.getByText('记忆抽取')).toBeInTheDocument()
    expect(screen.getByText('哄睡故事生成')).toBeInTheDocument()
  })
})
