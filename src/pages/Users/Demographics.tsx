import { Empty } from 'antd'
import {
  DistributionBar,
  DistributionPie,
} from '../../components/analytics/DistributionCharts'
import type { UsersDemographicsResponse } from '../../types/analytics'

const AGE_LABELS: Record<string, string> = {
  '0-3': '0-3 岁',
  '3-6': '3-6 岁',
  '6-9': '6-9 岁',
  '9+': '9 岁以上',
  unknown: '未知',
}
const AGE_ORDER = ['0-3', '3-6', '6-9', '9+', 'unknown']

/**
 * 孩子 / 设备画像分布图：统计单位是设备与孩子档案，不是家长账号。
 * PII 红线：只展示聚合计数，无个体信息。
 */
export default function Demographics({
  data,
}: {
  data: UsersDemographicsResponse
}) {
  const ageData = AGE_ORDER.map(
    (key) => data.ageDistribution.find((a) => a.range === key)?.devices ?? 0,
  )

  const genderData = [
    { name: '男孩', value: data.genderSplit.male },
    { name: '女孩', value: data.genderSplit.female },
    { name: '未设置', value: data.genderSplit.unset },
  ]

  const characterData = data.characterKeySplit.map((c) => ({
    name: c.characterKey,
    value: c.devices,
  }))

  const bindingData = data.bindingsPerDevice.map((b) => ({
    name: `${b.count} 个家庭`,
    value: b.devices,
  }))

  const isEmpty =
    ageData.every((v) => v === 0) && characterData.every((c) => c.value === 0)
  if (isEmpty) {
    return <Empty description="暂无设备画像数据" />
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 16,
      }}
    >
      <DistributionBar
        caption="孩子年龄段分布（按设备）"
        categories={AGE_ORDER.map((k) => AGE_LABELS[k] ?? k)}
        values={ageData}
        unit="台"
      />
      <DistributionPie
        caption="孩子性别分布（按孩子档案）"
        seriesName="性别"
        items={genderData}
        unit="台"
      />
      <DistributionPie
        caption="IP 型号分布（按设备）"
        seriesName="型号"
        items={characterData}
        unit="台"
      />
      <DistributionBar
        caption="每台设备绑定家庭数（按设备）"
        categories={bindingData.map((b) => b.name)}
        values={bindingData.map((b) => b.value)}
        unit="台"
      />
    </div>
  )
}
