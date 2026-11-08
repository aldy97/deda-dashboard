import { Progress, Table, Tag, Tooltip } from 'antd'
import type { LlmSummaryResponse } from '../../types/analytics'
import {
  FAILURE_REASON_META,
  SCENE_META,
  failureReasonLabel,
  formatMs,
  sceneLabel,
} from './scenes'

/**
 * 场景总览表：每场景一行的调用量 / 成功率 / 延迟 / 首包 / token / 失败 Top1。
 * fail-open 场景（安全分类、过渡语）带「静默降级」徽标：成功率跌不会报错，必须盯这里。
 */
export default function SceneSummaryTable({
  data,
}: {
  data: LlmSummaryResponse
}) {
  return (
    <Table
      size="small"
      rowKey="scene"
      dataSource={data.scenes}
      pagination={false}
      columns={[
        {
          title: '场景',
          dataIndex: 'scene',
          width: 200,
          render: (scene: string, row) => {
            const meta = SCENE_META[scene]
            return (
              <span>
                {sceneLabel(scene)}{' '}
                <Tag color={row.tier === 'small' ? 'geekblue' : 'gold'}>
                  {row.tier === 'small' ? '小模型' : '主模型'}
                </Tag>
                {meta?.failOpen && (
                  <Tooltip title="静默降级：失败不报错但质量下降，成功率必须盯紧">
                    <Tag color="volcano">静默降级</Tag>
                  </Tooltip>
                )}
              </span>
            )
          },
        },
        {
          title: '调用量',
          dataIndex: 'calls',
          width: 90,
          align: 'right',
        },
        {
          title: '成功率',
          dataIndex: 'successRate',
          width: 180,
          render: (rate: number | null) =>
            rate === null ? (
              '—'
            ) : (
              <Progress
                percent={Math.round(rate * 1000) / 10}
                size="small"
                status={rate < 0.95 ? 'exception' : undefined}
                style={{ marginBottom: 0 }}
              />
            ),
        },
        {
          title: '延迟 P50 / P90',
          key: 'latency',
          width: 150,
          align: 'right',
          render: (_, row) =>
            `${formatMs(row.p50LatencyMs)} / ${formatMs(row.p90LatencyMs)}`,
        },
        {
          title: '首包 P50 / P90',
          key: 'ttft',
          width: 150,
          align: 'right',
          render: (_, row) => {
            if (!SCENE_META[row.scene]?.streaming) return '—'
            return `${formatMs(row.p50FirstTokenMs)} / ${formatMs(row.p90FirstTokenMs)}`
          },
        },
        {
          title: '总 Token',
          dataIndex: 'totalTokens',
          width: 110,
          align: 'right',
          render: (v: number) => v.toLocaleString(),
        },
        {
          title: '失败 Top1',
          key: 'topFailure',
          width: 130,
          render: (_, row) => {
            const top = row.failureBreakdown[0]
            if (!top) return '—'
            return (
              <Tag color={FAILURE_REASON_META[top.reason]?.color ?? 'default'}>
                {failureReasonLabel(top.reason)} × {top.count}
              </Tag>
            )
          },
        },
      ]}
    />
  )
}
