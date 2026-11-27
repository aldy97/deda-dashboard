import { describe, expect, it } from 'vitest'
import type { LlmTurnCall } from '../../types/analytics'
import {
  buildTurnChainLayout,
  callStartMs,
  fillerAnswerGapMs,
} from './turn-chain-layout'

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

/**
 * 一组真实形状的调用（createdAt 是写库时间≈结束时刻）：
 * intent 660→1000、safety 661→1023、memory 1024→1312、chat 1024→1465（首包 +150）
 */
function sampleCalls(): LlmTurnCall[] {
  return [
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
      createdAt: iso(1465),
    }),
  ]
}

describe('callStartMs', () => {
  it('createdAt 是结束时刻，开始 = createdAt - latencyMs', () => {
    expect(
      callStartMs(makeCall({ latencyMs: 340, createdAt: iso(1000) })),
    ).toBe(BASE + 660)
  })

  it('耗时未知或为负、createdAt 非法时返回 null', () => {
    expect(callStartMs(makeCall({ latencyMs: null }))).toBeNull()
    expect(callStartMs(makeCall({ latencyMs: -1 }))).toBeNull()
    expect(callStartMs(makeCall({ createdAt: 'not-a-date' }))).toBeNull()
  })
})

describe('buildTurnChainLayout', () => {
  it('以最早一次调用的开始为零点，按真实耗时画区间', () => {
    const layout = buildTurnChainLayout(sampleCalls())
    const total = 805

    expect(layout.originIso).toBe(iso(660))
    expect(layout.totalMs).toBe(total)
    expect(layout.unknownDurationCount).toBe(0)
    expect(layout.rows.map((row) => row.call.id)).toEqual([
      'intent',
      'safety',
      'memory',
      'chat',
    ])

    const [intent, safety, memory, chat] = layout.rows
    expect(intent.startOffsetMs).toBe(0)
    expect(intent.endOffsetMs).toBe(340)
    expect(intent.leftPct).toBe(0)
    expect(intent.widthPct).toBeCloseTo((340 / total) * 100, 2)

    expect(safety.startOffsetMs).toBe(1)
    expect(safety.widthPct).toBeCloseTo((362 / total) * 100, 2)

    // 记忆抽取在 L2/意图之后才触发，与主回答并行而不是与前三步并行
    expect(memory.startOffsetMs).toBe(364)
    expect(memory.widthPct).toBeCloseTo((288 / total) * 100, 2)
    expect(chat.startOffsetMs).toBe(364)
    expect(chat.widthPct).toBeCloseTo((441 / total) * 100, 2)
  })

  it('区间相交才标记并行，首尾相接不算', () => {
    const layout = buildTurnChainLayout(sampleCalls())
    const byId = new Map(layout.rows.map((row) => [row.call.id, row]))

    expect(byId.get('intent')?.parallelWith).toEqual(['safety'])
    expect(byId.get('safety')?.parallelWith).toEqual(['intent'])
    expect(byId.get('memory')?.parallelWith).toEqual(['chat'])
    expect(byId.get('chat')?.parallelWith).toEqual(['memory'])
  })

  it('首包标记落在条内，且按调用自身的 firstTokenMs 定位', () => {
    const layout = buildTurnChainLayout(sampleCalls())
    const chat = layout.rows.find((row) => row.call.id === 'chat')!
    expect(chat.ttftPct).toBeCloseTo(((364 + 150) / 805) * 100, 2)

    const intent = layout.rows.find((row) => row.call.id === 'intent')!
    expect(intent.ttftPct).toBeNull()
  })

  it('首包脏数据 clamp 进调用区间', () => {
    const tooLate = buildTurnChainLayout([
      makeCall({
        id: 'chat',
        scene: 'chat_main',
        latencyMs: 200,
        firstTokenMs: 900,
        createdAt: iso(200),
      }),
    ]).rows[0]
    expect(tooLate.ttftPct).toBe(100)

    const negative = buildTurnChainLayout([
      makeCall({
        id: 'chat',
        scene: 'chat_main',
        latencyMs: 200,
        firstTokenMs: -50,
        createdAt: iso(200),
      }),
    ]).rows[0]
    expect(negative.ttftPct).toBe(0)
  })

  it('耗时未知的行保留可定位的结束点，但不参与零点与总跨度计算', () => {
    const layout = buildTurnChainLayout([
      makeCall({ id: 'intent', latencyMs: 100, createdAt: iso(100) }),
      makeCall({
        id: 'memory',
        scene: 'memory_extract',
        latencyMs: null,
        createdAt: iso(300),
      }),
    ])

    expect(layout.originIso).toBe(iso(0))
    expect(layout.totalMs).toBe(300)
    expect(layout.unknownDurationCount).toBe(1)
    const memory = layout.rows.find((row) => row.call.id === 'memory')!
    expect(memory.durationMs).toBeNull()
    expect(memory.startOffsetMs).toBeNull()
    expect(memory.leftPct).toBe(100)
    expect(memory.widthPct).toBe(0)
  })

  it('createdAt 非法时无法定位，但不丢行', () => {
    const layout = buildTurnChainLayout([
      makeCall({ id: 'intent', latencyMs: 100, createdAt: iso(100) }),
      makeCall({ id: 'broken', latencyMs: 100, createdAt: 'bad' }),
    ])

    expect(layout.rows).toHaveLength(2)
    const broken = layout.rows.find((row) => row.call.id === 'broken')!
    expect(broken.leftPct).toBeNull()
    expect(broken.widthPct).toBeNull()
  })

  it('全部不可定位时给出可渲染的兜底跨度', () => {
    const layout = buildTurnChainLayout([
      makeCall({ id: 'a', latencyMs: null, createdAt: 'bad' }),
      makeCall({ id: 'b', latencyMs: null, createdAt: 'bad' }),
    ])

    expect(layout.originIso).toBeNull()
    expect(layout.totalMs).toBe(1)
    expect(layout.unknownDurationCount).toBe(2)
    expect(layout.rows.every((row) => row.leftPct === null)).toBe(true)
  })

  it('按开始时间排序，而不是沿用接口的结束时间顺序', () => {
    const layout = buildTurnChainLayout([
      // 接口按 createdAt 升序：长的调用先开始、后结束，会排在后面
      makeCall({ id: 'late-end', latencyMs: 900, createdAt: iso(1000) }),
      makeCall({ id: 'early-end', latencyMs: 100, createdAt: iso(500) }),
    ])

    expect(layout.rows.map((row) => row.call.id)).toEqual([
      'late-end',
      'early-end',
    ])
  })

  it('同一时刻开始时按结束时间与 id 稳定排序', () => {
    const layout = buildTurnChainLayout([
      makeCall({ id: 'b', latencyMs: 200, createdAt: iso(200) }),
      makeCall({ id: 'a', latencyMs: 100, createdAt: iso(100) }),
    ])

    expect(layout.rows.map((row) => row.call.id)).toEqual(['a', 'b'])
  })

  it('零耗时不除零，总跨度兜底为 1ms', () => {
    const layout = buildTurnChainLayout([
      makeCall({ id: 'a', latencyMs: 0, createdAt: iso(0) }),
    ])

    expect(layout.totalMs).toBe(1)
    expect(layout.rows[0].widthPct).toBe(0)
  })
})

describe('fillerAnswerGapMs', () => {
  const fillerCall = (overrides: Partial<LlmTurnCall> = {}) =>
    makeCall({
      id: 'filler',
      scene: 'filler',
      success: true,
      latencyMs: 200,
      firstTokenMs: 40,
      createdAt: iso(2000),
      ...overrides,
    })

  const answerCall = (overrides: Partial<LlmTurnCall> = {}) =>
    makeCall({
      id: 'chat',
      scene: 'chat_main',
      tier: 'main',
      latencyMs: 400,
      firstTokenMs: 100,
      createdAt: iso(2500),
      ...overrides,
    })

  it('filler 收尾到主回答首包的空窗（历史链路）', () => {
    expect(fillerAnswerGapMs([fillerCall(), answerCall()])).toBe(200)
  })

  it('主回答首包早于 filler 收尾时返回负值', () => {
    expect(
      fillerAnswerGapMs([
        fillerCall({ latencyMs: 300, createdAt: iso(2300) }),
        answerCall({ createdAt: iso(2400) }),
      ]),
    ).toBe(-200)
  })

  it('缺任一侧、失败或耗时未知时算不出来', () => {
    expect(fillerAnswerGapMs([answerCall()])).toBeNull()
    expect(fillerAnswerGapMs([fillerCall()])).toBeNull()
    expect(fillerAnswerGapMs([fillerCall({ success: false }), answerCall()])).toBeNull()
    expect(fillerAnswerGapMs([fillerCall({ latencyMs: null }), answerCall()])).toBeNull()
    expect(fillerAnswerGapMs([fillerCall(), answerCall({ firstTokenMs: null })])).toBeNull()
    expect(fillerAnswerGapMs([fillerCall(), answerCall({ latencyMs: null })])).toBeNull()
    expect(fillerAnswerGapMs([fillerCall({ createdAt: 'bad' }), answerCall()])).toBeNull()
  })
})
