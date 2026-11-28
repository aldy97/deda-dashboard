import { Empty } from 'antd'
import {
  DistributionBar,
  DistributionPie,
} from '../../components/analytics/DistributionCharts'
import type { ParentDemographicsResponse } from '../../types/analytics'

const AGE_LABELS: Record<string, string> = {
  '<18': '<18 岁',
  '18-24': '18-24 岁',
  '25-34': '25-34 岁',
  '35-44': '35-44 岁',
  '45+': '45 岁以上',
  unknown: '未知',
}
const AGE_ORDER = ['<18', '18-24', '25-34', '35-44', '45+', 'unknown']

/**
 * 家长画像：统计单位是家长账号（users 表），与孩子/设备画像严格区分。
 * 生日缺失或非法计入「未知」，不伪造年龄。
 */
export default function ParentDemographics({
  data,
}: {
  data: ParentDemographicsResponse
}) {
  const ageData = AGE_ORDER.map(
    (key) => data.ageDistribution.find((a) => a.range === key)?.users ?? 0,
  )

  const genderData = [
    { name: '爸爸', value: data.genderSplit.male },
    { name: '妈妈', value: data.genderSplit.female },
    { name: '未设置', value: data.genderSplit.unset },
  ]

  if (data.totalUsers === 0) {
    return <Empty description="暂无家长画像数据" />
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 16,
      }}
    >
      <DistributionPie
        caption="家长性别分布（统计单位：家长账号）"
        seriesName="性别"
        items={genderData}
        unit="人"
      />
      <DistributionBar
        caption="家长年龄段分布（统计单位：家长账号）"
        categories={AGE_ORDER.map((k) => AGE_LABELS[k] ?? k)}
        values={ageData}
        unit="人"
      />
    </div>
  )
}
