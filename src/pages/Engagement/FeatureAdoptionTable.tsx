import { Progress, Table } from 'antd'
import { Link } from 'react-router-dom'
import InfoTip from '../../components/InfoTip'
import type { FeatureAdoptionResponse } from '../../types/analytics'

const formatPct = (rate: number | null) =>
  rate === null ? '—' : `${(rate * 100).toFixed(1)}%`

const FEATURE_LINK: Record<string, (start: string, end: string) => string> = {
  adventure: () => '/adventure?tab=episodes',
  english: (s, e) => `/messages?mode=english_chat&startDate=${s}&endDate=${e}`,
  sleep_mode: (s, e) => `/messages?mode=sleep_story&startDate=${s}&endDate=${e}`,
  habit_plan: () => '/content',
}

/**
 * 功能渗透率（单日快照，渗透率分母 = 已激活设备）。
 * 不同功能的附加指标不同：哄睡=开启设备数；冒险=完集率；习惯=平均完成率；英语=活跃设备数。
 */
export default function FeatureAdoptionTable({
  data,
  startDate,
  endDate,
}: {
  data: FeatureAdoptionResponse
  startDate?: string
  endDate?: string
}) {
  return (
    <Table
      size="small"
      rowKey="key"
      dataSource={data.features}
      pagination={false}
      columns={[
        { title: '功能', dataIndex: 'label', width: 110,
          render: (label: string, row) => {
            const href = FEATURE_LINK[row.key]?.(startDate ?? '', endDate ?? '')
            return href ? <Link to={href}>{label}</Link> : label
          },
        },
        {
          title: (
            <>
              渗透率
              <InfoTip title="分母 = 已激活设备（有绑定记录）。分子按功能口径不同：哄睡 = 开启了哄睡配置的设备；冒险 = 有冒险进度记录；习惯打卡 = 有进行中的计划；英语 = 近 30 天有过英语模式发言" />
            </>
          ),
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
          title: (
            <>
              完成率
              <InfoTip title="冒险故事 = 完集（追完整个系列）的设备占比；习惯打卡 = 各设备「已完成天数 ÷ 目标天数」的平均值；哄睡和英语无此指标" />
            </>
          ),
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
