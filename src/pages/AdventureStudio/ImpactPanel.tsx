import { Alert, Col, Row, Statistic, Typography } from 'antd'
import InfoTip from '../../components/InfoTip'
import type { EpisodeImpact } from '../../types/adventureAdmin'

/**
 * 影响面面板：一次操作到底会碰到多少个孩子。
 *
 * 这些数字是破坏性确认弹窗的正文，不是装饰。retire 的安全边界（当日在播的完全不动、
 * 只收走跨天陈旧的）只有把两类设备数并排摆出来才可被验证——否则「下架很安全」
 * 只是一句口号，管理员无法在点下去之前自己核对。
 *
 * 口径全部来自服务端 GET impact，前端不做任何加减：
 * 「今日」按服务器本地时区的自然日算，与引擎的 dateKey() 同源。
 */
interface Props {
  impact: EpisodeImpact
  /** retire：强调「今日在播不受影响、跨天挂起会被收走」；publish：强调版本 pinning */
  variant?: 'retire' | 'publish' | 'info'
}

function Stat({
  title,
  tip,
  value,
  danger,
}: {
  title: string
  tip: string
  value: number
  danger?: boolean
}) {
  return (
    <Statistic
      title={
        <>
          {title}
          <InfoTip title={tip} />
        </>
      }
      value={value}
      styles={{
        content:
          danger && value > 0
            ? { color: '#cf1322', fontSize: 22 }
            : { fontSize: 22 },
      }}
    />
  )
}

export default function ImpactPanel({ impact, variant = 'info' }: Props) {
  const stale = impact.devicesStaleCrossDay ?? 0
  const pinned = impact.devicesPinnedToOlderVersions ?? 0

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Stat
            title="今日在播"
            value={impact.devicesPlayingToday ?? 0}
            tip="今天已分配到这一集、状态仍是 in_progress 的设备。它们锁在自己的版本快照上，retire 不会打断，会把这一集玩完。"
          />
        </Col>
        <Col span={8}>
          <Stat
            title="跨天挂起"
            value={stale}
            danger={variant === 'retire'}
            tip="assignedDate 早于今天、状态仍是 in_progress 的设备。retire 会把它们收成 abandoned，这些设备下次开机会分到新的一集。"
          />
        </Col>
        <Col span={8}>
          <Stat
            title="锁在旧版本"
            value={pinned}
            tip="仍被 pin 在旧发布快照上的在播设备数。大于 0 说明历史上确实出现过并行版本，这是设计如此：正在玩的孩子不会因为你发了新版就被中途换掉。"
          />
        </Col>
        <Col span={8}>
          <Stat
            title="历史触达设备"
            value={impact.totalDevicesEverStarted ?? 0}
            tip="曾经开始过这一集的设备总数（含已完成、已放弃）。这是「为什么已发布的故事不能删除」的直接依据：家长端报告、审计与进度行都还指着它。"
          />
        </Col>
        <Col span={8}>
          <Stat
            title="已发布版本数"
            value={impact.publishedVersionCount ?? 0}
            tip="published + superseded 的快照总数。历史只增不改，回滚是把旧快照复制成新版本，不是把旧的改回来。"
          />
        </Col>
      </Row>

      {variant === 'retire' && (
        <Alert
          style={{ marginTop: 16 }}
          type={stale > 0 ? 'warning' : 'info'}
          showIcon
          message={
            stale > 0
              ? `下架会收走 ${stale} 条跨天挂起的进度`
              : '当前没有跨天挂起的进度，下架不会收走任何孩子的进度'
          }
          description={
            <Typography.Text type="secondary">
              今天在玩的 {impact.devicesPlayingToday ?? 0}{' '}
              台设备不受影响，会把手上这一集玩完。被收走的进度是永久终态
              （abandoned），恢复上架也不会把它们拉回来——那些孩子已经换到别的集了，
              硬拉回去等于让他们重听一遍开场。
            </Typography.Text>
          }
        />
      )}

      {variant === 'publish' && (
        <Alert
          style={{ marginTop: 16 }}
          type="info"
          showIcon
          message="发布会生成一个新快照，不会改动任何历史版本"
          description={
            <Typography.Text type="secondary">
              已经在玩的孩子锁在自己开始时的版本上，不会被中途换掉；只有**下一次**
              开始这一集的设备才用新版本。当前有 {impact.devicesPlayingToday ?? 0}{' '}
              台设备今天在播、{pinned} 台仍锁在旧快照上。
            </Typography.Text>
          }
        />
      )}
    </div>
  )
}
