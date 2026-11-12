import { useState } from 'react'
import { Empty, Input, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import type { FleetDeviceItem } from '../../types/analytics'
import { useFleetDevices } from '../../api/queries'
import InfoTip from '../../components/InfoTip'
import DeviceDetailDrawer from './DeviceDetailDrawer'

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

function relativeTime(epochMs: number | null): string {
  if (epochMs === null) return '-'
  const now = dayjs()
  const t = dayjs(epochMs)
  const diffSec = now.diff(t, 'second')
  if (diffSec < 60) return `${diffSec} 秒前`
  const diffMin = now.diff(t, 'minute')
  if (diffMin < 60) return `${diffMin} 分钟前`
  const diffHour = now.diff(t, 'hour')
  if (diffHour < 24) return `${diffHour} 小时前`
  const diffDay = now.diff(t, 'day')
  if (diffDay < 30) return `${diffDay} 天前`
  return t.format('YYYY-MM-DD HH:mm')
}

/**
 * 设备明细分页表。
 * keyword 搜 deviceId/deviceCode/macAddress（≤50 字）；
 * pageSize 默认 20，最大值 100；固定 createdAt 降序。
 * realtime 为 null 时整组实时列显示 -。
 */
export default function DeviceTable() {
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)

  const devicesQuery = useFleetDevices({
    keyword: keyword || undefined,
    page,
    pageSize,
  })
  const data = devicesQuery.data ?? null

  const columns: ColumnsType<FleetDeviceItem> = [
    {
      title: '设备 ID',
      dataIndex: 'deviceId',
      key: 'deviceId',
      width: 150,
      ellipsis: true,
    },
    {
      title: '角色',
      dataIndex: 'characterKey',
      key: 'characterKey',
      width: 80,
    },
    {
      title: '固件版本',
      dataIndex: 'firmwareVersion',
      key: 'firmwareVersion',
      width: 100,
      render: (v: string | null) => (v !== null ? v : '-'),
    },
    {
      title: (
        <>
          在线状态
          <InfoTip title="15 秒窗口内有心跳即判定在线。无 Redis 记录时整组实时列为 -。" />
        </>
      ),
      key: 'online',
      width: 90,
      render: (_: unknown, r: FleetDeviceItem) => {
        if (r.realtime === null) return '-'
        return r.realtime.online ? (
          <Tag color="green">在线</Tag>
        ) : (
          <Tag>离线</Tag>
        )
      },
    },
    {
      title: '电量',
      key: 'battery',
      width: 80,
      render: (_: unknown, r: FleetDeviceItem) => {
        if (r.realtime === null || r.realtime.battery === null) return '-'
        const v = r.realtime.battery
        return (
          <Typography.Text type={v <= 20 ? 'danger' : undefined}>
            {v}%
          </Typography.Text>
        )
      },
    },
    {
      title: '音量',
      key: 'volume',
      width: 70,
      render: (_: unknown, r: FleetDeviceItem) => {
        if (r.realtime === null || r.realtime.volume === null) return '-'
        return `${r.realtime.volume}%`
      },
    },
    {
      title: '充电',
      key: 'charging',
      width: 70,
      render: (_: unknown, r: FleetDeviceItem) => {
        if (r.realtime === null || r.realtime.charging === null) return '-'
        return r.realtime.charging ? (
          <Tag color="orange">充电中</Tag>
        ) : (
          <span>否</span>
        )
      },
    },
    {
      title: (
        <>
          最后心跳
          <InfoTip title="realtime.lastSeenAt（epoch 毫秒），不超过 15 秒窗口。无 Redis 记录时显示 -。" />
        </>
      ),
      key: 'lastSeenAt',
      width: 120,
      render: (_: unknown, r: FleetDeviceItem) => {
        if (r.realtime === null) return '-'
        return relativeTime(r.realtime.lastSeenAt)
      },
    },
    {
      title: (
        <>
          近 7 天开机
          <InfoTip title="近 7 个自然日（含今天）内有 presence 行的天数（0–7）。天级口径。" />
        </>
      ),
      dataIndex: 'presenceDays7d',
      key: 'presenceDays7d',
      width: 110,
      render: (v: number) => `${v} 天`,
    },
    {
      title: (
        <>
          近 7 天对话
          <InfoTip title="近 7 日 role=user 的消息条数。" />
        </>
      ),
      dataIndex: 'turns7d',
      key: 'turns7d',
      width: 110,
    },
    {
      title: '绑定用户',
      dataIndex: 'boundUsers',
      key: 'boundUsers',
      width: 90,
      render: (v: number) => `${v} 人`,
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      fixed: 'right',
      render: (_: unknown, r: FleetDeviceItem) => (
        <a onClick={() => setSelectedDeviceId(r.deviceId)}>详情</a>
      ),
    },
  ]

  return (
    <div>
      <div
        style={{
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Input.Search
          placeholder="搜索设备 ID / 编码 / MAC"
          allowClear
          maxLength={50}
          style={{ width: 280 }}
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value)
            setPage(1)
          }}
          onSearch={() => {
            setPage(1)
          }}
        />
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          最长 50 字符
        </Typography.Text>
      </div>
      {data === null && devicesQuery.isLoading ? (
        <Table
          columns={columns}
          dataSource={[]}
          rowKey="deviceId"
          size="small"
          loading
          pagination={false}
        />
      ) : data && data.items.length > 0 ? (
        <Table
          columns={columns}
          dataSource={data.items}
          rowKey="deviceId"
          size="small"
          scroll={{ x: 1200 }}
          pagination={{
            current: page,
            pageSize,
            total: data.total,
            showSizeChanger: true,
            pageSizeOptions: PAGE_SIZE_OPTIONS.map(String),
            showTotal: (total) => `共 ${total} 台设备`,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
        />
      ) : (
        <Empty description="暂无设备数据" />
      )}

      <DeviceDetailDrawer
        deviceId={selectedDeviceId}
        onClose={() => setSelectedDeviceId(null)}
      />
    </div>
  )
}
