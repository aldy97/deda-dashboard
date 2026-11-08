import { useCallback, useEffect, useState } from 'react'
import { Alert, Table, Tag } from 'antd'
import dayjs from 'dayjs'
import { fetchLlmRecentFailures } from '../../api/analytics'
import type { LlmRecentFailuresResponse } from '../../types/analytics'
import { FAILURE_REASON_META, failureReasonLabel, sceneLabel } from './scenes'

/**
 * 最近失败明细：服务端分页，createdAt 倒序（后端固定）。
 */
export default function RecentFailuresTable({ scene }: { scene?: string }) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [data, setData] = useState<LlmRecentFailuresResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 场景切换时回第 1 页（render 期间调整，避免双请求）
  const [prevScene, setPrevScene] = useState(scene)
  if (prevScene !== scene) {
    setPrevScene(scene)
    setPage(1)
  }

  const load = useCallback(
    async (s: string | undefined, p: number, ps: number) => {
      setLoading(true)
      setError(null)
      try {
        setData(
          await fetchLlmRecentFailures({
            ...(s ? { scene: s } : {}),
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
    void load(scene, page, pageSize)
  }, [load, scene, page, pageSize])

  return (
    <div>
      {error && (
        <Alert
          type="error"
          showIcon
          message="失败明细加载失败"
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
            width: 140,
            render: (model: string, row) => (
              <span>
                <Tag color={row.tier === 'small' ? 'geekblue' : 'gold'}>
                  {row.tier === 'small' ? '小' : '主'}
                </Tag>
                {model}
              </span>
            ),
          },
          {
            title: '失败原因',
            dataIndex: 'failureReason',
            width: 110,
            render: (reason: string | null) => (
              <Tag color={FAILURE_REASON_META[reason ?? '']?.color ?? 'default'}>
                {failureReasonLabel(reason)}
              </Tag>
            ),
          },
          {
            title: '耗时',
            dataIndex: 'latencyMs',
            width: 100,
            align: 'right',
            render: (v: number | null) => (v === null ? '—' : `${v} ms`),
          },
          {
            title: '设备',
            dataIndex: 'deviceId',
            render: (v: string | null) => v ?? '—',
          },
        ]}
      />
    </div>
  )
}
