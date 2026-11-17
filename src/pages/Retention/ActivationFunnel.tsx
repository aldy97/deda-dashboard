import { Empty, Space, Tag, Typography } from 'antd'
import ReactECharts from 'echarts-for-react'
import type { ActivationFunnelResponse } from '../../types/analytics'

/**
 * 激活漏斗（区间口径）：区间内激活的设备 → 首次对话 → 7 日 / 30 日留存。
 * shipped 一期恒 null，自动跳过；conversionRates 为逐级转化率，
 * 分母为 0/null 时后端返回 null（不展示该级）。
 */
export default function ActivationFunnel({
  data,
}: {
  data: ActivationFunnelResponse
}) {
  const steps = data.steps.filter(
    (s) => s.value !== null,
  ) as Array<{ key: string; label: string; value: number }>
  const labelOf = (key: string) =>
    data.steps.find((s) => s.key === key)?.label ?? key
  const conversions = data.conversionRates.filter((c) => c.rate !== null)

  if (steps.length === 0) {
    return <Empty description="所选区间暂无激活数据" />
  }

  return (
    <div>
      <ReactECharts
        notMerge
        style={{ height: 260 }}
        option={{
          tooltip: { trigger: 'item', formatter: '{b}: {c} 台' },
          series: [
            {
              type: 'funnel',
              left: '8%',
              width: '84%',
              minSize: '24%',
              maxSize: '100%',
              // 保持业务步骤顺序（激活→首聊→7/30 日留存），不按数值重排
              sort: 'none',
              gap: 4,
              label: { show: true, position: 'inside', formatter: '{b}: {c}' },
              data: steps.map(({ label, value }) => ({ name: label, value })),
            },
          ],
        }}
      />
      {conversions.length > 0 && (
        <Space wrap style={{ marginTop: 8 }}>
          <Typography.Text type="secondary">逐级转化：</Typography.Text>
          {conversions.map((c) => (
            <Tag key={`${c.from}-${c.to}`}>
              {labelOf(c.from)} → {labelOf(c.to)}：
              {((c.rate as number) * 100).toFixed(1)}%
            </Tag>
          ))}
        </Space>
      )}
    </div>
  )
}
