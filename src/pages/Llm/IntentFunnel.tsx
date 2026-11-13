import { Progress, Typography } from 'antd'
import type { IntentSummaryResponse } from '../../types/analytics'
import { buildIntentStages, formatDecisionRate } from './decisions'

const STAGE_COLOR: Record<string, string> = {
  routed: '#1677ff',
  model: '#52c41a',
  rule: '#13c2c2',
  fallback: '#fa541c',
}

/**
 * 意图决策路径：进入路由 → 小模型给结论 / 规则接管 / 关键词兜底。
 *
 * 用 Progress 条而非 echarts 漏斗：四层是包含关系但不是等比缩放，
 * 条形 + 显式计数与占比更容易读出「模型到底管了多少轮」。
 * total 层刻意不渲染（概览卡已有「判定轮次」，同一数字出现两次只会互相干扰）。
 *
 * 排查「孩子说要听故事却在闲聊」时看 rule 层：pre_filter_skip 占比过高
 * 说明路由词表覆盖不足，孩子说了意图但正则没命中，直接被判成自由聊天。
 */
export default function IntentFunnel({
  summary,
}: {
  summary: IntentSummaryResponse
}) {
  const stages = buildIntentStages(summary).filter((stage) => stage.key !== 'total')

  return (
    <div>
      {stages.map((stage) => (
        <div key={stage.key} style={{ marginBottom: 14 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: 12,
            }}
          >
            <Typography.Text strong>{stage.label}</Typography.Text>
            <Typography.Text style={{ whiteSpace: 'nowrap' }}>
              <span data-testid={`intent-stage-count-${stage.key}`}>
                {stage.count.toLocaleString('en-US')}
              </span>
              <Typography.Text type="secondary"> 轮 · 占判定总数 </Typography.Text>
              <span data-testid={`intent-stage-rate-${stage.key}`}>
                {formatDecisionRate(stage.rate)}
              </span>
            </Typography.Text>
          </div>
          <Progress
            percent={stage.rate === null ? 0 : Math.round(stage.rate * 1000) / 10}
            showInfo={false}
            size="small"
            strokeColor={STAGE_COLOR[stage.key]}
          />
          <div data-testid={`intent-stage-desc-${stage.key}`}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {stage.description}
            </Typography.Text>
          </div>
        </div>
      ))}
    </div>
  )
}
