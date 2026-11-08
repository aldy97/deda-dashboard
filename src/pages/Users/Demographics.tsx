import { Empty } from 'antd'
import ReactECharts from 'echarts-for-react'
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
 * 用户画像分布图：年龄段柱状 + 性别饼图 + IP 型号饼图 + 家庭绑定结构柱状。
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

  const pieOption = (title: string, items: Array<{ name: string; value: number }>) => ({
    tooltip: { trigger: 'item', formatter: '{b}: {c} 台（{d}%）' },
    legend: { bottom: 0 },
    series: [
      {
        name: title,
        type: 'pie',
        radius: ['40%', '65%'],
        center: ['50%', '45%'],
        label: { formatter: '{b}\n{c} 台' },
        data: items,
      },
    ],
  })

  const barOption = (
    categories: string[],
    values: number[],
  ) => ({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 48, right: 24, top: 24, bottom: 56 },
    xAxis: { type: 'category', data: categories, axisLabel: { interval: 0 } },
    yAxis: { type: 'value', name: '设备数', minInterval: 1 },
    series: [
      {
        type: 'bar',
        barMaxWidth: 48,
        label: { show: true, position: 'top' },
        itemStyle: { color: '#1677ff', borderRadius: [4, 4, 0, 0] },
        data: values,
      },
    ],
  })

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 16,
      }}
    >
      <div>
        <ReactECharts
          notMerge
          style={{ height: 260 }}
          option={barOption(
            AGE_ORDER.map((k) => AGE_LABELS[k] ?? k),
            ageData,
          )}
        />
        <div style={{ textAlign: 'center', color: 'rgba(0,0,0,0.45)' }}>
          孩子年龄段分布
        </div>
      </div>
      <div>
        <ReactECharts
          notMerge
          style={{ height: 260 }}
          option={pieOption('性别', genderData)}
        />
        <div style={{ textAlign: 'center', color: 'rgba(0,0,0,0.45)' }}>
          性别分布
        </div>
      </div>
      <div>
        <ReactECharts
          notMerge
          style={{ height: 260 }}
          option={pieOption('型号', characterData)}
        />
        <div style={{ textAlign: 'center', color: 'rgba(0,0,0,0.45)' }}>
          IP 型号分布
        </div>
      </div>
      <div>
        <ReactECharts
          notMerge
          style={{ height: 260 }}
          option={barOption(
            bindingData.map((b) => b.name),
            bindingData.map((b) => b.value),
          )}
        />
        <div style={{ textAlign: 'center', color: 'rgba(0,0,0,0.45)' }}>
          每台设备绑定家庭数
        </div>
      </div>
    </div>
  )
}
