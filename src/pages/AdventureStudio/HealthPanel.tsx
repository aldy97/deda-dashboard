import { useState } from 'react'
import {
  Alert,
  Card,
  Col,
  Descriptions,
  Empty,
  Row,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import InfoTip from '../../components/InfoTip'
import { useAdventureRecovery } from '../../api/queries'
import type {
  AlertRecord,
  EngineFailureRecord,
  RecoveryHealthSnapshot,
  RepairRecord,
  SweepReport,
} from '../../types/adventureAdmin'
import RecoveryActions from './RecoveryActions'
import { fmtDateTime, fmtDuration, recoveryCodeMeta } from './labels'

/**
 * 自愈与兜底健康面板（L3 熔断器 + L4 定时巡检 + 引擎失败记录）。
 *
 * 面板存在的意义是让「孩子那一侧到底有没有兜住」变成一个可被看见的数字，
 * 而不是等家长投诉。三块信息各自回答一个问题：
 * - 熔断器：兜底本身是不是也在失败？（10 分钟内 5 次失败 → tripped，只告警不改内容）
 * - 巡检：有没有「连孩子开口那一刻都走不通」的静默病态？修了几条、只告警几条？
 * - 引擎失败：最近哪台设备、在哪个阶段掉了链子，有没有成功平移到下一集？
 *
 * 熔断器是**授权回滚**：它只标记与告警，绝不自动改内容、绝不自动切版本。
 * 解除降级（reset）是人的动作，必须写理由并留审计——所以按钮不裸放在面板上，
 * 走统一的理由弹窗（见 RecoveryActions，挂在这张卡片的末尾）。
 *
 * degraded=true 时熔断器**故意不工作**：Redis 读不到计数就熔断，会把所有设备判成故障，
 * 那比漏报危险得多。面板必须把这个「我知道我看不见」的状态明确摆出来。
 */

const PHASE_LABELS: Record<EngineFailureRecord['phase'], string> = {
  start_today: '开始今日冒险',
  handle_reply: '处理孩子的回答',
  check_timeout: '等待超时检查',
}

function BreakerCard({ snapshot }: { snapshot: RecoveryHealthSnapshot }) {
  const { breaker, config } = snapshot
  const alert = breaker.tripped ? (
    <Alert
      type="error"
      showIcon
      message={`恢复熔断器已跳闸（${breaker.failureCount} 次兜底失败 / 阈值 ${breaker.threshold}）`}
      description="兜底链路本身在连续失败。它只标记与告警，不会自动改任何内容、不会自动切版本。请先查上游（LLM / RTC / 数据库），确认恢复后手动解除降级——这一步会写理由并留审计。"
    />
  ) : breaker.degraded ? (
    <Alert
      type="warning"
      showIcon
      message="观测降级：Redis 不可用，熔断器当前不工作"
      description="读不到失败计数时故意不熔断——宁可漏报，也不能因为观测失真就把所有设备判成故障。所以此刻「未熔断」不代表链路健康，请直接看下方的巡检与引擎失败记录。"
    />
  ) : !breaker.enabled ? (
    <Alert
      type="warning"
      showIcon
      message="恢复熔断器已被关闭"
      description="ADVENTURE_BREAKER 相关开关处于关闭状态，失败不会累计也不会跳闸。"
    />
  ) : !config.enabled ? (
    <Alert
      type="warning"
      showIcon
      message="自愈巡检已被 kill switch 关闭"
      description="ADVENTURE_RECOVERY_ENABLED=false 时，连手动触发巡检也会被拒绝（能被 API 绕过的开关不是开关），静默病态不会被自动修成可自愈状态。"
    />
  ) : (
    <Alert
      type="success"
      showIcon
      message="兜底链路正常，熔断器未跳闸"
    />
  )

  return (
    <Card title="恢复熔断器" style={{ marginBottom: 16 }}>
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        {alert}
        <Row gutter={[16, 16]}>
          <Col span={6}>
            <Statistic
              title={
                <>
                  窗口内失败次数
                  <InfoTip title="最近 windowMs 内兜底失败的累计次数，到阈值即跳闸。窗口是滑动的，旧失败会自然过期。" />
                </>
              }
              value={breaker.failureCount}
              suffix={`/ ${breaker.threshold}`}
              styles={{
                content: {
                  fontSize: 22,
                  color: breaker.tripped ? '#cf1322' : undefined,
                },
              }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="统计窗口"
              value={Math.round(breaker.windowMs / 1000)}
              suffix="秒"
              styles={{ content: { fontSize: 22 } }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="跳闸时间"
              value={breaker.trippedAt ? fmtDateTime(breaker.trippedAt) : '—'}
              styles={{ content: { fontSize: 16 } }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="巡检间隔"
              value={Math.round(config.sweepIntervalMs / 1000)}
              suffix="秒"
              styles={{ content: { fontSize: 22 } }}
            />
          </Col>
        </Row>

        {breaker.recentReasons.length > 0 && (
          <div>
            <Typography.Text strong style={{ fontSize: 13 }}>
              最近的失败原因
            </Typography.Text>
            <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
              {breaker.recentReasons.map((reason, index) => (
                <li key={`${reason}-${index}`}>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {reason}
                  </Typography.Text>
                </li>
              ))}
            </ul>
          </div>
        )}

        {breaker.error && (
          <Alert
            type="warning"
            showIcon
            message="熔断器自身读写异常"
            description={breaker.error}
          />
        )}

        <Descriptions
          size="small"
          column={3}
          bordered
          title="生效配置"
          items={[
            { key: 'enabled', label: '巡检开关', children: config.enabled ? '开' : '关' },
            {
              key: 'staleAwaitMs',
              label: '挂起判定阈值',
              children: `${Math.round(config.staleAwaitMs / 1000)} 秒`,
            },
            {
              key: 'staleAwaitAction',
              label: '挂起处置',
              children: config.staleAwaitAction,
            },
            {
              key: 'breakerWindowMs',
              label: '熔断窗口',
              children: `${Math.round(config.breakerWindowMs / 1000)} 秒`,
            },
            {
              key: 'breakerThreshold',
              label: '熔断阈值',
              children: `${config.breakerThreshold} 次`,
            },
            {
              key: 'breakerTrippedTtlSeconds',
              label: '跳闸标记存活',
              children: `${config.breakerTrippedTtlSeconds} 秒`,
            },
          ]}
        />

        <RecoveryActions snapshot={snapshot} />
      </Space>
    </Card>
  )
}

function RepairList({ repairs }: { repairs: RepairRecord[] }) {
  if (repairs.length === 0) {
    return <Typography.Text type="secondary">本次没有修任何数据</Typography.Text>
  }
  return (
    <Space orientation="vertical" size={4} style={{ width: '100%' }}>
      {repairs.map((repair, index) => (
        <Typography.Text key={`${repair.deviceId}-${index}`} style={{ fontSize: 12 }}>
          <Tag color="purple">{recoveryCodeMeta(repair.code).label}</Tag>
          <Typography.Text code>{repair.deviceId}</Typography.Text>{' '}
          {repair.target} {repair.from} → {repair.to}
          <Typography.Text type="secondary"> · {repair.detail}</Typography.Text>
        </Typography.Text>
      ))}
    </Space>
  )
}

function AlertList({ alerts }: { alerts: AlertRecord[] }) {
  if (alerts.length === 0) {
    return <Typography.Text type="secondary">本次没有告警</Typography.Text>
  }
  return (
    <Space orientation="vertical" size={4} style={{ width: '100%' }}>
      {alerts.map((alert, index) => (
        <Typography.Text key={`${alert.code}-${index}`} style={{ fontSize: 12 }}>
          <Tag color="orange">{recoveryCodeMeta(alert.code).label}</Tag>
          <Typography.Text type="secondary">
            {recoveryCodeMeta(alert.code).effect}
          </Typography.Text>
          {alert.deviceId && (
            <>
              {' '}
              <Typography.Text code>{alert.deviceId}</Typography.Text>
            </>
          )}{' '}
          · {alert.detail}
        </Typography.Text>
      ))}
    </Space>
  )
}

const SWEEP_COLUMNS: ColumnsType<SweepReport> = [
  {
    title: '开始时间',
    key: 'startedAt',
    width: 170,
    render: (_, row) => fmtDateTime(row.startedAt),
  },
  {
    title: '耗时',
    key: 'durationMs',
    width: 90,
    render: (_, row) => fmtDuration(row.durationMs),
  },
  {
    title: '结果',
    key: 'skipped',
    width: 150,
    render: (_, row) =>
      row.skipped ? (
        <Tag color="orange">已跳过：{row.reason ?? '未给原因'}</Tag>
      ) : (
        <Tag color="green">已执行</Tag>
      ),
  },
  {
    title: '扫描量',
    key: 'scanned',
    width: 200,
    render: (_, row) =>
      `进度 ${row.scanned?.progresses ?? 0} · 当日 ${row.scanned?.dailyRecords ?? 0} · 故事集 ${row.scanned?.episodes ?? 0}`,
  },
  {
    title: (
      <>
        修复
        <InfoTip title="被改成 exited / abandoned / failed_over 这类「下次孩子开口就能自然恢复」的状态。巡检绝不改写内容，也绝不调用平移到下一集的逻辑——那会在孩子不在场时烧掉当日额度。" />
      </>
    ),
    key: 'repairs',
    width: 80,
    render: (_, row) =>
      row.repairs.length > 0 ? (
        <Tag color="purple">{row.repairs.length}</Tag>
      ) : (
        <Typography.Text type="secondary">0</Typography.Text>
      ),
  },
  {
    title: (
      <>
        告警
        <InfoTip title="只报不改的病态，例如版本快照缺行、段落表与快照漂移。改这些等于在孩子中途换版本，风险大于收益。" />
      </>
    ),
    key: 'alerts',
    width: 80,
    render: (_, row) =>
      row.alerts.length > 0 ? (
        <Tag color="orange">{row.alerts.length}</Tag>
      ) : (
        <Typography.Text type="secondary">0</Typography.Text>
      ),
  },
  {
    title: '错误',
    key: 'errors',
    width: 80,
    render: (_, row) =>
      row.errors.length > 0 ? (
        <Tag color="red">{row.errors.length}</Tag>
      ) : (
        <Typography.Text type="secondary">0</Typography.Text>
      ),
  },
]

const FAILURE_COLUMNS: ColumnsType<EngineFailureRecord> = [
  {
    title: '时间',
    key: 'at',
    width: 170,
    render: (_, row) => fmtDateTime(row.at),
  },
  {
    title: '设备',
    dataIndex: 'deviceId',
    key: 'deviceId',
    width: 200,
    render: (value: string) => <Typography.Text code>{value}</Typography.Text>,
  },
  {
    title: '阶段',
    key: 'phase',
    width: 150,
    render: (_, row) => PHASE_LABELS[row.phase] ?? row.phase,
  },
  {
    title: '原因',
    dataIndex: 'reason',
    key: 'reason',
  },
  {
    title: (
      <>
        是否已平移
        <InfoTip title="recovered=true 表示已经自动为孩子换到下一集；false 表示连换集也失败了，上层继续降级到最后一道兜底话术——孩子至少还能听到一句话，绝不沉默。" />
      </>
    ),
    key: 'recovered',
    width: 120,
    render: (_, row) =>
      row.recovered ? (
        <Tag color="green">已换下一集</Tag>
      ) : (
        <Tag color="red">降级到兜底话术</Tag>
      ),
  },
]

export default function HealthPanel() {
  const recoveryQuery = useAdventureRecovery()
  const snapshot = recoveryQuery.data ?? null
  const [sweepPage, setSweepPage] = useState(1)

  return (
    <Spin spinning={recoveryQuery.isLoading}>
      {recoveryQuery.error && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="自愈健康快照加载失败"
          description={(recoveryQuery.error as Error).message}
        />
      )}

      {snapshot ? (
        <>
          <BreakerCard snapshot={snapshot} />

          <Card
            title="定时巡检（最近 20 份，新在前）"
            style={{ marginBottom: 16 }}
          >
            {snapshot.sweeps.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="还没有巡检记录（服务刚启动，或 kill switch 关着）"
              />
            ) : (
              <Table
                columns={SWEEP_COLUMNS}
                dataSource={snapshot.sweeps}
                rowKey={(row) => `${row.startedAt}-${row.durationMs}`}
                size="small"
                scroll={{ x: 900 }}
                pagination={{
                  current: sweepPage,
                  pageSize: 10,
                  onChange: setSweepPage,
                  showTotal: (total) => `共 ${total} 份`,
                }}
                expandable={{
                  rowExpandable: (row) =>
                    row.repairs.length > 0 ||
                    row.alerts.length > 0 ||
                    row.errors.length > 0,
                  expandedRowRender: (row) => (
                    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                      <div>
                        <Typography.Text strong style={{ fontSize: 12 }}>
                          修复明细（{row.repairs.length}）
                        </Typography.Text>
                        <RepairList repairs={row.repairs} />
                      </div>
                      <div>
                        <Typography.Text strong style={{ fontSize: 12 }}>
                          告警明细（{row.alerts.length}）
                        </Typography.Text>
                        <AlertList alerts={row.alerts} />
                      </div>
                      {row.errors.length > 0 && (
                        <Alert
                          type="error"
                          showIcon
                          message={`巡检自身出错 ${row.errors.length} 条`}
                          description={
                            <ul style={{ margin: 0, paddingLeft: 20 }}>
                              {row.errors.map((item, index) => (
                                <li key={index}>{item}</li>
                              ))}
                            </ul>
                          }
                        />
                      )}
                    </Space>
                  ),
                }}
              />
            )}
          </Card>

          <Card title="引擎失败记录（最近 50 条，新在前）">
            {snapshot.engineFailures.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="最近没有引擎失败——这是期望中的常态"
              />
            ) : (
              <Table
                columns={FAILURE_COLUMNS}
                dataSource={snapshot.engineFailures}
                rowKey={(row) => `${row.at}-${row.deviceId}`}
                size="small"
                scroll={{ x: 900 }}
                pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 条` }}
              />
            )}
          </Card>
        </>
      ) : (
        !recoveryQuery.isLoading && (
          <Empty description="暂无自愈健康数据" />
        )
      )}
    </Spin>
  )
}
