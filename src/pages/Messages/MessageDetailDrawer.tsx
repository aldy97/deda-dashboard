import { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Spin,
  Tag,
  Typography,
} from 'antd'
import dayjs from 'dayjs'
import { fetchMessageDetail } from '../../api/analytics'
import type {
  MessageDetailResponse,
  MessageListItem,
} from '../../types/analytics'

/** 与 MINI_PROGRAM_API.md 已知模式映射一致 */
const MODE_LABELS: Record<string, string> = {
  free_chat: '自由对话',
  english_chat: '英语对话',
  adventure_story: '每日冒险',
  english_story: '英语故事',
  idiom_story: '成语故事',
  free_story: '自由故事',
  sleep_story: '哄睡故事',
  unknown: '其他',
}

export function modeLabel(
  mode: string | null,
  conversationModeKey: string | null,
): string {
  const key = conversationModeKey ?? mode
  if (!key) return '—'
  return MODE_LABELS[key] ?? key
}

export function roleTag(role: string) {
  return role === 'user' ? (
    <Tag color="blue">孩子</Tag>
  ) : role === 'assistant' ? (
    <Tag color="green">AI</Tag>
  ) : (
    <Tag>{role}</Tag>
  )
}

export function statusTag(status: string) {
  return status === 'failed' ? (
    <Tag color="error">失败</Tag>
  ) : (
    <Tag color="success">{status}</Tag>
  )
}

const formatTime = (iso: string) => dayjs(iso).format('YYYY-MM-DD HH:mm:ss')

/**
 * 消息详情抽屉：整行字段 + rawPayload 原样 JSON（对标 Prisma Studio 行展开）。
 * 「查看同一轮问答」把 turnId 回填给列表作精确过滤。
 */
export default function MessageDetailDrawer({
  message,
  onClose,
  onViewTurn,
}: {
  /** 列表行数据；打开后内部再拉详情补 rawPayload */
  message: MessageListItem | null
  onClose: () => void
  onViewTurn: (turnId: string) => void
}) {
  const [detail, setDetail] = useState<MessageDetailResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!message) return
    setDetail(null)
    setError(null)
    setLoading(true)
    fetchMessageDetail(message.id)
      .then(setDetail)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : '加载失败'),
      )
      .finally(() => setLoading(false))
  }, [message])

  const row = detail ?? message

  return (
    <Drawer
      title="消息详情"
      width={640}
      open={message !== null}
      onClose={onClose}
    >
      {row && (
        <Spin spinning={loading}>
          {error && (
            <Alert
              type="error"
              showIcon
              message="详情加载失败（仅展示列表字段）"
              description={error}
              style={{ marginBottom: 12 }}
            />
          )}
          <Descriptions
            column={1}
            size="small"
            bordered
            items={[
              { key: 'id', label: 'ID', children: row.id },
              {
                key: 'turnId',
                label: '轮次 ID（turnId）',
                children: (
                  <span>
                    {row.turnId}{' '}
                    <Button
                      size="small"
                      type="link"
                      onClick={() => onViewTurn(row.turnId)}
                    >
                      查看同一轮问答
                    </Button>
                  </span>
                ),
              },
              {
                key: 'conversationId',
                label: '厂商对话 ID',
                children: row.conversationId ?? '—',
              },
              { key: 'role', label: '角色', children: roleTag(row.role) },
              {
                key: 'status',
                label: '状态',
                children: statusTag(row.status),
              },
              {
                key: 'mode',
                label: '模式',
                children: modeLabel(row.mode, row.conversationModeKey),
              },
              {
                key: 'cefrLevel',
                label: 'CEFR 等级',
                children: row.cefrLevel ?? '—',
              },
              {
                key: 'device',
                label: '设备',
                children: `${row.device.deviceCode ?? row.device.deviceId}（${row.device.characterKey}）`,
              },
              {
                key: 'spokeAt',
                label: '消息时间',
                children: formatTime(row.spokeAt),
              },
              {
                key: 'createdAt',
                label: '入库时间',
                children: formatTime(row.createdAt),
              },
              {
                key: 'content',
                label: '内容',
                children: (
                  <Typography.Paragraph
                    style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}
                  >
                    {row.content}
                  </Typography.Paragraph>
                ),
              },
            ]}
          />
          <Typography.Title level={5} style={{ marginTop: 16 }}>
            rawPayload
          </Typography.Title>
          {detail ? (
            <pre
              style={{
                background: '#f5f5f5',
                padding: 12,
                borderRadius: 6,
                maxHeight: 320,
                overflow: 'auto',
                fontSize: 12,
              }}
            >
              {detail.rawPayload == null
                ? '（无）'
                : JSON.stringify(detail.rawPayload, null, 2)}
            </pre>
          ) : (
            <Typography.Text type="secondary">
              {loading ? '加载中…' : '加载失败或无权限查看'}
            </Typography.Text>
          )}
        </Spin>
      )}
    </Drawer>
  )
}
