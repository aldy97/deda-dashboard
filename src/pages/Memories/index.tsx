import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Card,
  Flex,
  Input,
  Progress,
  Spin,
  Table,
  Typography,
} from 'antd'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  fetchMemoriesOverview,
  fetchMemoryDevices,
} from '../../api/analytics'
import type {
  MemoriesOverviewResponse,
  MemoryDevicesResponse,
} from '../../types/analytics'
import { MEMORY_KEYS, memoryKeyLabel } from './memoryMeta'

/**
 * 记忆档案列表页：全局汇总条（设备覆盖率 + 槽位覆盖率）+ 有记忆的设备列表。
 * 点行进入 /memories/:deviceId 查看当前记忆与版本时间线。
 */
export default function Memories() {
  const navigate = useNavigate()
  const [overview, setOverview] = useState<MemoriesOverviewResponse | null>(null)
  const [devices, setDevices] = useState<MemoryDevicesResponse | null>(null)
  const [keyword, setKeyword] = useState('')
  const [appliedKeyword, setAppliedKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (kw: string, p: number, ps: number) => {
    setLoading(true)
    setError(null)
    try {
      const [ov, list] = await Promise.all([
        fetchMemoriesOverview(),
        fetchMemoryDevices({
          ...(kw ? { keyword: kw } : {}),
          page: p,
          pageSize: ps,
        }),
      ])
      setOverview(ov)
      setDevices(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(appliedKeyword, page, pageSize)
  }, [load, appliedKeyword, page, pageSize])

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          记忆档案
        </Typography.Title>
        <Typography.Text type="secondary">
          孩子的长期偏好记忆：值不可覆盖，纠正通过新版本保留历史；点设备查看版本时间线
        </Typography.Text>
      </div>

      {error && (
        <Alert
          type="error"
          showIcon
          message="记忆档案加载失败"
          description={error}
          style={{ marginBottom: 16 }}
        />
      )}

      <Spin spinning={loading && !overview}>
        {/* 槽位覆盖率：横向紧凑条 */}
        <Card size="small">
          <Flex align="center" gap={16} wrap="wrap">
            <Typography.Text
              type="secondary"
              style={{ fontSize: 12, whiteSpace: 'nowrap' }}
            >
              槽位覆盖率
            </Typography.Text>
            {MEMORY_KEYS.map((key) => {
              const slot = overview?.slotCoverage.find((s) => s.key === key)
              const coverage = slot?.coverage ?? 0
              return (
                <Flex key={key} align="center" gap={8}>
                  <Typography.Text
                    style={{ fontSize: 12, whiteSpace: 'nowrap' }}
                    type="secondary"
                  >
                    {memoryKeyLabel(key)}
                    {slot ? ` ${slot.deviceCount}台` : ''}
                  </Typography.Text>
                  <Progress
                    percent={Number((coverage * 100).toFixed(1))}
                    size="small"
                    style={{ width: 110, margin: 0 }}
                  />
                </Flex>
              )
            })}
          </Flex>
        </Card>
      </Spin>

      <Card
        style={{ marginTop: 16 }}
        title={
          <Flex align="baseline" gap={12} wrap="wrap">
            <span>设备列表</span>
            <Typography.Text
              type="secondary"
              style={{ fontSize: 12, fontWeight: 'normal' }}
            >
              有记忆设备{' '}
              {overview
                ? `${(overview.deviceCoverage * 100).toFixed(1)}%（${overview.deviceWithMemories} / ${overview.deviceTotal} 台）`
                : '—'}
              {' · '}生效中的记忆 {overview?.totalActiveMemories ?? '—'}
              {' · '}累计版本 {overview?.totalVersions ?? '—'}
            </Typography.Text>
          </Flex>
        }
      >
        <div style={{ marginBottom: 12 }}>
          <Input.Search
            allowClear
            placeholder="搜索设备 ID / 设备码"
            style={{ width: 280 }}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onSearch={(v) => {
              setAppliedKeyword(v.trim())
              setPage(1)
            }}
          />
        </div>
        <Table
          size="small"
          rowKey="deviceId"
          loading={loading}
          dataSource={devices?.items ?? []}
          onRow={(row) => ({
            onClick: () => navigate(`/memories/${row.deviceId}`),
            style: { cursor: 'pointer' },
          })}
          pagination={{
            current: page,
            pageSize,
            total: devices?.total ?? 0,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: (t) => `共 ${t} 台`,
            onChange: (p, ps) => {
              setPage(ps !== pageSize ? 1 : p)
              setPageSize(ps)
            },
          }}
          columns={[
            {
              title: '设备 ID（业务 ID）',
              dataIndex: 'deviceId',
            },
            // 设备码列暂不需要（与设备 ID 展示冗余），需要时取消注释
            // {
            //   title: '设备码',
            //   dataIndex: 'deviceCode',
            //   render: (v: string | null) => v ?? '—',
            // },
            {
              title: '生效记忆',
              dataIndex: 'activeCount',
              width: 110,
            },
            {
              title: '累计版本',
              dataIndex: 'totalVersions',
              width: 110,
            },
            {
              title: '最近变更',
              dataIndex: 'lastChangeAt',
              width: 180,
              render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss'),
            },
          ]}
        />
      </Card>
    </div>
  )
}
