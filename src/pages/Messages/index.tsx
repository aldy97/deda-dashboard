import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Alert,
  Button,
  Card,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  useInterruptionRate,
  useMessageModes,
  useMessages,
} from '../../api/queries'
import type { MessagesQuery } from '../../api/analytics'
import type { MessageListItem, MessageSort } from '../../types/analytics'
import AnalyticsRangePicker from '../../components/AnalyticsRangePicker'
import InfoTip from '../../components/InfoTip'
import { fmt } from '../../utils/date-range'
import type { DayRange } from '../../utils/date-range'
import MessageDetailDrawer, {
  modeLabel,
  roleTag,
} from './MessageDetailDrawer'

/** 筛选条件（不含分页/排序） */
interface Filters {
  range: DayRange | null
  deviceId: string
  role?: 'user' | 'assistant'
  status?: 'completed' | 'failed' | 'interrupted'
  keyword: string
  /** 对话模式（平级 mode，对应服务端 messages.mode 原值） */
  mode?: string
}

const DEFAULT_FILTERS: Filters = {
  range: null,
  deviceId: '',
  role: undefined,
  status: undefined,
  keyword: '',
  mode: undefined,
}

/**
 * 消息明细页：对标 Prisma Studio 的表浏览（过滤 + 排序 + 分页 + 行详情）。
 * 点行打开详情抽屉（含 rawPayload）；抽屉内可一键按 turnId 过滤同轮问答。
 */
export default function Messages() {
  // turnId / deviceId 支持 URL 参数（记忆档案版本时间线、用户详情页跳转过来时带上）
  const [searchParams, setSearchParams] = useSearchParams()
  const urlDeviceId = searchParams.get('deviceId') ?? ''
  // 输入中的筛选条件（点「查询」后才生效）
  const [draft, setDraft] = useState<Filters>(() => ({
    ...DEFAULT_FILTERS,
    deviceId: urlDeviceId,
  }))
  // 已生效的筛选条件
  const [applied, setApplied] = useState<Filters>(() => ({
    ...DEFAULT_FILTERS,
    deviceId: urlDeviceId,
  }))
  const [turnId, setTurnId] = useState<string | null>(() =>
    searchParams.get('turnId'),
  )

  /** 设置/清除 turnId 过滤，同时同步 URL（可刷新、可分享） */
  const applyTurnId = (tid: string | null) => {
    setTurnId(tid)
    setPage(1)
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (tid) next.set('turnId', tid)
        else next.delete('turnId')
        return next
      },
      { replace: true },
    )
  }
  const [sort, setSort] = useState<MessageSort>('spokeAt_desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [selected, setSelected] = useState<MessageListItem | null>(null)

  // 对话模式选项源（平级 mode 全集 + 区间内消息数参考）
  const modeOptionsQuery = useMessageModes()
  const modeOptions = modeOptionsQuery.data ?? null
  // AI 回复疑似打断率（仅随日期区间变化；推断口径）
  const interruptionQuery = useInterruptionRate(
    applied.range
      ? { startDate: fmt(applied.range[0]), endDate: fmt(applied.range[1]) }
      : undefined,
  )
  const interruption = interruptionQuery.data ?? null

  const messagesQueryParams: MessagesQuery = {
    ...(applied.range
      ? { startDate: fmt(applied.range[0]), endDate: fmt(applied.range[1]) }
      : {}),
    ...(applied.deviceId.trim() ? { deviceId: applied.deviceId.trim() } : {}),
    ...(applied.role ? { role: applied.role } : {}),
    ...(applied.status ? { status: applied.status } : {}),
    ...(applied.keyword.trim() ? { keyword: applied.keyword.trim() } : {}),
    ...(applied.mode ? { mode: applied.mode } : {}),
    ...(turnId ? { turnId } : {}),
    sort,
    page,
    pageSize,
  }
  const messagesQuery = useMessages(messagesQueryParams)
  const data = messagesQuery.data ?? null
  const loading = messagesQuery.isLoading
  const refreshing = messagesQuery.isFetching
  const error = messagesQuery.error
    ? messagesQuery.error instanceof Error
      ? messagesQuery.error.message
      : '加载失败'
    : null

  const applyFilters = () => {
    setPage(1)
    setApplied(draft)
  }

  const resetFilters = () => {
    setDraft(DEFAULT_FILTERS)
    setApplied(DEFAULT_FILTERS)
    applyTurnId(null)
    setSort('spokeAt_desc')
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          消息明细
        </Typography.Title>
        <Typography.Text type="secondary">
          一行一条消息，一轮问答由 turnId 关联两条（孩子 + AI）；时间为
          Asia/Shanghai
        </Typography.Text>
      </div>

      <Card>
        {interruption && interruption.assistantTotal > 0 && (
          <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
            AI 回复被打断率：
            <Typography.Text strong>
              {interruption.interruptionRate === null
                ? '—'
                : `${Math.round(interruption.interruptionRate * 1000) / 10}%`}
            </Typography.Text>
            （{applied.range ? '所选日期区间' : '全部时间'} AI 消息{' '}
            {interruption.assistantTotal} 条，被打断 {interruption.interrupted} 条）
            <InfoTip title="推断口径：新一轮对话开始时，若上一轮 AI 回复的估算播放窗口（字数 × 120ms，封顶 60s）尚未结束，或上一轮还在生成孩子就又开口，则记为被打断。非设备真实事件；孩子话密、家长插话都会计入。" />
          </Typography.Text>
        )}
        <Space wrap style={{ marginBottom: 12 }}>
          <AnalyticsRangePicker
            allowClear
            placeholder={['消息开始日期', '消息结束日期']}
            value={draft.range}
            onChange={(r) => setDraft({ ...draft, range: r })}
          />
          <Input
            allowClear
            placeholder="设备 ID（业务 ID）"
            style={{ width: 180 }}
            value={draft.deviceId}
            onChange={(e) => setDraft({ ...draft, deviceId: e.target.value })}
            onPressEnter={applyFilters}
          />
          <Select
            allowClear
            placeholder="角色"
            style={{ width: 110 }}
            value={draft.role}
            onChange={(v) => setDraft({ ...draft, role: v })}
            options={[
              { label: '孩子', value: 'user' },
              { label: 'AI', value: 'assistant' },
            ]}
          />
          <Select
            allowClear
            placeholder="状态"
            style={{ width: 110 }}
            value={draft.status}
            onChange={(v) => setDraft({ ...draft, status: v })}
            options={[
              { label: '完成', value: 'completed' },
              { label: '失败', value: 'failed' },
              { label: '被打断', value: 'interrupted' },
            ]}
          />
          <Select
            allowClear
            placeholder="对话模式"
            style={{ width: 150 }}
            value={draft.mode}
            onChange={(v) => setDraft({ ...draft, mode: v })}
            options={(modeOptions?.modes ?? []).map((m) => ({
              label: `${m.name}（${m.messageCount}）`,
              value: m.key,
            }))}
          />
          <Input
            allowClear
            placeholder="内容关键词（≤50 字）"
            style={{ width: 200 }}
            maxLength={50}
            value={draft.keyword}
            onChange={(e) => setDraft({ ...draft, keyword: e.target.value })}
            onPressEnter={applyFilters}
          />
          <Button type="primary" onClick={applyFilters}>
            查询
          </Button>
          <Button onClick={resetFilters}>重置</Button>
          <Tooltip title="按当前已生效的筛选条件重新加载">
            <Button
              icon={<ReloadOutlined />}
              loading={refreshing}
              onClick={() => void messagesQuery.refetch()}
            >
              刷新
            </Button>
          </Tooltip>
          {turnId && (
            <Tag
              closable
              color="processing"
              onClose={() => applyTurnId(null)}
            >
              同一轮问答：{turnId.slice(0, 8)}…
            </Tag>
          )}
        </Space>

        {error && (
          <Alert
            type="error"
            showIcon
            message="消息列表加载失败"
            description={error}
            style={{ marginBottom: 12 }}
          />
        )}

        <Table
          size="small"
          rowKey="id"
          loading={loading}
          dataSource={data?.items ?? []}
          onRow={(row) => ({
            onClick: () => setSelected(row),
            style: { cursor: 'pointer' },
          })}
          onChange={(_pagination, _filters, sorter) => {
            // 翻页也会触发 onChange 且带着当前排序状态，
            // 只有排序真的变化时才重置到第 1 页
            if (Array.isArray(sorter) || sorter.field !== 'spokeAt') return
            const next = sorter.order === 'ascend' ? 'spokeAt_asc' : 'spokeAt_desc'
            if (next !== sort) {
              setSort(next)
              setPage(1)
            }
          }}
          pagination={{
            current: page,
            pageSize,
            total: data?.total ?? 0,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => {
              setPage(ps !== pageSize ? 1 : p)
              setPageSize(ps)
            },
          }}
          columns={[
            {
              title: '消息时间',
              dataIndex: 'spokeAt',
              width: 170,
              sorter: true,
              sortOrder: sort === 'spokeAt_asc' ? 'ascend' : 'descend',
              render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss'),
            },
            {
              title: '设备',
              key: 'device',
              width: 140,
              render: (_, row) => row.device.deviceCode ?? row.device.deviceId,
            },
            {
              title: '角色',
              dataIndex: 'role',
              width: 80,
              render: roleTag,
            },
            {
              title: '内容',
              dataIndex: 'content',
              ellipsis: true,
              render: (content: string) => (
                <Tooltip title={content} placement="topLeft">
                  {content}
                </Tooltip>
              ),
            },
            {
              title: '模式',
              key: 'mode',
              width: 100,
              render: (_, row) => modeLabel(row.mode),
            },
            // 状态列暂不需要（一期消息几乎全 completed），需要时取消注释
            // {
            //   title: '状态',
            //   dataIndex: 'status',
            //   width: 80,
            //   render: statusTag,
            // },
            // CEFR 列暂不需要，需要时取消注释
            // {
            //   title: 'CEFR',
            //   dataIndex: 'cefrLevel',
            //   width: 70,
            //   render: (v: string | null) => v ?? '—',
            // },
          ]}
        />
      </Card>

      <MessageDetailDrawer
        message={selected}
        onClose={() => setSelected(null)}
        onViewTurn={(tid) => {
          applyTurnId(tid)
          setSelected(null)
        }}
      />
    </div>
  )
}
