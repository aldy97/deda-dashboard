import { Card, Empty } from 'antd'
import ReactECharts from 'echarts-for-react'
import InfoTip from '../../components/InfoTip'
import type { OverviewResponse } from '../../types/analytics'

const STEP_LABELS: Record<string, string> = {
  shipped: '出货',
  activated: '绑定激活',
  firstConversation: '首次对话',
  active7d: '7 日留存',
}

/**
 * 激活漏斗（截至数据日期的累计口径）。
 * shipped 一期无数据（null），自动跳过该级。
 */
export default function FunnelChart({
  funnel,
}: {
  funnel: OverviewResponse['funnel']
}) {
  const steps = (
    [
      ['shipped', funnel.shipped],
      ['activated', funnel.activated],
      ['firstConversation', funnel.firstConversation],
      ['active7d', funnel.active7d],
    ] as const
  )
    .filter(([, value]) => value !== null)
    .map(([key, value]) => ({ key, value: value as number }))

  return (
    <Card
      title={
        <>
          激活漏斗（累计）
          <InfoTip title="截至数据日期的累计转化：绑定激活（有绑定记录）→ 首次对话（有过发言）→ 近 7 日仍活跃。出货一级一期无数据自动隐藏；设备解绑会使「激活」小于「首次对话」，属真实口径，漏斗不重排。" />
        </>
      }
    >
      {steps.length === 0 ? (
        <Empty description="暂无数据" />
      ) : (
        <ReactECharts
          notMerge
          style={{ height: 260 }}
          option={{
            tooltip: { trigger: 'item', formatter: '{b}: {c}' },
            series: [
              {
                type: 'funnel',
                left: '15%',
                width: '70%',
                minSize: '32%',
                maxSize: '100%',
                // 保持业务步骤顺序（激活→首聊→留存），不按数值重排：
                // 设备解绑后 activated 可能小于 firstConversation，属真实数据口径
                sort: 'none',
                gap: 4,
                label: { show: true, position: 'inside', formatter: '{b}: {c}' },
                data: steps.map(({ key, value }) => ({
                  name: STEP_LABELS[key] ?? key,
                  value,
                })),
              },
            ],
          }}
        />
      )}
    </Card>
  )
}
