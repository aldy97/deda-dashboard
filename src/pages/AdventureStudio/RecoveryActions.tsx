import { useState } from 'react'
import { Alert, Button, Space, Typography } from 'antd'
import type { ApiError } from '../../api/client'
import {
  useAdventureAuthoring,
  useAdventureRecoveryReset,
  useAdventureRecoverySweep,
} from '../../api/queries'
import type { RecoveryHealthSnapshot } from '../../types/adventureAdmin'
import ReasonDialog from './ReasonDialog'
import { fmtDateTime } from './labels'

/**
 * 自愈链路的两个人工动作：立即巡检一次、解除熔断降级。
 *
 * 两个都走理由弹窗并落审计（action = recovery_sweep / recovery_breaker_reset），
 * 因为「谁在什么时候动了兜底机制」和「谁改了内容」是同一等级的信息：
 * 出事后要回答的第一个问题往往是「那时候兜底是开着的吗、谁关的」。
 *
 * **解除降级是授权回滚，不是自动回滚。** 熔断器跳闸后系统只标记与告警，
 * 绝不自己改内容、绝不自己切版本、也绝不自己解除降级——必须由人查清上游
 * （LLM / RTC / 数据库）确实恢复了，再手输理由解除。这一步只是清掉失败计数
 * 与跳闸标记，不会碰任何一集内容。
 *
 * `audited === false` 必须显式说出来：动作已经生效但审计没写进去，
 * 这种「做了却没留痕」的情况比动作本身更需要被人知道。
 */
interface Props {
  snapshot: RecoveryHealthSnapshot
}

type ActionKey = 'sweep' | 'reset'

interface ResultNote {
  tone: 'success' | 'warning' | 'error' | 'info'
  text: string
}

export default function RecoveryActions({ snapshot }: Props) {
  const authoring = useAdventureAuthoring()
  const sweep = useAdventureRecoverySweep()
  const reset = useAdventureRecoveryReset()
  const [action, setAction] = useState<ActionKey | null>(null)
  const [result, setResult] = useState<ResultNote | null>(null)

  const { breaker, config } = snapshot
  const active = action === 'sweep' ? sweep : action === 'reset' ? reset : null
  const error = (active?.error as ApiError | null) ?? null
  // 没跳闸也没有失败计数时，「解除降级」无事可做；给按钮但不给假动作
  const resetRelevant = breaker.tripped || breaker.failureCount > 0

  function submit(values: { reason: string }) {
    if (action === 'sweep') {
      sweep.mutate(values.reason, {
        onSuccess: (res) => {
          setAction(null)
          const report = res.report
          if (!res.audited) {
            setResult({
              tone: 'error',
              text: '巡检已执行，但审计没写进去（audited=false）。这一次动作没有留痕，请人工记录时间与理由。',
            })
            return
          }
          setResult({
            tone: report.skipped ? 'warning' : 'success',
            text: report.skipped
              ? `巡检被跳过：${report.reason ?? 'kill switch 处于关闭状态'}（没扫库、没修任何东西）`
              : `巡检完成：扫描进度 ${report.scanned.progresses} 条 / 当日记录 ${report.scanned.dailyRecords} 条 / 故事集 ${report.scanned.episodes} 集，修复 ${report.repairs.length} 条，仅告警 ${report.alerts.length} 条，错误 ${report.errors.length} 条。`,
          })
        },
      })
      return
    }
    reset.mutate(values.reason, {
      onSuccess: (res) => {
        setAction(null)
        if (!res.audited) {
          setResult({
            tone: 'error',
            text: '熔断降级已解除，但审计没写进去（audited=false）。这一次动作没有留痕，请人工记录时间与理由。',
          })
          return
        }
        setResult({
          tone: 'info',
          text: res.ok
            ? '已解除降级：失败计数与跳闸标记已清空。没有改动任何一集内容，也没有切换任何版本。'
            : '服务端报告本次解除未生效（ok=false）。请检查 Redis 是否可用，或稍后重试。',
        })
      },
    })
  }

  if (!authoring) {
    return (
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        只读环境不能触发巡检或解除降级（这两个动作都会写审计）。
      </Typography.Text>
    )
  }

  return (
    <Space orientation="vertical" size={8} style={{ width: '100%' }}>
      <Space size={8} wrap>
        <Button size="small" loading={sweep.isPending} onClick={() => setAction('sweep')}>
          立即巡检一次
        </Button>
        <Button
          size="small"
          danger={breaker.tripped}
          disabled={!resetRelevant}
          loading={reset.isPending}
          onClick={() => setAction('reset')}
          title={
            resetRelevant
              ? undefined
              : '熔断器没有跳闸、窗口内也没有失败计数，没有需要解除的降级'
          }
        >
          解除熔断降级（授权回滚）
        </Button>
        {breaker.trippedAt && (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            跳闸于 {fmtDateTime(breaker.trippedAt)}
          </Typography.Text>
        )}
      </Space>

      {result && (
        <Alert
          type={result.tone}
          showIcon
          closable
          onClose={() => setResult(null)}
          message={result.text}
        />
      )}

      {!config.enabled && (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          自愈巡检的 kill switch 当前是关闭的：手动触发也会被服务端拒绝（能被 API 绕过的开关不是开关）。
        </Typography.Text>
      )}

      {action === 'sweep' && (
        <ReasonDialog
          key="sweep"
          open
          title="立即巡检一次"
          okText="开始巡检"
          pending={sweep.isPending}
          error={error}
          onCancel={() => setAction(null)}
          onSubmit={submit}
          description={
            <Space orientation="vertical" size={6} style={{ width: '100%' }}>
              <Typography.Text>
                立刻跑一轮定时巡检该做的事：扫出「连孩子开口那一刻都走不通」的静默病态
                （挂起超时、非互动段却在等回答、版本行缺失、段号溢出、当日记录与进度状态冲突、已下架却仍在播……），
                能安全修的当场修，不能安全修的只告警、不动内容。
              </Typography.Text>
              <Typography.Text type="secondary">
                定时巡检本来每 {Math.round(config.sweepIntervalMs / 1000)} 秒自己跑一次；
                手动触发的用途是「刚修完上游，想立刻确认孩子那一侧已经恢复」。会落一条审计。
              </Typography.Text>
            </Space>
          }
        />
      )}

      {action === 'reset' && (
        <ReasonDialog
          key="reset"
          open
          title="解除熔断降级"
          okText="确认解除"
          danger
          pending={reset.isPending}
          error={error}
          onCancel={() => setAction(null)}
          onSubmit={submit}
          description={
            <Space orientation="vertical" size={6} style={{ width: '100%' }}>
              <Typography.Text>
                当前窗口内有 <Typography.Text strong>{breaker.failureCount}</Typography.Text> 次兜底失败
                （阈值 {breaker.threshold} / 窗口 {Math.round(breaker.windowMs / 1000)} 秒），
                {breaker.tripped ? '熔断器已跳闸。' : '尚未跳闸。'}
              </Typography.Text>
              <Typography.Text>
                解除只会清掉失败计数与跳闸标记，<Typography.Text strong>不改任何一集内容、不切换任何版本、不动任何设备的进度</Typography.Text>。
                这是**授权回滚**：系统永远不会自己解除降级，因为它无法判断上游（LLM / RTC / 数据库）是不是真的好了。
              </Typography.Text>
              <Typography.Text type="danger">
                请先确认上游已经恢复。过早解除会让兜底在仍然坏着的链路上继续失败，
                而失败计数被清空后，下一次的连续失败会重新从零开始累计，跳闸告警也会来得更晚。
              </Typography.Text>
              {breaker.recentReasons.length > 0 && (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  最近的失败原因：{breaker.recentReasons.slice(0, 5).join('；')}
                </Typography.Text>
              )}
            </Space>
          }
        />
      )}
    </Space>
  )
}
