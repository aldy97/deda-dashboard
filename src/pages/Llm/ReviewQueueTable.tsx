import { useState } from 'react'
import {
  Alert,
  Button,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import dayjs from 'dayjs'
import { Link } from 'react-router-dom'
import { useReviewQueue } from '../../api/queries'
import InfoTip from '../../components/InfoTip'
import type { ReviewQueueSort } from '../../types/analytics'
import {
  SAFETY_CATEGORY_META,
  intentLabel,
  intentSourceLabel,
  safetyCategoryLabel,
  safetySourceLabel,
} from './decisions'

const CATEGORY_OPTIONS = [
  { label: '全部类别', value: 'all' },
  ...Object.entries(SAFETY_CATEGORY_META).map(([value, meta]) => ({
    label: meta.label,
    value,
  })),
]

/**
 * asrText 是儿童语音转写，逐行独立打码：默认「••••••」，点「查看」才展开。
 * 逐行而非整表开关，是为了避免一次点击把整页原文摊开——看板常在会议室投屏。
 */
function MaskedAsrText({ text }: { text: string | null }) {
  const [revealed, setRevealed] = useState(false)
  if (text === null) return <>—</>
  return (
    <Space size={4}>
      <span>{revealed ? text : '••••••'}</span>
      <Button type="link" size="small" onClick={() => setRevealed((v) => !v)}>
        {revealed ? '隐藏' : '查看'}
      </Button>
    </Space>
  )
}

/**
 * 人工复核队列（本期只读）。
 *
 * 服务端恒定附加 asrText IS NOT NULL，调用方绕不过：只有「拦了」或「判成非 safe
 * 类别」的轮次才留原文，正常轮次不积累儿童语料。reviewLabel / reviewedAt 两列
 * 已建但无写接口，复核结论回填留待二期。
 *
 * deviceId 是内部 UUID（非业务 deviceId），与 /users 页的跳转不通用。
 */
export default function ReviewQueueTable({
  startDate,
  endDate,
}: {
  startDate: string
  endDate: string
}) {
  const [category, setCategory] = useState('all')
  // 输入框值与生效值分开：逐字符发请求会在输入 UUID 时打出七八个无用查询
  const [deviceIdInput, setDeviceIdInput] = useState('')
  const [deviceId, setDeviceId] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [sort, setSort] = useState<ReviewQueueSort>('createdAt_desc')

  const trimmedDeviceId = deviceId.trim()
  const query = useReviewQueue({
    startDate,
    endDate,
    page,
    pageSize,
    sort,
    ...(category === 'all' ? {} : { category }),
    ...(trimmedDeviceId === '' ? {} : { deviceId: trimmedDeviceId }),
  })
  const data = query.data ?? null
  const error = query.error
    ? query.error instanceof Error
      ? query.error.message
      : '加载失败'
    : null

  return (
    <div>
      <div
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <Select
          style={{ width: 160 }}
          aria-label="类别过滤"
          value={category}
          options={CATEGORY_OPTIONS}
          onChange={(value) => {
            setPage(1)
            setCategory(value)
          }}
        />
        <Input.Search
          allowClear
          style={{ width: 240 }}
          placeholder="内部设备 UUID"
          value={deviceIdInput}
          onChange={(e) => {
            setDeviceIdInput(e.target.value)
            // 点 allowClear 的叉只触发 onChange，不触发 onSearch，这里同步清掉过滤
            if (e.target.value === '') {
              setPage(1)
              setDeviceId('')
            }
          }}
          onSearch={(value) => {
            setPage(1)
            setDeviceId(value)
          }}
        />
        <Button
          size="small"
          onClick={() => {
            setPage(1)
            setSort(sort === 'createdAt_desc' ? 'createdAt_asc' : 'createdAt_desc')
          }}
        >
          {sort === 'createdAt_desc' ? '时间正序' : '时间倒序'}
        </Button>
      </div>

      <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 12 }}>
        只有「拦了」或「判成非 safe 类别」的轮次才留原文，正常轮次不积累儿童语料
        （服务端强制，前端无法放宽）。asrText 是儿童语音转写：默认打码、点击展开，
        禁止直接投屏。
        <InfoTip title="本期为只读队列。reviewLabel / reviewedAt 两列已建好，复核结论（correct / false_positive / missed）的写接口留待二期——有了它才能算真实漏放率与误伤率。" />
      </Typography.Paragraph>

      {error && (
        <Alert
          type="error"
          showIcon
          message="复核队列加载失败"
          description={error}
          style={{ marginBottom: 12 }}
        />
      )}

      <Table
        size="small"
        rowKey="turnId"
        loading={query.isLoading}
        dataSource={data?.items ?? []}
        scroll={{ x: 1400 }}
        locale={{ emptyText: '所选区间暂无可复核轮次' }}
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
            title: '轮次',
            dataIndex: 'turnId',
            width: 120,
            fixed: 'left',
            render: (turnId: string) => (
              <Link to={`/messages?turnId=${turnId}`}>{turnId.slice(0, 8)}…</Link>
            ),
          },
          {
            title: '发生时间',
            dataIndex: 'createdAt',
            width: 160,
            render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss'),
          },
          {
            title: '设备',
            dataIndex: 'deviceId',
            width: 120,
            render: (v: string | null) => (v === null ? '匿名' : `${v.slice(0, 8)}…`),
          },
          {
            title: '层级',
            dataIndex: 'safetyLayer',
            width: 70,
            render: (v: string | null) => v ?? '—',
          },
          {
            title: '类别',
            dataIndex: 'safetyCategory',
            width: 110,
            render: (v: string | null) => (
              <Tag color={v === null ? 'default' : (SAFETY_CATEGORY_META[v]?.color ?? 'default')}>
                {safetyCategoryLabel(v)}
              </Tag>
            ),
          },
          {
            title: '判定来源',
            dataIndex: 'safetySource',
            width: 160,
            render: (v: string) => safetySourceLabel(v),
          },
          {
            title: '命中关键词',
            dataIndex: 'safetyMatched',
            width: 130,
            render: (v: string | null) => v ?? '—',
          },
          {
            title: '原文（点击展开）',
            dataIndex: 'asrText',
            width: 260,
            render: (v: string | null) => <MaskedAsrText text={v} />,
          },
          {
            title: '意图',
            dataIndex: 'intent',
            width: 120,
            render: (v: string | null) => intentLabel(v),
          },
          {
            title: '意图来源',
            dataIndex: 'intentSource',
            width: 160,
            render: (v: string | null) => intentSourceLabel(v),
          },
        ]}
      />
    </div>
  )
}
