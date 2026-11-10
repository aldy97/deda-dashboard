import { useState } from 'react'
import { Alert, Radio, Table, Tooltip } from 'antd'
import dayjs from 'dayjs'
import { useUserFeedbacks } from '../../api/queries'
import AnalyticsRangePicker from '../../components/AnalyticsRangePicker'
import { defaultRange, fmt } from '../../utils/date-range'
import type { DayRange } from '../../utils/date-range'

type ContactFilter = 'all' | 'hasContact'

const CONTACT_OPTIONS: Array<{ label: string; value: ContactFilter }> = [
  { label: '全部', value: 'all' },
  { label: '仅看有联系方式', value: 'hasContact' },
]

/**
 * 使用反馈：家长主动提交的问题/建议（content ≤ 200 字 + 可选联系手机号）。
 * 用户已注销时 user 为 null，显示「已注销用户」；
 * 「账号手机号」来自 users.phone，可能与反馈留的 contact 不同，两列都展示。
 */
export default function UserFeedbackPanel() {
  const [range, setRange] = useState<DayRange>(defaultRange(30))
  const [contactFilter, setContactFilter] = useState<ContactFilter>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const query = useUserFeedbacks({
    startDate: fmt(range[0]),
    endDate: fmt(range[1]),
    hasContact: contactFilter === 'hasContact' ? true : undefined,
    page,
    pageSize,
  })
  const data = query.data ?? null
  const loading = query.isLoading
  const error = query.error
    ? query.error instanceof Error
      ? query.error.message
      : '加载失败'
    : null

  return (
    <div>
      <div
        style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}
      >
        <AnalyticsRangePicker
          value={range}
          onChange={(r) => {
            if (r) {
              setPage(1)
              setRange(r)
            }
          }}
        />
        <Radio.Group
          optionType="button"
          options={CONTACT_OPTIONS}
          value={contactFilter}
          onChange={(e) => {
            setPage(1)
            setContactFilter(e.target.value as ContactFilter)
          }}
        />
      </div>

      {error && (
        <Alert
          type="error"
          showIcon
          message="使用反馈加载失败"
          description={error}
          style={{ marginBottom: 12 }}
        />
      )}

      <Table
        size="small"
        rowKey="id"
        loading={loading}
        dataSource={data?.items ?? []}
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
            title: '反馈内容',
            dataIndex: 'content',
            ellipsis: true,
            render: (content: string) => (
              <Tooltip title={content} placement="topLeft">
                {content}
              </Tooltip>
            ),
          },
          {
            title: '联系方式',
            dataIndex: 'contact',
            width: 130,
            render: (contact: string | null) => contact ?? '—',
          },
          // 账号手机号、家长列暂不需要（当前用户普遍未绑定手机号/昵称），需要时取消注释
          // {
          //   title: '账号手机号',
          //   key: 'phone',
          //   width: 130,
          //   render: (_, row) => row.user?.phone ?? '—',
          // },
          // {
          //   title: '家长',
          //   key: 'nickname',
          //   width: 120,
          //   render: (_, row) =>
          //     row.user === null ? '已注销用户' : (row.user.nickname ?? '—'),
          // },
          {
            title: '提交时间',
            dataIndex: 'createdAt',
            width: 160,
            render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
          },
        ]}
      />
    </div>
  )
}
