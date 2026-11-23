import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import HealthPanel from './HealthPanel'
import {
  useAdventureAuthoring,
  useAdventureRecovery,
  useAdventureRecoveryReset,
  useAdventureRecoverySweep,
} from '../../api/queries'
import type {
  AlertRecord,
  EngineFailureRecord,
  RepairRecord,
  RecoveryHealthSnapshot,
  SweepReport,
} from '../../types/adventureAdmin'

/**
 * 健康面板的意义是把「孩子那一侧到底有没有兜住」变成看得见的数字。
 * 四种熔断器状态（跳闸 / 观测降级 / 开关关闭 / 正常）必须各自有一句不同的话，
 * 三张表（巡检 / 引擎失败）的空态与展开明细也要能读。
 */
vi.mock('../../api/queries', () => ({
  useAdventureRecovery: vi.fn(),
  useAdventureAuthoring: vi.fn(),
  useAdventureRecoverySweep: vi.fn(),
  useAdventureRecoveryReset: vi.fn(),
}))

const mockRecovery = useAdventureRecovery as unknown as ReturnType<typeof vi.fn>
const mockAuthoring = useAdventureAuthoring as unknown as ReturnType<typeof vi.fn>
const mockSweep = useAdventureRecoverySweep as unknown as ReturnType<typeof vi.fn>
const mockReset = useAdventureRecoveryReset as unknown as ReturnType<typeof vi.fn>

function mutation() {
  return { mutate: vi.fn(), isPending: false, error: null }
}

function snapshot(
  overrides: {
    breaker?: Partial<RecoveryHealthSnapshot['breaker']>
    config?: Partial<RecoveryHealthSnapshot['config']>
    sweeps?: SweepReport[]
    engineFailures?: EngineFailureRecord[]
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
    sweeps: overrides.sweeps ?? [],
    engineFailures: overrides.engineFailures ?? [],
  }
}

function sweep(index = 0, overrides: Partial<SweepReport> = {}): SweepReport {
  return {
    startedAt: `2026-11-${String(10 + index).padStart(2, '0')}T04:00:00.000Z`,
    finishedAt: `2026-11-${String(10 + index).padStart(2, '0')}T04:00:02.000Z`,
    durationMs: 1234 + index,
    skipped: false,
    reason: null,
    scanned: { progresses: 12, dailyRecords: 5, episodes: 3 },
    repairs: [],
    alerts: [],
    errors: [],
    ...overrides,
  }
}

const repair: RepairRecord = {
  code: 'AWAITING_NON_INTERACTION',
  deviceId: 'dev-1',
  episodeId: 'ep1',
  dailyRecordId: null,
  progressId: 'p-1',
  target: 'progress',
  from: 'awaiting_reply',
  to: 'exited',
  detail: '当前段不是互动点',
}

const alertWithDevice: AlertRecord = {
  code: 'VERSION_ROW_MISSING',
  deviceId: 'dev-2',
  episodeId: 'ep1',
  detail: '版本快照缺行',
}

const alertWithoutDevice: AlertRecord = {
  code: 'SEGMENT_TABLE_DRIFT',
  deviceId: null,
  episodeId: 'ep2',
  detail: '段落表与快照漂移',
}

const failures: EngineFailureRecord[] = [
  {
    deviceId: 'dev-1',
    phase: 'start_today',
    reason: 'LLM 超时',
    recovered: true,
    at: '2026-11-20T04:00:00.000Z',
  },
  {
    deviceId: 'dev-2',
    phase: 'handle_reply',
    reason: 'RTC 断流',
    recovered: false,
    at: '2026-11-20T05:00:00.000Z',
  },
  {
    deviceId: 'dev-3',
    phase: 'check_timeout',
    reason: '定时任务没起来',
    recovered: false,
    at: '2026-11-20T06:00:00.000Z',
  },
  {
    deviceId: 'dev-4',
    phase: 'legacy_phase' as unknown as EngineFailureRecord['phase'],
    reason: '旧版本上报',
    recovered: true,
    at: '2026-11-20T07:00:00.000Z',
  },
]

function renderPanel(
  queryState: Record<string, unknown> = {},
) {
  mockAuthoring.mockReturnValue(true)
  mockSweep.mockReturnValue(mutation())
  mockReset.mockReturnValue(mutation())
  mockRecovery.mockReturnValue({
    data: undefined,
    isLoading: false,
    error: null,
    ...queryState,
  })
  return render(<HealthPanel />)
}

describe('HealthPanel · 加载与空态', () => {
  it('加载中显示转圈，不提前说「暂无数据」', () => {
    renderPanel({ isLoading: true })

    expect(document.querySelector('.ant-spin-spinning')).not.toBeNull()
    expect(screen.queryByText('暂无自愈健康数据')).not.toBeInTheDocument()
  })

  it('加载完但没有快照时显示空态', () => {
    renderPanel()

    expect(screen.getByText('暂无自愈健康数据')).toBeInTheDocument()
  })

  it('快照加载失败时给出服务端 message', () => {
    renderPanel({ error: new Error('自愈快照服务挂了') })

    expect(screen.getByText('自愈健康快照加载失败')).toBeInTheDocument()
    expect(screen.getByText('自愈快照服务挂了')).toBeInTheDocument()
    expect(screen.getByText('暂无自愈健康数据')).toBeInTheDocument()
  })
})

describe('HealthPanel · 熔断器状态', () => {
  it('一切正常时明确说「未跳闸」并展示空表态', () => {
    renderPanel({ data: snapshot() })

    expect(
      screen.getByText('兜底链路正常，熔断器未跳闸'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('还没有巡检记录（服务刚启动，或 kill switch 关着）'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('最近没有引擎失败——这是期望中的常态'),
    ).toBeInTheDocument()
    expect(screen.getByText('恢复熔断器')).toBeInTheDocument()
    expect(screen.getByText('生效配置')).toBeInTheDocument()
    expect(screen.getByText('开')).toBeInTheDocument()
  })

  it('跳闸：显示失败次数 / 阈值，并强调只标记不改内容', () => {
    renderPanel({
      data: snapshot({
        breaker: {
          tripped: true,
          failureCount: 5,
          trippedAt: '2026-11-20T04:00:00.000Z',
          recentReasons: ['LLM 超时', 'RTC 断流'],
        },
      }),
    })

    expect(
      screen.getByText('恢复熔断器已跳闸（5 次兜底失败 / 阈值 5）'),
    ).toBeInTheDocument()
    expect(screen.getByText(/不会自动改任何内容/)).toBeInTheDocument()
    expect(screen.getByText('最近的失败原因')).toBeInTheDocument()
    expect(screen.getByText('LLM 超时')).toBeInTheDocument()
    expect(screen.getByText('RTC 断流')).toBeInTheDocument()
    expect(screen.getAllByText(/2026-11-20/).length).toBeGreaterThanOrEqual(1)
  })

  it('观测降级：说明「未熔断」不等于链路健康', () => {
    renderPanel({
      data: snapshot({ breaker: { degraded: true, failureCount: 2 } }),
    })

    expect(
      screen.getByText('观测降级：Redis 不可用，熔断器当前不工作'),
    ).toBeInTheDocument()
    expect(screen.getByText(/宁可漏报/)).toBeInTheDocument()
  })

  it('熔断器被关闭：说明失败不会累计', () => {
    renderPanel({ data: snapshot({ breaker: { enabled: false } }) })

    expect(
      screen.getByText('恢复熔断器已被关闭'),
    ).toBeInTheDocument()
  })

  it('巡检被 kill switch 关闭：说明连手动触发也会被拒绝', () => {
    renderPanel({ data: snapshot({ config: { enabled: false } }) })

    expect(
      screen.getByText('自愈巡检已被 kill switch 关闭'),
    ).toBeInTheDocument()
    expect(screen.getByText('关')).toBeInTheDocument()
  })

  it('熔断器自身读写异常时单独告警', () => {
    renderPanel({
      data: snapshot({ breaker: { error: 'Redis EVAL 失败' } }),
    })

    expect(
      screen.getByText('熔断器自身读写异常'),
    ).toBeInTheDocument()
    expect(screen.getByText('Redis EVAL 失败')).toBeInTheDocument()
  })
})

describe('HealthPanel · 巡检表与展开明细', () => {
  it('渲染巡检行、跳过原因与耗时，可展开看修复/告警/错误明细', () => {
    renderPanel({
      data: snapshot({
        sweeps: [
          sweep(0, {
            repairs: [repair],
            alerts: [alertWithDevice, alertWithoutDevice],
            errors: ['redis timeout'],
          }),
          sweep(1),
        ],
      }),
    })

    expect(screen.getAllByText('已执行')).toHaveLength(2)
    expect(screen.getAllByText('1.2 s')).toHaveLength(2)
    expect(screen.getAllByText(/进度 12 · 当日 5 · 故事集 3/)).toHaveLength(2)

    const expander = document.querySelector(
      '.ant-table-row-expand-icon-collapsed',
    )
    expect(expander).not.toBeNull()
    fireEvent.click(expander as Element)

    expect(screen.getByText('修复明细（1）')).toBeInTheDocument()
    expect(screen.getByText('告警明细（2）')).toBeInTheDocument()
    expect(screen.getByText('巡检自身出错 1 条')).toBeInTheDocument()
    expect(screen.getByText('redis timeout')).toBeInTheDocument()
    expect(screen.getByText('等待态但当前段不是互动点')).toBeInTheDocument()
    expect(screen.getByText(/· 当前段不是互动点/)).toBeInTheDocument()
    expect(screen.getByText(/· 版本快照缺行/)).toBeInTheDocument()
    expect(screen.getByText(/· 段落表与快照漂移/)).toBeInTheDocument()
    expect(screen.getByText('dev-2')).toBeInTheDocument()
  })

  it('只有错误、没有修复/告警时，展开后仍是两句「本次没有」', () => {
    renderPanel({
      data: snapshot({
        sweeps: [sweep(0, { errors: ['巡检挂了'] })],
      }),
    })

    fireEvent.click(
      document.querySelector('.ant-table-row-expand-icon-collapsed') as Element,
    )

    expect(screen.getByText('本次没有修任何数据')).toBeInTheDocument()
    expect(screen.getByText('本次没有告警')).toBeInTheDocument()
    expect(screen.getByText('巡检挂了')).toBeInTheDocument()
  })

  it('跳过的巡检写明原因；没给原因时用「未给原因」', () => {
    renderPanel({
      data: snapshot({
        sweeps: [
          sweep(0, { skipped: true, reason: 'ADVENTURE_RECOVERY_ENABLED=false' }),
          sweep(1, { skipped: true, reason: null }),
        ],
      }),
    })

    expect(
      screen.getByText('已跳过：ADVENTURE_RECOVERY_ENABLED=false'),
    ).toBeInTheDocument()
    expect(screen.getByText('已跳过：未给原因')).toBeInTheDocument()
  })

  it('超过 10 份时按页展示，翻页后只看得到第二页', () => {
    const sweeps = Array.from({ length: 12 }, (_, index) => sweep(index))
    renderPanel({ data: snapshot({ sweeps }) })

    expect(
      document.querySelectorAll('.ant-table-row-level-0'),
    ).toHaveLength(10)

    fireEvent.click(
      document.querySelector('.ant-pagination-item-2 a') as Element,
    )

    expect(
      document.querySelectorAll('.ant-table-row-level-0'),
    ).toHaveLength(2)
  })
})

describe('HealthPanel · 引擎失败记录', () => {
  it('四个阶段（含未知值）与是否平移都按服务端字段渲染', () => {
    renderPanel({ data: snapshot({ engineFailures: failures }) })

    expect(screen.getByText('开始今日冒险')).toBeInTheDocument()
    expect(screen.getByText('处理孩子的回答')).toBeInTheDocument()
    expect(screen.getByText('等待超时检查')).toBeInTheDocument()
    expect(screen.getByText('legacy_phase')).toBeInTheDocument()
    expect(screen.getByText('LLM 超时')).toBeInTheDocument()
    expect(screen.getByText('RTC 断流')).toBeInTheDocument()
    expect(screen.getAllByText('已换下一集')).toHaveLength(2)
    expect(screen.getAllByText('降级到兜底话术')).toHaveLength(2)
    expect(screen.getByText(/共 4 条/)).toBeInTheDocument()
  })
})
