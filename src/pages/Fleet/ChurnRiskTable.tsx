import { Empty, InputNumber, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import type {
  ChurnRiskDevice,
  FleetChurnRiskResponse,
} from '../../types/analytics'
import InfoTip from '../../components/InfoTip'

const BASIS_COLOR: Record<string, string> = {
  presence: 'blue',
  message: 'green',
  createdAt: 'orange',
}

const BASIS_LABEL: Record<string, string> = {
  presence: 'presence 记录',
  message: '消息记录',
  createdAt: '从未活跃',
}

interface Props {
  data: FleetChurnRiskResponse
  days: number
  onDaysChange: (days: number) => void
}

/**
 * 流失风险设备表。
 * days 控件（1–90，缺省 7）；列按契约顺序；basis 用 Tag 区分三种来源，
 * createdAt 标注「从未活跃」。
 */
export default function ChurnRiskTable({ data, days, onDaysChange }: Props) {
  const { devices, asOf } = data

  const columns: ColumnsType<ChurnRiskDevice> = [
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
      title: '最后活跃时间',
      dataIndex: 'lastActiveAt',
      key: 'lastActiveAt',
      width: 180,
      render: (v: string | null) =>
        v !== null ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: '不活跃天数',
      dataIndex: 'daysInactive',
      key: 'daysInactive',
      width: 110,
      sorter: (a, b) => a.daysInactive - b.daysInactive,
      defaultSortOrder: 'descend',
      render: (v: number) => `${v} 天`,
    },
    {
      title: '判定依据',
      dataIndex: 'basis',
      key: 'basis',
      width: 130,
      render: (v: string) => (
        <span>
          <Tag color={BASIS_COLOR[v] ?? 'default'}>{BASIS_LABEL[v] ?? v}</Tag>
          {v === 'createdAt' && (
            <InfoTip title="该设备从未产生 presence 或消息记录，lastActiveAt = createdAt（设备入库时间），即从未活跃过。" />
          )}
        </span>
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
        <span style={{ fontSize: 13, color: '#666' }}>
          不活跃判定阈值（天）：
        </span>
        <InputNumber
          min={1}
          max={90}
          value={days}
          onChange={(v) => {
            if (v !== null) onDaysChange(v)
          }}
          style={{ width: 80 }}
        />
        <span style={{ fontSize: 12, color: '#999' }}>
          基准日 {asOf} · 共 {data.count} 台
        </span>
      </div>
      {devices.length === 0 ? (
        <Empty description={`近 ${days} 天无不活跃设备`} />
      ) : (
        <Table
          columns={columns}
          dataSource={devices}
          rowKey="deviceId"
          size="small"
          pagination={false}
        />
      )}
    </div>
  )
}
