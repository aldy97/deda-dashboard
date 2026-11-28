import { useState } from 'react'
import {
  Alert,
  Card,
  Col,
  Radio,
  Row,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd'
import dayjs from 'dayjs'
import { useContentParentReport, useReportFeedbacks } from '../../api/queries'
import AccessLink from '../../components/access/AccessLink'
import AnalyticsRangePicker from '../../components/AnalyticsRangePicker'
import { defaultRange, fmt } from '../../utils/date-range'
import type { DayRange } from '../../utils/date-range'
import { useUrlQuery, readParam } from '../../utils/url-state'

type UsefulFilter = 'all' | 'useful' | 'not_useful'

const formatPct = (rate: number | null | undefined) =>
  rate === null || rate === undefined ? '—' : `${(rate * 100).toFixed(1)}%`

const USEFUL_OPTIONS: Array<{ label: string; value: UsefulFilter }> = [
  { label: '全部', value: 'all' },
  { label: '有用', value: 'useful' },
  { label: '无用', value: 'not_useful' },
]

/**
 * 日报反馈：区间内家长对每日报告的有用/无用评价明细。
 *
 * 「家长报告」tab 已并入本面板：生成量（生成报告数 / 失败数 / 成功率）与
 * 报告反馈的有用率在同一张统计卡里，共用同一个日期区间——此前是第三个 tab，
 * 两个区间控件各滚各的，同一屏上看生成量和有用率还得对两次日期。
 * 收到反馈数不再单列：无 deviceId 预筛时它恒等于「有用 + 无用」。
 *
 * 顶部统计为区间整体有用率（后端口径，不受「有用/无用」筛选影响）。
 * 排序按 feedbackAt（= updatedAt）倒序：改票后记录浮到最前。
 * URL 支持 ?deviceId= 预筛：从其他页面下钻时带入，渲染可关闭 Tag。
 */
export default function ReportFeedbackPanel() {
  const { searchParams, setQuery: setUrlQuery } = useUrlQuery()
  const [range, setRange] = useState<DayRange>(defaultRange(30))
  const [usefulFilter, setUsefulFilter] = useState<UsefulFilter>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const deviceId = readParam(searchParams, 'deviceId')
  const query = useReportFeedbacks({
    startDate: fmt(range[0]),
    endDate: fmt(range[1]),
    isUseful: usefulFilter === 'all' ? undefined : usefulFilter === 'useful',
    deviceId: deviceId ?? undefined,
    page,
    pageSize,
  })
  // 生成质量与反馈明细吃同一个区间，避免两套日期控件口径漂移
  const qualityQuery = useContentParentReport({
    startDate: fmt(range[0]),
    endDate: fmt(range[1]),
  })
  const quality = qualityQuery.data ?? null
  const data = query.data ?? null
  const loading = query.isLoading
  const qualityError = qualityQuery.error
    ? qualityQuery.error instanceof Error
      ? qualityQuery.error.message
      : '加载失败'
    : null
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
          options={USEFUL_OPTIONS}
          value={usefulFilter}
          onChange={(e) => {
            setPage(1)
            setUsefulFilter(e.target.value as UsefulFilter)
          }}
        />
      </div>

      {deviceId && (
        <Tag
          closable
          onClose={() => {
            setPage(1)
            setUrlQuery({ deviceId: null }, { replace: true })
          }}
          style={{ marginBottom: 12 }}
        >
          设备：{deviceId}
        </Tag>
      )}

      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={12} md={8} lg={4}>
            <Statistic title="生成报告数" value={quality?.generated ?? '—'} />
          </Col>
          <Col xs={12} md={8} lg={4}>
            <Statistic title="生成失败数" value={quality?.failed ?? '—'} />
          </Col>
          <Col xs={12} md={8} lg={4}>
            <Statistic
              title="生成成功率"
              value={formatPct(quality?.successRate)}
            />
          </Col>
          <Col xs={12} md={8} lg={4}>
            <Statistic
              title="区间有用率"
              value={data ? (data.summary.usefulRate * 100).toFixed(1) : '—'}
              suffix={data ? '%' : undefined}
            />
          </Col>
          <Col xs={12} md={8} lg={4}>
            <Statistic title="有用" value={data?.summary.usefulCount ?? '—'} />
          </Col>
          <Col xs={12} md={8} lg={4}>
            <Statistic
              title="无用"
              value={data?.summary.notUsefulCount ?? '—'}
            />
          </Col>
        </Row>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          <AccessLink
            hint="llm-perf"
            detail="家长日报生成"
            arrow
            to="/llm?tab=perf&scene=parent_report"
          >
            生成失败排查：模型监控·家长日报生成
          </AccessLink>
        </Typography.Text>
      </Card>

      {qualityError && (
        <Alert
          type="error"
          showIcon
          message="家长报告数据加载失败"
          description={qualityError}
          style={{ marginBottom: 12 }}
        />
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
        expandable={{
          // 展开行展示反馈对应的日报内容，便于判断「有用/无用」针对的是什么
          expandedRowRender: (row) => (
            <div style={{ padding: '4px 0' }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {row.report.reportDate} 日报（
                {row.report.generationStatus === 'completed'
                  ? '已生成'
                  : `状态：${row.report.generationStatus}`}
                ）
              </Typography.Text>
              <dl style={{ margin: '8px 0 0', display: 'grid', gap: 6 }}>
                {(
                  [
                    ['表达观察', row.report.expressionObservation],
                    ['情绪观察', row.report.emotionObservation],
                    ['思维观察', row.report.thinkingObservation],
                    ['建议', row.report.suggestion],
                  ] as const
                ).map(([label, text]) => (
                  <div key={label}>
                    <Typography.Text strong style={{ fontSize: 12 }}>
                      {label}：
                    </Typography.Text>
                    <Typography.Text style={{ fontSize: 12 }}>
                      {text ?? '—'}
                    </Typography.Text>
                  </div>
                ))}
              </dl>
            </div>
          ),
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
          { title: '报告日期', dataIndex: 'reportDate', width: 110 },
          {
            title: '设备',
            key: 'device',
            width: 140,
            render: (_, row) => (
              <AccessLink
                hint="device-profile"
                to={`/users/${encodeURIComponent(row.device.deviceId)}`}
              >
                {row.device.deviceCode ?? row.device.deviceId}
              </AccessLink>
            ),
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
