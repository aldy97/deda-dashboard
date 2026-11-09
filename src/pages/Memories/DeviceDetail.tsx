import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  Row,
  Space,
  Spin,
  Tag,
  Timeline,
  Typography,
} from 'antd'
import { Link, useNavigate, useParams } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  fetchCurrentMemories,
  fetchMemoryHistory,
} from '../../api/analytics'
import type {
  CurrentMemoriesResponse,
  MemoryHistoryResponse,
} from '../../types/analytics'
import {
  CHANGE_TYPE_META,
  MEMORY_KEYS,
  memoryKeyLabel,
  STATUS_META,
} from './memoryMeta'

const fmtTime = (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss')

/**
 * 单设备记忆详情：5 槽位当前有效记忆卡片 + 所选槽位的版本时间线。
 * 时间线节点可跳消息明细的同轮问答（sourceTurnId）。
 */
export default function MemoryDetail() {
  const { deviceId = '' } = useParams<{ deviceId: string }>()
  const navigate = useNavigate()
  const [current, setCurrent] = useState<CurrentMemoriesResponse | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [history, setHistory] = useState<MemoryHistoryResponse | null>(null)
  const [loadingCurrent, setLoadingCurrent] = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoadingCurrent(true)
    setError(null)
    fetchCurrentMemories(deviceId)
      .then((data) => {
        if (cancelled) return
        setCurrent(data)
        // 默认选中：按 5 槽位白名单顺序找第一个有记忆的槽位；
        // 都没有则选中第一个槽位（历史可能全是撤回墓碑）。
        // 不能直接取 memories[0]——后端返回顺序未约定，行为不稳定
        const keys = new Set(data.memories.map((m) => m.key))
        setSelectedKey(MEMORY_KEYS.find((k) => keys.has(k)) ?? MEMORY_KEYS[0])
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '加载失败')
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingCurrent(false)
      })
    return () => {
      cancelled = true
    }
  }, [deviceId])

  const loadHistory = useCallback(
    async (key: string) => {
      setLoadingHistory(true)
      try {
        setHistory(await fetchMemoryHistory(deviceId, key))
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败')
      } finally {
        setLoadingHistory(false)
      }
    },
    [deviceId],
  )

  useEffect(() => {
    if (selectedKey) void loadHistory(selectedKey)
  }, [loadHistory, selectedKey])

  const activeByKey = new Map(
    (current?.memories ?? []).map((m) => [m.key, m]),
  )

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button
          type="link"
          style={{ padding: 0, marginBottom: 8 }}
          onClick={() => navigate('/memories')}
        >
          ← 返回记忆档案
        </Button>
        <Typography.Title level={4} style={{ margin: 0 }}>
          设备 {deviceId} 的记忆
        </Typography.Title>
        <Typography.Text type="secondary">
          点槽位卡片查看该记忆的版本变迁；时间为 Asia/Shanghai
        </Typography.Text>
      </div>

      {error && (
        <Alert
          type="error"
          showIcon
          message="记忆数据加载失败"
          description={error}
          style={{ marginBottom: 16 }}
        />
      )}

      <Spin spinning={loadingCurrent}>
        <Row gutter={[12, 12]}>
          {MEMORY_KEYS.map((key) => {
            const memory = activeByKey.get(key)
            const selected = selectedKey === key
            return (
              <Col key={key} xs={12} md={8} lg={4} flex="1 1 0">
                <Card
                  size="small"
                  hoverable
                  onClick={() => setSelectedKey(key)}
                  style={{
                    height: '100%',
                    borderColor: selected ? '#1677ff' : undefined,
                    borderWidth: selected ? 2 : undefined,
                  }}
                >
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {memoryKeyLabel(key)}
                  </Typography.Text>
                  <div style={{ margin: '8px 0', minHeight: 28 }}>
                    {memory ? (
                      <Typography.Text strong style={{ fontSize: 16 }}>
                        {memory.valueText}
                      </Typography.Text>
                    ) : (
                      <Typography.Text type="secondary" disabled>
                        暂无记忆
                      </Typography.Text>
                    )}
                  </div>
                  {memory ? (
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      v{memory.version} · 置信度{' '}
                      {(memory.confidence * 100).toFixed(0)}% · 被引用{' '}
                      {memory.injectionCount} 次
                      <br />
                      最近确认 {fmtTime(memory.lastConfirmedAt)}
                    </Typography.Text>
                  ) : (
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      —
                    </Typography.Text>
                  )}
                </Card>
              </Col>
            )
          })}
        </Row>
      </Spin>

      <Card
        style={{ marginTop: 16 }}
        title={selectedKey ? `版本时间线：${memoryKeyLabel(selectedKey)}` : '版本时间线'}
      >
        <Spin spinning={loadingHistory}>
          {history && history.versions.length === 0 && (
            <Typography.Text type="secondary">
              该槽位没有任何历史版本
            </Typography.Text>
          )}
          {history && history.versions.length > 0 && (
            <Timeline
              style={{ marginTop: 8 }}
              items={history.versions.map((v) => {
                const changeMeta = CHANGE_TYPE_META[v.changeType] ?? {
                  label: v.changeType,
                  color: 'default',
                }
                const statusMeta = STATUS_META[v.status] ?? {
                  label: v.status,
                  color: 'default',
                }
                return {
                  color: changeMeta.color,
                  children: (
                    <div>
                      <Space wrap size={[8, 4]}>
                        <Tag>v{v.version}</Tag>
                        <Tag color={changeMeta.color}>{changeMeta.label}</Tag>
                        <Tag color={statusMeta.color}>{statusMeta.label}</Tag>
                        {v.valueText !== null ? (
                          <Typography.Text
                            strong={v.status === 'active'}
                            delete={v.status !== 'active'}
                          >
                            {v.valueText}
                          </Typography.Text>
                        ) : (
                          <Typography.Text type="secondary">
                            （已撤回）
                          </Typography.Text>
                        )}
                      </Space>
                      <div>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          生效区间 {fmtTime(v.validFrom)} →{' '}
                          {v.validTo ? fmtTime(v.validTo) : '至今'} · 置信度{' '}
                          {(v.confidence * 100).toFixed(0)}% · 来源轮次{' '}
                          <Link to={`/messages?turnId=${v.sourceTurnId}`}>
                            {v.sourceTurnId.slice(0, 8)}…
                          </Link>
                        </Typography.Text>
                      </div>
                    </div>
                  ),
                }
              })}
            />
          )}
        </Spin>
      </Card>
    </div>
  )
}
