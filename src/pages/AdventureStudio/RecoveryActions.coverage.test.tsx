import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import RecoveryActions from './RecoveryActions'
import {
  useAdventureAuthoring,
  useAdventureRecoveryReset,
  useAdventureRecoverySweep,
} from '../../api/queries'
import type {
  RecoveryHealthSnapshot,
  RecoveryResetResult,
  RecoverySweepResult,
  SweepReport,
} from '../../types/adventureAdmin'

/**
 * 两个人工动作都必须：走理由弹窗、把理由原样交给 mutation、
 * 并把「动作生效但审计没写进去」显式说出来（audited=false 比失败更需要被看见）。
 */
vi.mock('../../api/queries', () => ({
  useAdventureAuthoring: vi.fn(),
  useAdventureRecoverySweep: vi.fn(),
  useAdventureRecoveryReset: vi.fn(),
}))

const mockAuthoring = useAdventureAuthoring as unknown as ReturnType<typeof vi.fn>
const mockSweep = useAdventureRecoverySweep as unknown as ReturnType<typeof vi.fn>
const mockReset = useAdventureRecoveryReset as unknown as ReturnType<typeof vi.fn>

function snapshot(
  overrides: {
    breaker?: Partial<RecoveryHealthSnapshot['breaker']>
    config?: Partial<RecoveryHealthSnapshot['config']>
  } = {},
): RecoveryHealthSnapshot {
  return {
    breaker: {
      enabled: true,
      tripped: false,
      failureCount: 0,
      degraded: false,
      trippedAt: null,
      windowMs: 300_000,
      threshold: 5,
      recentReasons: [],
      error: null,
      ...overrides.breaker,
    },
    config: {
      enabled: true,
      sweepIntervalMs: 60_000,
      staleAwaitMs: 90_000,
      staleAwaitAction: 'alert',
      breakerWindowMs: 600_000,
      breakerThreshold: 5,
      breakerTrippedTtlSeconds: 3_600,
      ...overrides.config,
    },
    sweeps: [],
    engineFailures: [],
  }
}

function mutation(overrides: Record<string, unknown> = {}) {
  return { mutate: vi.fn(), isPending: false, error: null, ...overrides }
}

function report(overrides: Partial<SweepReport> = {}): SweepReport {
  return {
    startedAt: '2026-11-20T04:00:00.000Z',
    finishedAt: '2026-11-20T04:00:02.000Z',
    durationMs: 2000,
    skipped: false,
    reason: null,
    scanned: { progresses: 12, dailyRecords: 5, episodes: 3 },
    repairs: [],
    alerts: [],
    errors: [],
    ...overrides,
  }
}

const REASON = '上游已经恢复，确认解除降级'

function typeReason(value = REASON) {
  fireEvent.change(screen.getByPlaceholderText(/半年后别人/), {
    target: { value },
  })
}

async function succeedSweep(res: RecoverySweepResult) {
  const opts = mockSweep.mock.results[0]?.value.mutate.mock.calls[0]?.[1] as {
    onSuccess: (value: RecoverySweepResult) => void
  }
  await act(async () => {
    opts.onSuccess(res)
  })
}

async function succeedReset(res: RecoveryResetResult) {
  const opts = mockReset.mock.results[0]?.value.mutate.mock.calls[0]?.[1] as {
    onSuccess: (value: RecoveryResetResult) => void
  }
  await act(async () => {
    opts.onSuccess(res)
  })
}

describe('RecoveryActions · 环境与按钮状态', () => {
  it('只读环境不提供任何写动作，只说明原因', () => {
    mockAuthoring.mockReturnValue(false)
    mockSweep.mockReturnValue(mutation())
    mockReset.mockReturnValue(mutation())

    render(<RecoveryActions snapshot={snapshot()} />)

    expect(
      screen.getByText(/只读环境不能触发巡检或解除降级/),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: '立即巡检一次' }),
    ).not.toBeInTheDocument()
  })

  it('没跳闸也没有失败计数时，「解除熔断降级」禁用并说明无事可做', () => {
    mockAuthoring.mockReturnValue(true)
    mockSweep.mockReturnValue(mutation())
    mockReset.mockReturnValue(mutation())

    render(<RecoveryActions snapshot={snapshot()} />)

    const resetButton = screen.getByRole('button', {
      name: /解除熔断降级/,
    })
    expect(resetButton).toBeDisabled()
    expect(resetButton.getAttribute('title')).toBe(
      '熔断器没有跳闸、窗口内也没有失败计数，没有需要解除的降级',
    )
  })

  it('熔断器跳闸：解除按钮变危险色、可点，并显示跳闸时间', () => {
    mockAuthoring.mockReturnValue(true)
    mockSweep.mockReturnValue(mutation())
    mockReset.mockReturnValue(mutation())

    render(
      <RecoveryActions
        snapshot={snapshot({
          breaker: {
            tripped: true,
            failureCount: 5,
            trippedAt: '2026-11-20T04:00:00.000Z',
          },
        })}
      />,
    )

    const resetButton = screen.getByRole('button', { name: /解除熔断降级/ })
    expect(resetButton).not.toBeDisabled()
    expect(resetButton.className).toContain('ant-btn-dangerous')
    expect(screen.getByText(/跳闸于 2026-11-20/)).toBeInTheDocument()
  })

  it('kill switch 关闭时说明手动触发也会被服务端拒绝', () => {
    mockAuthoring.mockReturnValue(true)
    mockSweep.mockReturnValue(mutation())
    mockReset.mockReturnValue(mutation())

    render(<RecoveryActions snapshot={snapshot({ config: { enabled: false } })} />)

    expect(
      screen.getByText(/自愈巡检的 kill switch 当前是关闭的/),
    ).toBeInTheDocument()
  })

  it('巡检进行中按钮转圈', () => {
    mockAuthoring.mockReturnValue(true)
    mockSweep.mockReturnValue(mutation({ isPending: true }))
    mockReset.mockReturnValue(mutation())

    render(<RecoveryActions snapshot={snapshot()} />)

    expect(
      screen.getByRole('button', { name: /立即巡检一次/ }).className,
    ).toContain('ant-btn-loading')
  })
})

describe('RecoveryActions · 手动巡检', () => {
  it('弹窗写出会做什么与审计后果，提交把理由原样交给 sweep', () => {
    mockAuthoring.mockReturnValue(true)
    mockSweep.mockReturnValue(mutation())
    mockReset.mockReturnValue(mutation())

    render(<RecoveryActions snapshot={snapshot()} />)

    fireEvent.click(screen.getByRole('button', { name: /立即巡检一次/ }))
    expect(
      within(screen.getByRole('dialog')).getByText('立即巡检一次'),
    ).toBeInTheDocument()
    expect(screen.getByText(/定时巡检本来每 60 秒自己跑一次/)).toBeInTheDocument()

    typeReason()
    fireEvent.click(screen.getByRole('button', { name: '开始巡检' }))

    expect(mockSweep).toHaveBeenCalled()
    const mutate = mockSweep.mock.results[0].value.mutate
    expect(mutate).toHaveBeenCalledWith(REASON, expect.any(Object))
  })

  it('巡检完成：汇报扫描量、修复数、告警数与错误数', async () => {
    mockAuthoring.mockReturnValue(true)
    mockSweep.mockReturnValue(mutation())
    mockReset.mockReturnValue(mutation())

    render(<RecoveryActions snapshot={snapshot()} />)

    fireEvent.click(screen.getByRole('button', { name: /立即巡检一次/ }))
    typeReason()
    fireEvent.click(screen.getByRole('button', { name: '开始巡检' }))

    await succeedSweep({
      report: report({
        repairs: [
          {
            code: 'AWAITING_NON_INTERACTION',
            deviceId: 'dev-1',
            episodeId: 'ep1',
            dailyRecordId: null,
            progressId: 'p1',
            target: 'progress',
            from: 'awaiting_reply',
            to: 'exited',
            detail: '等待态但当前段不是互动点',
          },
        ],
        alerts: [],
        errors: ['redis timeout'],
      }),
      audited: true,
    })

    expect(
      screen.getByText(
        '巡检完成：扫描进度 12 条 / 当日记录 5 条 / 故事集 3 集，修复 1 条，仅告警 0 条，错误 1 条。',
      ),
    ).toBeInTheDocument()
    // 成功后弹窗关闭
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: '开始巡检' }),
      ).not.toBeInTheDocument(),
    )
  })

  it('巡检被跳过：明确指出没扫库、没修东西，并透出原因', async () => {
    mockAuthoring.mockReturnValue(true)
    mockSweep.mockReturnValue(mutation())
    mockReset.mockReturnValue(mutation())

    render(<RecoveryActions snapshot={snapshot()} />)

    fireEvent.click(screen.getByRole('button', { name: /立即巡检一次/ }))
    typeReason()
    fireEvent.click(screen.getByRole('button', { name: '开始巡检' }))

    await succeedSweep({
      report: report({ skipped: true, reason: 'ADVENTURE_RECOVERY_ENABLED=false' }),
      audited: true,
    })

    expect(
      screen.getByText(
        '巡检被跳过：ADVENTURE_RECOVERY_ENABLED=false（没扫库、没修任何东西）',
      ),
    ).toBeInTheDocument()
  })

  it('巡检跳过但没给原因时用「kill switch 处于关闭状态」兜底', async () => {
    mockAuthoring.mockReturnValue(true)
    mockSweep.mockReturnValue(mutation())
    mockReset.mockReturnValue(mutation())

    render(<RecoveryActions snapshot={snapshot()} />)

    fireEvent.click(screen.getByRole('button', { name: /立即巡检一次/ }))
    typeReason()
    fireEvent.click(screen.getByRole('button', { name: '开始巡检' }))

    await succeedSweep({
      report: report({ skipped: true, reason: null }),
      audited: true,
    })

    expect(
      screen.getByText(
        '巡检被跳过：kill switch 处于关闭状态（没扫库、没修任何东西）',
      ),
    ).toBeInTheDocument()
  })

  it('巡检生效但审计没写进去：明确要求人工记录', async () => {
    mockAuthoring.mockReturnValue(true)
    mockSweep.mockReturnValue(mutation())
    mockReset.mockReturnValue(mutation())

    render(<RecoveryActions snapshot={snapshot()} />)

    fireEvent.click(screen.getByRole('button', { name: /立即巡检一次/ }))
    typeReason()
    fireEvent.click(screen.getByRole('button', { name: '开始巡检' }))

    await succeedSweep({ report: report(), audited: false })

    expect(
      screen.getByText(
        '巡检已执行，但审计没写进去（audited=false）。这一次动作没有留痕，请人工记录时间与理由。',
      ),
    ).toBeInTheDocument()
  })

  it('结果提示可关闭', async () => {
    mockAuthoring.mockReturnValue(true)
    mockSweep.mockReturnValue(mutation())
    mockReset.mockReturnValue(mutation())

    render(<RecoveryActions snapshot={snapshot()} />)

    fireEvent.click(screen.getByRole('button', { name: /立即巡检一次/ }))
    typeReason()
    fireEvent.click(screen.getByRole('button', { name: '开始巡检' }))
    await succeedSweep({ report: report(), audited: true })

    const close = document.querySelector('.ant-alert-close-icon')
    expect(close).not.toBeNull()
    fireEvent.click(close as Element)

    await waitFor(() =>
      expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
    )
  })
})

describe('RecoveryActions · 解除熔断降级', () => {
  function openReset(snapshotOverrides = {}) {
    mockAuthoring.mockReturnValue(true)
    mockSweep.mockReturnValue(mutation())
    mockReset.mockReturnValue(mutation())
    render(
      <RecoveryActions
        snapshot={snapshot({
          breaker: { tripped: true, failureCount: 3, trippedAt: null, ...snapshotOverrides },
        })}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /解除熔断降级/ }))
  }

  it('弹窗说明只清计数、不改内容，并列出最近失败原因', () => {
    mockAuthoring.mockReturnValue(true)
    mockSweep.mockReturnValue(mutation())
    mockReset.mockReturnValue(mutation())
    render(
      <RecoveryActions
        snapshot={snapshot({
          breaker: {
            tripped: true,
            failureCount: 3,
            recentReasons: ['LLM 超时', 'RTC 断流'],
          },
        })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /解除熔断降级/ }))

    expect(screen.getByText('解除熔断降级')).toBeInTheDocument()
    expect(screen.getByText(/熔断器已跳闸/)).toBeInTheDocument()
    expect(screen.getByText(/最近的失败原因：LLM 超时；RTC 断流/)).toBeInTheDocument()
  })

  it('提交后调用 reset，并在审计失败时显式提示', async () => {
    openReset()

    typeReason()
    fireEvent.click(screen.getByRole('button', { name: '确认解除' }))

    const mutate = mockReset.mock.results[0].value.mutate
    expect(mutate).toHaveBeenCalledWith(REASON, expect.any(Object))

    await succeedReset({ ok: true, audited: false })

    expect(
      screen.getByText(
        '熔断降级已解除，但审计没写进去（audited=false）。这一次动作没有留痕，请人工记录时间与理由。',
      ),
    ).toBeInTheDocument()
  })

  it('解除成功：说明没改任何内容', async () => {
    openReset()

    typeReason()
    fireEvent.click(screen.getByRole('button', { name: '确认解除' }))
    await succeedReset({ ok: true, audited: true })

    expect(
      screen.getByText(
        '已解除降级：失败计数与跳闸标记已清空。没有改动任何一集内容，也没有切换任何版本。',
      ),
    ).toBeInTheDocument()
  })

  it('服务端报告 ok=false：给出排查方向而不是假装成功', async () => {
    openReset()

    typeReason()
    fireEvent.click(screen.getByRole('button', { name: '确认解除' }))
    await succeedReset({ ok: false, audited: true })

    expect(
      screen.getByText(
        '服务端报告本次解除未生效（ok=false）。请检查 Redis 是否可用，或稍后重试。',
      ),
    ).toBeInTheDocument()
  })

  it('mutation 报错时错误留在弹窗里，带领域码与 HTTP 状态', () => {
    mockAuthoring.mockReturnValue(true)
    mockSweep.mockReturnValue(mutation())
    mockReset.mockReturnValue(
      mutation({
        error: { status: 403, message: '当前环境只读', domainCode: 'READONLY' },
      }),
    )
    render(
      <RecoveryActions
        snapshot={snapshot({ breaker: { tripped: true, failureCount: 1 } })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /解除熔断降级/ }))

    expect(screen.getByText('服务端拒绝了这次操作')).toBeInTheDocument()
    expect(screen.getByText('当前环境只读')).toBeInTheDocument()
    expect(screen.getByText('READONLY')).toBeInTheDocument()
    expect(screen.getByText(/HTTP 403/)).toBeInTheDocument()
  })

  it('取消弹窗不触发任何 mutation', () => {
    openReset()

    fireEvent.click(screen.getByRole('button', { name: /取\s*消/ }))

    expect(mockReset.mock.results[0].value.mutate).not.toHaveBeenCalled()
  })
})
