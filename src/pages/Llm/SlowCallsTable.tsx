import { Alert, Table, Tag } from 'antd'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import { useLlmSlowCalls } from '../../api/queries'
import { formatMs, sceneLabel } from './scenes'

/**
 * 慢调用长尾（仅成功调用）：失败有「最近失败明细」兜底，
 * 但慢而成功的调用（如上游卡顿 10s）才是体验劣化的主要来源。
 */
export default function SlowCallsTable({
  startDate,
  endDate,
  scene,
}: {
  startDate: string
  endDate: string
  scene?: string
}) {
  const query = useLlmSlowCalls({
    startDate,
    endDate,
    limit: 10,
    ...(scene ? { scene } : {}),
  })
  const items = query.data?.items ?? null
  const error = query.error
    ? query.error instanceof Error
      ? query.error.message
      : '加载失败'
    : null

  if (error) {
    return (
      <Alert
        type="error"
        showIcon
        message="慢调用数据加载失败"
        description={error}
      />
    )
  }

  return (
    <Table
      size="small"
      rowKey="id"
      loading={items === null}
      dataSource={items ?? []}
      pagination={false}
      columns={[
        {
          title: '时间',
          dataIndex: 'createdAt',
          width: 170,
          render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss'),
        },
        {
          title: '场景',
          dataIndex: 'scene',
          width: 130,
          render: sceneLabel,
        },
        {
          title: '模型',
          dataIndex: 'model',
          width: 180,
          render: (model: string, row) => (
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                whiteSpace: 'nowrap',
              }}
            >
              <Tag
                color={row.tier === 'small' ? 'geekblue' : 'gold'}
                style={{ flexShrink: 0 }}
              >
                {row.tier === 'small' ? '小' : '主'}
              </Tag>
              {model}
            </span>
          ),
        },
        {
          title: '耗时',
          dataIndex: 'latencyMs',
          width: 100,
          align: 'right',
          render: (v: number | null) => (v === null ? '—' : formatMs(v)),
        },
        {
          title: '首包',
          dataIndex: 'firstTokenMs',
          width: 100,
          align: 'right',
          render: (v: number | null) => (v === null ? '—' : formatMs(v)),
        },
        {
          title: 'Token',
          dataIndex: 'totalTokens',
          width: 90,
          align: 'right',
          render: (v: number | null) => v ?? '—',
        },
        {
          title: '设备',
          dataIndex: 'deviceId',
          render: (v: string | null) => v ?? '—',
        },
        {
          title: '同轮对话',
          dataIndex: 'turnId',
          width: 110,
          render: (v: string | null) =>
            v ? <Link to={`/messages?turnId=${v}`}>查看链路</Link> : '—',
        },
      ]}
    />
  )
}
