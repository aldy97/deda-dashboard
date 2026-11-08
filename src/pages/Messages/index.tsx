import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { fetchMessages } from '../../api/analytics'
import type { MessagesQuery } from '../../api/analytics'
import type {
  MessageListItem,
  MessageListResponse,
  MessageSort,
} from '../../types/analytics'
import MessageDetailDrawer, {
  modeLabel,
  roleTag,
  statusTag,
} from './MessageDetailDrawer'

type Range = [Dayjs, Dayjs] | null

const fmt = (d: Dayjs) => d.format('YYYY-MM-DD')

/** 筛选条件（不含分页/排序） */
interface Filters {
  range: Range
  deviceId: string
  role?: 'user' | 'assistant'
  status?: 'completed' | 'failed'
  keyword: string
}

const DEFAULT_FILTERS: Filters = {
  range: null,
  deviceId: '',
  role: undefined,
  status: undefined,
  keyword: '',
}

/**
 * 消息明细页：对标 Prisma Studio 的表浏览（过滤 + 排序 + 分页 + 行详情）。
 * 点行打开详情抽屉（含 rawPayload）；抽屉内可一键按 turnId 过滤同轮问答。
 */
export default function Messages() {
  // 输入中的筛选条件（点「查询」后才生效）
  const [draft, setDraft] = useState<Filters>(DEFAULT_FILTERS)
  // 已生效的筛选条件
  const [applied, setApplied] = useState<Filters>(DEFAULT_FILTERS)
  const [turnId, setTurnId] = useState<string | null>(null)
  const [sort, setSort] = useState<MessageSort>('spokeAt_desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [data, setData] = useState<MessageListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<MessageListItem | null>(null)

  const load = useCallback(
    async (
      f: Filters,
      tid: string | null,
      s: MessageSort,
      p: number,
      ps: number,
    ) => {
      setLoading(true)
      setError(null)
      const query: MessagesQuery = {
        ...(f.range
          ? { startDate: fmt(f.range[0]), endDate: fmt(f.range[1]) }
          : {}),
        ...(f.deviceId.trim() ? { deviceId: f.deviceId.trim() } : {}),
        ...(f.role ? { role: f.role } : {}),
        ...(f.status ? { status: f.status } : {}),
        ...(f.keyword.trim() ? { keyword: f.keyword.trim() } : {}),
        ...(tid ? { turnId: tid } : {}),
        sort: s,
        page: p,
        pageSize: ps,
      }
      try {
        setData(await fetchMessages(query))
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败')
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    void load(applied, turnId, sort, page, pageSize)
  }, [load, applied, turnId, sort, page, pageSize])

  const applyFilters = () => {
    setPage(1)
    setApplied(draft)
  }

  const resetFilters = () => {
    setDraft(DEFAULT_FILTERS)
    setApplied(DEFAULT_FILTERS)
    setTurnId(null)
    setPage(1)
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
        <Space wrap style={{ marginBottom: 12 }}>
          <DatePicker.RangePicker
            allowClear
            placeholder={['消息开始日期', '消息结束日期']}
            value={draft.range}
            onChange={(dates) =>
              setDraft({
                ...draft,
                range:
                  dates?.[0] && dates?.[1] ? [dates[0], dates[1]] : null,
              })
            }
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
            ]}
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
          {turnId && (
            <Tag
              closable
              color="processing"
              onClose={() => {
                setTurnId(null)
                setPage(1)
              }}
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
            if (!Array.isArray(sorter) && sorter.field === 'spokeAt') {
              setSort(
                sorter.order === 'ascend' ? 'spokeAt_asc' : 'spokeAt_desc',
              )
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
              render: (_, row) => modeLabel(row.mode, row.conversationModeKey),
            },
            {
              title: '状态',
              dataIndex: 'status',
              width: 80,
              render: statusTag,
            },
            {
              title: 'CEFR',
              dataIndex: 'cefrLevel',
              width: 70,
              render: (v: string | null) => v ?? '—',
            },
          ]}
        />
      </Card>

      <MessageDetailDrawer
        message={selected}
        onClose={() => setSelected(null)}
        onViewTurn={(tid) => {
          setTurnId(tid)
          setPage(1)
          setSelected(null)
        }}
      />
    </div>
  )
}
