import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import { useMessageDetail, useMessages } from '../../api/queries'
import {
  isAssistantRawPayload,
  type MessageListItem,
} from '../../types/analytics'
import LlmTurnChain from './LlmTurnChain'
import {
  modeLabel,
  roleTag,
  statusTag,
} from '../../components/message/labels'

const formatTime = (iso: string) => dayjs(iso).format('YYYY-MM-DD HH:mm:ss')

/**
 * 消息详情抽屉：整行字段 + rawPayload 原样 JSON（对标 Prisma Studio 行展开）。
 * 「查看同一轮问答」把 turnId 回填给列表作精确过滤。
 *
 * 两种打开方式：列表点行时把整行传进来（先渲染列表字段，详情回来再补 rawPayload）；
 * 只凭 URL（?messageId=）打开时只有 id，字段全部等详情接口回来。后者让抽屉可分享、
 * 可刷新还原，也让别的页面（用户详情页的近期消息）能把人直接带到某一条消息上。
 */
export default function MessageDetailDrawer({
  message,
  messageId,
  onClose,
  onViewTurn,
}: {
  /** 列表行数据（可空）；有则先渲染，再拉详情补 rawPayload */
  message?: MessageListItem | null
  /** 仅凭 URL 打开时的消息 id */
  messageId?: string | null
  onClose: () => void
  onViewTurn: (turnId: string) => void
}) {
  const id = message?.id ?? messageId ?? null

  // 抽屉打开即拉详情（补 rawPayload）；key 含消息 id，切行自动作废旧请求
  const detailQuery = useMessageDetail(id)
  const detail = detailQuery.data ?? null
  const loading = detailQuery.isLoading
  const error = detailQuery.error
    ? detailQuery.error instanceof Error
      ? detailQuery.error.message
      : '加载失败'
    : null

  const row = detail ?? message ?? null

  // 同轮孩子 ASR 原文：排查「AI 答非所问」时先看识别成了什么
  const turnId = row?.turnId ?? null
  const turnQuery = useMessages(
    {
      turnId: turnId ?? '',
      sort: 'spokeAt_asc',
      pageSize: 10,
    },
    turnId !== null,
  )
  const turnUserMessages = turnQuery.data
    ? turnQuery.data.items.filter((m) => m.role === 'user')
    : null

  return (
    <Drawer
      title="消息详情"
      width={640}
      open={id !== null}
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
            // 值列的长 UUID 会把标签列压到一字一行，nowrap 让标签列按整段文字取宽
            styles={{ label: { whiteSpace: 'nowrap' } }}
            items={[
              {
                key: 'id',
                label: 'ID',
                children: (
                  <Typography.Text
                    copyable={{ text: row.id, tooltips: ['复制 ID', '已复制'] }}
                    style={{ fontFamily: 'monospace' }}
                  >
                    {row.id}
                  </Typography.Text>
                ),
              },
              {
                key: 'turnId',
                label: '轮次 ID',
                children: (
                  <Space size={4} wrap>
                    <Typography.Text
                      copyable={{
                        text: row.turnId,
                        tooltips: ['复制轮次 ID', '已复制'],
                      }}
                      style={{ fontFamily: 'monospace' }}
                    >
                      {row.turnId}
                    </Typography.Text>
                    <Button
                      size="small"
                      type="link"
                      onClick={() => onViewTurn(row.turnId)}
                    >
                      查看同一轮问答
                    </Button>
                  </Space>
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
                children: modeLabel(row.mode),
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
                  <Space size={4}>
                    <Link
                      to={`/users/${encodeURIComponent(row.device.deviceId)}`}
                      style={{ fontFamily: 'monospace' }}
                    >
                      {row.device.deviceId}
                    </Link>
                    <Typography.Text
                      copyable={{ text: row.device.deviceId, tooltips: ['复制设备 ID', '已复制'] }}
                    />
                  </Space>
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
