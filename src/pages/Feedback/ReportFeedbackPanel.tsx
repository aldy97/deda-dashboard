import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Card,
  Col,
  DatePicker,
  Radio,
  Row,
  Statistic,
  Table,
  Tag,
} from 'antd'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { fetchReportFeedbacks } from '../../api/analytics'
import type { ReportFeedbackListResponse } from '../../types/analytics'

type Range = [Dayjs, Dayjs]

const fmt = (d: Dayjs) => d.format('YYYY-MM-DD')
const yesterday = () => dayjs().subtract(1, 'day')
const disableAfterYesterday = (d: Dayjs) => d.isAfter(yesterday(), 'day')

type UsefulFilter = 'all' | 'useful' | 'not_useful'

const USEFUL_OPTIONS: Array<{ label: string; value: UsefulFilter }> = [
  { label: '全部', value: 'all' },
  { label: '有用', value: 'useful' },
  { label: '无用', value: 'not_useful' },
]

/**
 * 日报反馈：区间内家长对每日报告的有用/无用评价明细。
 * 顶部统计为区间整体有用率（后端口径，不受「有用/无用」筛选影响）。
 * 排序按 feedbackAt（= updatedAt）倒序：改票后记录浮到最前。
 */
export default function ReportFeedbackPanel() {
  const [range, setRange] = useState<Range>([
    dayjs().subtract(30, 'day'),
    yesterday(),
  ])
  const [usefulFilter, setUsefulFilter] = useState<UsefulFilter>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [data, setData] = useState<ReportFeedbackListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (r: Range, f: UsefulFilter, p: number, ps: number) => {
      setLoading(true)
      setError(null)
      try {
        setData(
          await fetchReportFeedbacks({
            startDate: fmt(r[0]),
            endDate: fmt(r[1]),
            isUseful: f === 'all' ? undefined : f === 'useful',
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
    void load(range, usefulFilter, page, pageSize)
  }, [load, range, usefulFilter, page, pageSize])

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
          options={USEFUL_OPTIONS}
          value={usefulFilter}
          onChange={(e) => {
            setPage(1)
            setUsefulFilter(e.target.value as UsefulFilter)
          }}
        />
      </div>

      {data && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="区间有用率"
                value={(data.summary.usefulRate * 100).toFixed(1)}
                suffix="%"
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic title="有用" value={data.summary.usefulCount} />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic title="无用" value={data.summary.notUsefulCount} />
            </Card>
          </Col>
        </Row>
      )}

      {error && (
        <Alert
          type="error"
          showIcon
          message="日报反馈加载失败"
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
          { title: '报告日期', dataIndex: 'reportDate', width: 110 },
          {
            title: '设备',
            key: 'device',
            width: 140,
            render: (_, row) => row.device.deviceCode ?? row.device.deviceId,
          },
          {
            title: '型号',
            key: 'characterKey',
            width: 80,
            render: (_, row) => row.device.characterKey,
          },
          {
            title: '家长',
            key: 'nickname',
            width: 120,
            render: (_, row) => row.user.nickname ?? '—',
          },
          {
            title: '手机号',
            key: 'phone',
            width: 130,
            render: (_, row) => row.user.phone ?? '—',
          },
          {
            title: '反馈',
            dataIndex: 'isUseful',
            width: 90,
            render: (isUseful: boolean) =>
              isUseful ? (
                <Tag color="success">有用</Tag>
              ) : (
                <Tag color="error">无用</Tag>
              ),
          },
          {
            title: '反馈时间',
            dataIndex: 'feedbackAt',
            width: 160,
            render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
          },
        ]}
      />
    </div>
  )
}
