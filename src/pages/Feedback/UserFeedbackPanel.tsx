import { useCallback, useEffect, useState } from 'react'
import { Alert, DatePicker, Radio, Table, Tooltip, Typography } from 'antd'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { fetchUserFeedbacks } from '../../api/analytics'
import type { UserFeedbackListResponse } from '../../types/analytics'

type Range = [Dayjs, Dayjs]

const fmt = (d: Dayjs) => d.format('YYYY-MM-DD')
const yesterday = () => dayjs().subtract(1, 'day')
const disableAfterYesterday = (d: Dayjs) => d.isAfter(yesterday(), 'day')

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
  const [range, setRange] = useState<Range>([
    dayjs().subtract(30, 'day'),
    yesterday(),
  ])
  const [contactFilter, setContactFilter] = useState<ContactFilter>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [data, setData] = useState<UserFeedbackListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (r: Range, f: ContactFilter, p: number, ps: number) => {
      setLoading(true)
      setError(null)
      try {
        setData(
          await fetchUserFeedbacks({
            startDate: fmt(r[0]),
            endDate: fmt(r[1]),
            hasContact: f === 'hasContact' ? true : undefined,
            page: p,
            pageSize: ps,
          }),
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败')
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    void load(range, contactFilter, page, pageSize)
  }, [load, range, contactFilter, page, pageSize])

  return (
    <div>
      <div
        style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}
      >
        <DatePicker.RangePicker
          allowClear={false}
          disabledDate={disableAfterYesterday}
          value={range}
          onChange={(dates) => {
            if (dates?.[0] && dates?.[1]) {
              setPage(1)
              setRange([dates[0], dates[1]])
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
            render: (contact: string | null) =>
              contact ?? <Typography.Text type="secondary">—</Typography.Text>,
          },
          {
            title: '账号手机号',
            key: 'phone',
            width: 130,
            render: (_, row) => row.user?.phone ?? '—',
          },
          {
            title: '家长',
            key: 'nickname',
            width: 120,
            render: (_, row) =>
              row.user === null ? (
                <Typography.Text type="secondary">已注销用户</Typography.Text>
              ) : (
                (row.user.nickname ?? '—')
              ),
          },
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
