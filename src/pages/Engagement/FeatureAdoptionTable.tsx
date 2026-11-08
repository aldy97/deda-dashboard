import { Progress, Table } from 'antd'
import type { FeatureAdoptionResponse } from '../../types/analytics'

const formatPct = (rate: number | null) =>
  rate === null ? '—' : `${(rate * 100).toFixed(1)}%`

/**
 * 功能渗透率（单日快照，渗透率分母 = 已激活设备）。
 * 不同功能的附加指标不同：哄睡=开启设备数；冒险=完集率；习惯=平均完成率；英语=活跃设备数。
 */
export default function FeatureAdoptionTable({
  data,
}: {
  data: FeatureAdoptionResponse
}) {
  return (
    <Table
      size="small"
      rowKey="key"
      dataSource={data.features}
      pagination={false}
      columns={[
        { title: '功能', dataIndex: 'label', width: 110 },
        {
          title: '渗透率',
          dataIndex: 'penetrationRate',
          width: 220,
          render: (rate: number | null) =>
            rate === null ? (
              '—'
            ) : (
              <Progress
                percent={Math.round(rate * 1000) / 10}
                size="small"
                style={{ marginBottom: 0 }}
              />
            ),
        },
        {
          title: '设备数',
          key: 'devices',
          width: 90,
          align: 'right',
          render: (_, row) => row.enabledDevices ?? row.activeDevices ?? '—',
        },
        {
          title: '完成率',
          key: 'completion',
          width: 110,
          align: 'right',
          render: (_, row) => {
            const rate = row.completionRate ?? row.avgCompletionRate
            return rate === undefined ? '—' : formatPct(rate)
          },
        },
      ]}
    />
  )
}
