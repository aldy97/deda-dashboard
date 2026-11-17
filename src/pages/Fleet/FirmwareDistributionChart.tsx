import { Empty } from 'antd'
import ReactECharts from 'echarts-for-react'
import type { FleetFirmwareDistributionResponse } from '../../types/analytics'
import InfoTip from '../../components/InfoTip'

/**
 * 固件版本分布饼图。
 * "unknown" 桶用灰色并在 tooltip 标注原因：firmwareVersion 静默不落库问题在 f0f91d7 才修复，
 * 上线初期 unknown 占绝大多数不是 bug。
 */
export default function FirmwareDistributionChart({
  data,
}: {
  data: FleetFirmwareDistributionResponse
}) {
  const { total, buckets } = data
  if (buckets.length === 0) {
    return <Empty description="暂无固件数据" />
  }

  const pieData = buckets.map((b) => ({
    name: b.firmwareVersion,
    value: b.devices,
    itemStyle:
      b.firmwareVersion === 'unknown' ? { color: '#d9d9d9' } : undefined,
  }))

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: (params: { name: string; value: number; percent: string }) => {
        let tip = `${params.name}：${params.value} 台（${params.percent}%）`
        if (params.name === 'unknown') {
          tip +=
            '<br/><span style="color:#999;font-size:11px">firmwareVersion 静默不落库问题在 commit f0f91d7 修复，初期 unknown 占绝大多数非 bug</span>'
        }
        return tip
      },
    },
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'center',
      formatter: (name: string) =>
        name === 'unknown' ? 'unknown（无固件信息）' : name,
    },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['40%', '50%'],
        avoidLabelOverlap: false,
        label: { show: false },
        emphasis: {
          label: { show: true, fontSize: 14, fontWeight: 'bold' },
        },
        data: pieData,
      },
    ],
  }

  return (
    <div>
      <div style={{ marginBottom: 8, color: '#999', fontSize: 13 }}>
        共 {total} 台设备
        {buckets.some((b) => b.firmwareVersion === 'unknown') && (
          <>
            {' · '}
            <InfoTip title="firmwareVersion 静默不落库的问题在服务端 commit f0f91d7 才修复，故上线初期 unknown 占绝大多数不是 bug。" />
          </>
        )}
      </div>
      <ReactECharts option={option} style={{ height: 320 }} notMerge />
    </div>
  )
}
