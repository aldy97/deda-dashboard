import { useState } from 'react'
import {
  Card,
  Descriptions,
  Empty,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import { Link, useParams } from 'react-router-dom'
import dayjs from 'dayjs'
import InfoTip from '../../components/InfoTip'
import {
  useCurrentMemories,
  useMessages,
  useParentReports,
  useUserFeedbacks,
} from '../../api/queries'
import { memoryKeyLabel } from '../Memories/memoryMeta'
import { statusTag } from '../Messages/MessageDetailDrawer'
import type { ParentReportItem } from '../../types/analytics'

const fmtTime = (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm')

const REPORT_STATUS_META: Record<string, { label: string; color: string }> = {
  completed: { label: '已生成', color: 'success' },
  pending: { label: '待生成', color: 'default' },
  generating: { label: '生成中', color: 'processing' },
  failed: { label: '生成失败', color: 'error' },
}

/** 日报长文本单元格：省略 + 可展开全文 */
function EllipsisText({ text }: { text: string | null }) {
  if (!text) return <Typography.Text type="secondary">—</Typography.Text>
  return (
    <Typography.Paragraph
      ellipsis={{ rows: 2, expandable: true, symbol: '展开' }}
      style={{ marginBottom: 0, maxWidth: 320 }}
    >
      {text}
    </Typography.Paragraph>
  )
}

/** 日报行内反馈标注：最新一票定颜色；多绑定账号分别评价时悬浮列全部 */
function ReportFeedbackTag({ feedbacks }: { feedbacks: ParentReportItem['feedbacks'] }) {
  if (feedbacks.length === 0) {
    return <Typography.Text type="secondary">—</Typography.Text>
  }
  const latest = [...feedbacks].sort((a, b) =>
    b.feedbackAt.localeCompare(a.feedbackAt),
  )[0]
  const tag = latest.isUseful ? (
    <Tag color="success">有用</Tag>
  ) : (
    <Tag color="error">没用</Tag>
  )
  if (feedbacks.length === 1) {
    const who = latest.user.nickname ?? latest.user.phone
    return who ? <Tooltip title={`${who} · ${fmtTime(latest.feedbackAt)}`}>{tag}</Tooltip> : tag
  }
  return (
    <Tooltip
      title={
        <div>
          {feedbacks.map((f, i) => (
            <div key={i}>
              {f.user.nickname ?? f.user.phone ?? '未知家长'}：
              {f.isUseful ? '有用' : '没用'}（{fmtTime(f.feedbackAt)}）
            </div>
          ))}
        </div>
      }
    >
      <Space size={4}>
        {tag}
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          ×{feedbacks.length}
        </Typography.Text>
      </Space>
    </Tooltip>
  )
}

/**
 * 单设备用户详情：以设备为锚点聚合该设备（及其绑定家庭）的全部可看数据——
 * 设备信息、记忆槽位、家长日报（反馈内联标注）、使用反馈、近期消息。
 * 入口：用户画像页搜索 / 记忆档案设备列表 / 日报反馈设备列 / 消息详情设备 ID。
 * 使用反馈口径：该设备全部绑定账号的反馈（Feedback 表只挂 userId，
 * 经绑定关系反查）；匿名反馈（userId 为空）无法归属设备，不在此展示。
 */
export default function UserDeviceDetail() {
  const { deviceId = '' } = useParams<{ deviceId: string }>()

  // 日报列表同时承担设备信息源（device 字段）与设备存在性判定（404）
  const [reportPage, setReportPage] = useState(1)
  const reportsQuery = useParentReports({ deviceId, page: reportPage, pageSize: 10 })
  const reports = reportsQuery.data ?? null

  const memoriesQuery = useCurrentMemories(deviceId)
  const memories = memoriesQuery.data ?? null

  const [userFbPage, setUserFbPage] = useState(1)
  const userFbQuery = useUserFeedbacks({ deviceId, page: userFbPage, pageSize: 10 })
  const userFb = userFbQuery.data ?? null

  const messagesQuery = useMessages({ deviceId, page: 1, pageSize: 10 })
  const messages = messagesQuery.data ?? null

  const notFound =
    (reportsQuery.error as { status?: number } | null)?.status === 404

  if (notFound) {
    return (
      <Card>
        <Empty
          description={`未找到设备「${deviceId}」，请检查设备 ID 是否正确`}
        >
          <Link to="/users">返回用户画像</Link>
        </Empty>
      </Card>
    )
  }

  const device = reports?.device ?? null

  return (
    <Spin spinning={reportsQuery.isLoading}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        {/* 设备信息头 */}
        <Card size="small">
          <Descriptions
            title={
              <Space>
                用户详情
                <InfoTip title="以设备为锚点聚合：该设备自己的消息/日报/记忆，加上该设备全部绑定账号的反馈。一台设备可被多个家长账号绑定（多孩/祖辈家庭）。" />
              </Space>
            }
            column={{ xs: 1, md: 2 }}
            size="small"
          >
            <Descriptions.Item label="设备 ID">
              <Typography.Text
                copyable={{ text: deviceId, tooltips: ['复制设备 ID', '已复制'] }}
                style={{ fontFamily: 'monospace' }}
              >
                {deviceId}
              </Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="产品">
              {device ? <Tag color="blue">{device.characterKey}</Tag> : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="记忆档案">
              <Link to={`/memories/${deviceId}`}>查看版本时间线 →</Link>
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {/* 记忆槽位 */}
        <Card
          size="small"
          title={
            <Space>
              记忆槽位
              <InfoTip title="当前生效的 5 槽位儿童记忆（status=active）。点击可跳到记忆档案页查看完整版本历史。" />
            </Space>
          }
        >
          {memories && memories.memories.length > 0 ? (
            <Space wrap>
              {memories.memories.map((m) => (
                <Link key={m.key} to={`/memories/${deviceId}?key=${m.key}`}>
                  <Tag color="purple" style={{ cursor: 'pointer' }}>
                    {memoryKeyLabel(m.key)}：{m.valueText}
                  </Tag>
                </Link>
              ))}
            </Space>
          ) : (
            <Typography.Text type="secondary">
              暂无生效记忆（孩子还在建立档案期）
            </Typography.Text>
          )}
        </Card>

        {/* 家长日报（反馈内联标注，融合原日报反馈 section） */}
        <Card
          size="small"
          title={
            <Space>
              家长日报
              <InfoTip title="每日为该设备生成的家长报告（表达/情绪/思维观察 + 建议）。生成失败的日期也会列出，便于排查。家长反馈直接标注在对应日报上（多个绑定账号分别评价时悬浮可看全部）。" />
            </Space>
          }
        >
          <Table
            size="small"
            rowKey="reportDate"
            loading={reportsQuery.isFetching}
            dataSource={reports?.items ?? []}
            pagination={{
              current: reportPage,
              pageSize: 10,
              total: reports?.total ?? 0,
              showTotal: (t) => `共 ${t} 份`,
              onChange: setReportPage,
            }}
            columns={[
              { title: '日期', dataIndex: 'reportDate', width: 100 },
              {
                title: '状态',
                dataIndex: 'generationStatus',
                width: 90,
                render: (v: string) => {
                  const meta = REPORT_STATUS_META[v] ?? {
                    label: v,
                    color: 'default',
                  }
                  return <Tag color={meta.color}>{meta.label}</Tag>
                },
              },
              {
                title: '家长反馈',
                key: 'feedbacks',
                width: 110,
                render: (_, row) => <ReportFeedbackTag feedbacks={row.feedbacks} />,
              },
              {
                title: '表达观察',
                dataIndex: 'expressionObservation',
                render: (v: string | null) => <EllipsisText text={v} />,
              },
              {
                title: '情绪观察',
                dataIndex: 'emotionObservation',
                render: (v: string | null) => <EllipsisText text={v} />,
              },
              {
                title: '思维观察',
                dataIndex: 'thinkingObservation',
                render: (v: string | null) => <EllipsisText text={v} />,
              },
              {
                title: '建议',
                dataIndex: 'suggestion',
                render: (v: string | null) => <EllipsisText text={v} />,
              },
            ]}
          />
        </Card>

        {/* 使用反馈 */}
        <Card
          size="small"
          title={
            <Space>
              使用反馈
              <InfoTip title="该设备全部绑定账号在小程序里提交的文字反馈（含主动留下的联系方式）。匿名反馈无法归属设备，不在此展示。" />
            </Space>
          }
        >
          <Table
            size="small"
            rowKey="id"
            loading={userFbQuery.isFetching}
            dataSource={userFb?.items ?? []}
            pagination={{
              current: userFbPage,
              pageSize: 10,
              total: userFb?.total ?? 0,
              showTotal: (t) => `共 ${t} 条`,
              onChange: setUserFbPage,
            }}
            columns={[
              { title: '内容', dataIndex: 'content' },
              {
                title: '联系方式',
                dataIndex: 'contact',
                width: 140,
                render: (v: string | null) => v ?? '—',
              },
              {
                title: '家长',
                key: 'user',
                width: 140,
                render: (_, row) =>
                  row.user ? (row.user.nickname ?? row.user.phone ?? '—') : '—',
              },
              {
                title: '提交时间',
                dataIndex: 'createdAt',
                width: 150,
                render: fmtTime,
              },
            ]}
          />
        </Card>

        {/* 近期消息 */}
        <Card
          size="small"
          title={
            <Space>
              近期消息
              <InfoTip title="该设备最近 10 条消息（孩子/AI）。点下方链接进消息明细页看完整历史。" />
            </Space>
          }
          extra={
            <Link to={`/messages?deviceId=${encodeURIComponent(deviceId)}`}>
              查看全部 →
            </Link>
          }
        >
          <Table
            size="small"
            rowKey="id"
            loading={messagesQuery.isLoading}
            dataSource={messages?.items ?? []}
            pagination={false}
            columns={[
              {
                title: '时间',
                dataIndex: 'spokeAt',
                width: 150,
                render: fmtTime,
              },
              {
                title: '角色',
                dataIndex: 'role',
                width: 80,
                render: (v: string) =>
                  v === 'user' ? (
                    <Tag color="geekblue">孩子</Tag>
                  ) : (
                    <Tag color="green">AI</Tag>
                  ),
              },
              {
                title: '状态',
                dataIndex: 'status',
                width: 90,
                render: (v: string) => statusTag(v),
              },
              {
                title: '内容',
                dataIndex: 'content',
                render: (v: string) => <EllipsisText text={v} />,
              },
            ]}
          />
        </Card>
      </Space>
    </Spin>
  )
}
