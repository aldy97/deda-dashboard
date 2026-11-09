import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Card,
  Col,
  Input,
  Progress,
  Row,
  Spin,
  Statistic,
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
        <Row gutter={16}>
          <Col xs={12} md={6}>
            <Card>
              <Statistic
                title="有记忆设备占比"
                value={overview ? overview.deviceCoverage * 100 : 0}
                precision={1}
                suffix="%"
              />
              {overview && (
                <Typography.Text type="secondary">
                  {overview.deviceWithMemories} / {overview.deviceTotal} 台
                </Typography.Text>
              )}
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card>
              <Statistic
                title="生效中的记忆"
                value={overview?.totalActiveMemories ?? 0}
              />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card>
              <Statistic
                title="累计版本数（含历史）"
                value={overview?.totalVersions ?? 0}
              />
            </Card>
          </Col>
          <Col xs={24} md={6}>
            <Card>
              <Typography.Text type="secondary">槽位覆盖率</Typography.Text>
              {MEMORY_KEYS.map((key) => {
                const slot = overview?.slotCoverage.find((s) => s.key === key)
                const coverage = slot?.coverage ?? 0
                return (
                  <div key={key} style={{ marginTop: 4 }}>
                    <Typography.Text
                      style={{ fontSize: 12 }}
                      type="secondary"
                    >
                      {memoryKeyLabel(key)}
                      {slot ? `（${slot.deviceCount} 台）` : ''}
                    </Typography.Text>
                    <Progress
                      percent={Number((coverage * 100).toFixed(1))}
                      size="small"
                    />
                  </div>
                )
              })}
            </Card>
          </Col>
        </Row>
      </Spin>

      <Card style={{ marginTop: 16 }}>
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
            {
              title: '设备码',
              dataIndex: 'deviceCode',
              render: (v: string | null) => v ?? '—',
            },
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
