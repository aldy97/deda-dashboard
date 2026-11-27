import { useMemo, useState } from 'react'
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
import dayjs from 'dayjs'
import {
  useInterruptionRate,
  useMessageModes,
  useMessages,
} from '../../api/queries'
import { useAnalyticsMeta } from '../../api/meta'
import { useAllTestDevices } from '../../api/testDevices'
import type { MessagesQuery } from '../../api/analytics'
import type { MessageSort } from '../../types/analytics'
import { isSuperAdmin } from '../../components/access/role'
import AnalyticsRangePicker from '../../components/AnalyticsRangePicker'
import InfoTip from '../../components/InfoTip'
import PageHeader from '../../components/PageHeader'
import RefreshButton from '../../components/RefreshButton'
import TestWhitelistTag from '../../components/TestWhitelistTag'
import { fmt } from '../../utils/date-range'
import { readParam, useUrlQuery } from '../../utils/url-state'
import MessageDetailDrawer from './MessageDetailDrawer'
import { modeLabel, roleTag } from '../../components/message/labels'
import { EMPTY_FILTERS, filtersFromUrl, filtersToPatch } from './filters'
import type { Filters } from './filters'

/**
 * 消息明细页：对标 Prisma Studio 的表浏览（过滤 + 排序 + 分页 + 行详情）。
 * 点行打开详情抽屉（含 rawPayload）；抽屉内可一键按 turnId 过滤同轮问答。
 *
 * 全部筛选条件、turnId 与打开的消息都在 URL 上（?deviceId=&mode=&startDate=…&messageId=），
 * 所以「记忆版本时间线 → 同轮问答」「用户详情 → 该设备全部消息」「安全复核队列 → 该轮链路」
 * 这些跳转能把上下文一起带过来，链接也可以直接发给同事。
 */
export default function Messages() {
  const { searchParams, setQuery } = useUrlQuery()

  const applied = filtersFromUrl(searchParams)
  const turnId = readParam(searchParams, 'turnId')
  const messageId = readParam(searchParams, 'messageId')

  // 输入中的条件（点「查询」才写进 URL）。URL 一变——后退、外部跳转、点查询——
  // 本地草稿立即作废回到 URL 值。派生而非 effect：少一轮渲染，也不会有中间态。
  const urlKey = searchParams.toString()
  const [draftState, setDraftState] = useState<{
    key: string
    filters: Filters
  } | null>(null)
  const draft = draftState?.key === urlKey ? draftState.filters : applied
  const setDraft = (next: Filters) => setDraftState({ key: urlKey, filters: next })

  const [sort, setSort] = useState<MessageSort>('spokeAt_desc')
  const [pageSize, setPageSize] = useState(20)
  // 页码挂在「当前生效条件」上：条件一变自动回第 1 页，不会停在越界页码看空表
  const filterKey = JSON.stringify(applied)
  const [pageState, setPageState] = useState({ key: filterKey, page: 1 })
  const page = pageState.key === filterKey ? pageState.page : 1
  const setPage = (next: number) => setPageState({ key: filterKey, page: next })

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

  // 白名单备注只对超管下发（/analytics/test-devices 由 SuperAdminGuard 把守）；
  // 非超管连请求都不发，与设备舰队「testWhitelist=null 不显示」的结果一致。
  const metaQuery = useAnalyticsMeta()
  const superadmin = isSuperAdmin(metaQuery.data)
  const whitelistQuery = useAllTestDevices(superadmin)
  const whitelistNotes = useMemo(() => {
    const notes = new Map<string, string | null>()
    for (const item of whitelistQuery.data?.items ?? []) {
      notes.set(item.device.deviceId, item.note)
    }
    return notes
  }, [whitelistQuery.data])

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
    setQuery(filtersToPatch(draft), { replace: true })
  }

  const resetFilters = () => {
    setDraftState(null)
    setSort('spokeAt_desc')
    setQuery(
      { ...filtersToPatch(EMPTY_FILTERS), turnId: null },
      { replace: true },
    )
  }

  /** 设置/清除 turnId 过滤（写 URL，可刷新、可分享） */
  const applyTurnId = (tid: string | null) => {
    setQuery({ turnId: tid }, { replace: true })
  }

  return (
    <div>
      <PageHeader
        title="消息明细"
        description="一行一条消息，一轮问答由 turnId 关联两条（孩子 + AI）；时间为 Asia/Shanghai"
        actions={
          <RefreshButton
            loading={refreshing}
            onClick={() => void messagesQuery.refetch()}
          />
        }
      />

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
              // 服务端 MODE_LABELS 文案与前端可能不一致（adventure_story 就是如此），
              // 筛选器的显示名统一走前端 modeLabel，与列表「模式」列保持同一份映射
              label: `${modeLabel(m.key)}（${m.messageCount}）`,
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
            onClick: () => setQuery({ messageId: row.id }),
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
              width: 220,
              render: (_, row) => {
                const label = row.device.deviceCode ?? row.device.deviceId
                // Map.get 的 undefined 与白名单里的 null 备注是两回事：
                // 前者=不在册（不显示），后者=在册但没写备注（显示「白名单」）。
                const note = whitelistNotes.get(row.device.deviceId)
                return (
                  <div
                    data-testid="message-device-cell"
                    style={{
                      // 第一列固定宽度：设备 ID 长短不影响第二列 Tag 的左边缘。
                      display: 'grid',
                      gridTemplateColumns: '104px minmax(0, 1fr)',
                      alignItems: 'center',
                      columnGap: 4,
                      minWidth: 0,
                    }}
                  >
                    <span
                      data-testid="message-device-label"
                      title={label}
                      style={{
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {label}
                    </span>
                    {note !== undefined ? (
                      <span
                        data-testid="message-device-tag"
                        // 只固定左边缘：不 stretch，Tag 宽度由备注内容决定
                        style={{ justifySelf: 'start', minWidth: 0 }}
                      >
                        <TestWhitelistTag note={note} />
                      </span>
                    ) : null}
                  </div>
                )
              },
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
        message={data?.items.find((item) => item.id === messageId) ?? null}
        messageId={messageId}
        onClose={() => setQuery({ messageId: null }, { replace: true })}
        onViewTurn={(tid) => {
          // 一次写完：过滤到同轮问答并关掉抽屉，避免留下两条历史记录
          setQuery({ turnId: tid, messageId: null }, { replace: true })
        }}
      />
    </div>
  )
}
