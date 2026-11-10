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
import { fetchMessageDetail, fetchMessages } from '../../api/analytics'
import {
  isAssistantRawPayload,
  type MessageDetailResponse,
  type MessageListItem,
} from '../../types/analytics'
import LlmTurnChain from './LlmTurnChain'

/** 与 deda-wechat-app learning-data.ts 的 MODE_LABELS 完全一致（唯一映射来源，勿自行增改） */
const MODE_LABELS: Record<string, string> = {
  free_chat: '自由对话',
  free_chat_casual: '自由闲聊',
  free_chat_roleplay: '角色扮演',
  free_chat_qa: '百科问答',
  english_chat: '英语对话',
  english_story: '英语故事',
  idiom_story: '成语故事',
  adventure_story: '冒险故事',
  free_story: '自由故事',
  daily_adventure: '每日冒险',
  adventure: '每日冒险',
  story: '故事',
  sleep: '哄睡故事',
  sleep_story: '哄睡故事',
  bedtime: '哄睡故事',
  music: '音乐',
  device_control: '设备控制',
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
  // 同轮孩子 ASR 原文：排查「AI 答非所问」时先看识别成了什么
  const [turnUserMessages, setTurnUserMessages] = useState<
    MessageListItem[] | null
  >(null)

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
    setTurnUserMessages(null)
    if (message.turnId) {
      fetchMessages({
        turnId: message.turnId,
        sort: 'spokeAt_asc',
        pageSize: 10,
      })
        .then((resp) =>
          setTurnUserMessages(resp.items.filter((m) => m.role === 'user')),
        )
        .catch(() => setTurnUserMessages(null))
    }
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
              // 厂商对话 ID 暂不需要，需要时取消注释
              // {
              //   key: 'conversationId',
              //   label: '厂商对话 ID',
              //   children: row.conversationId ?? '—',
              // },
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
              // CEFR 等级暂不需要，需要时取消注释
              // {
              //   key: 'cefrLevel',
              //   label: 'CEFR 等级',
              //   children: row.cefrLevel ?? '—',
              // },
              {
                key: 'device',
                label: '设备 ID',
                children: (
                  <Typography.Text
                    copyable={{ text: row.device.deviceId, tooltips: ['复制设备 ID', '已复制'] }}
                  >
                    {row.device.deviceId}
                  </Typography.Text>
                ),
              },
              {
                key: 'character',
                label: '产品',
                children: row.device.characterKey,
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
            孩子说了什么（ASR 原文）
          </Typography.Title>
          {turnUserMessages && turnUserMessages.length > 0 ? (
            turnUserMessages.map((m) => (
              <div key={m.id} style={{ marginBottom: 8 }}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {formatTime(m.spokeAt)}
                </Typography.Text>
                <Typography.Paragraph
                  style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}
                >
                  {m.content}
                </Typography.Paragraph>
              </div>
            ))
          ) : (
            <Typography.Text type="secondary">
              {turnUserMessages === null ? '加载中…' : '本轮无孩子发言记录'}
            </Typography.Text>
          )}
          {row.role === 'assistant' && (
            <>
              <Typography.Title level={5} style={{ marginTop: 16 }}>
                孩子实际听到了什么
              </Typography.Title>
              {detail && isAssistantRawPayload(detail.rawPayload) ? (
                <div
                  style={{
                    border: `1px solid ${row.status === 'failed' ? '#ffa39e' : '#d9d9d9'}`,
                    background: row.status === 'failed' ? '#fff1f0' : '#fafafa',
                    borderRadius: 6,
                    padding: 12,
                  }}
                >
                  {detail.rawPayload.filler ? (
                    <div style={{ marginBottom: 8 }}>
                      <Tag color="geekblue">filler · 已播</Tag>
                      <Typography.Text>
                        {detail.rawPayload.filler}
                      </Typography.Text>
                    </div>
                  ) : null}
                  <div>
                    {row.status === 'failed' ? (
                      <Tag color="error">主回答 · 失败/断流</Tag>
                    ) : (
                      <Tag color="success">主回答 · 已播</Tag>
                    )}
                    {detail.rawPayload.answer ? (
                      <Typography.Text>
                        {detail.rawPayload.answer}
                      </Typography.Text>
                    ) : (
                      <Typography.Text type="warning">
                        （主模型无输出）
                      </Typography.Text>
                    )}
                  </div>
                </div>
              ) : (
                <Typography.Paragraph
                  style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}
                >
                  {row.content}
                  <Typography.Text
                    type="secondary"
                    style={{ display: 'block', fontSize: 12, marginTop: 4 }}
                  >
                    （该消息无 filler/answer 边界结构，以上为落库全文）
                  </Typography.Text>
                </Typography.Paragraph>
              )}
            </>
          )}
          <Typography.Title level={5} style={{ marginTop: 16 }}>
            LLM 调用链路
          </Typography.Title>
          <LlmTurnChain turnId={row.turnId} />
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
