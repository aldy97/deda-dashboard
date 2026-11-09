import { Progress, Table, Tag } from 'antd'
import type { LlmSummaryResponse } from '../../types/analytics'
import InfoTip from '../../components/InfoTip'
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
 * 场景名的 InfoTip 解释来自 SCENE_META（语义与 deda-server 各调用点一致）。
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
                {sceneLabel(scene)}
                {meta && <InfoTip title={meta.description} />}
                <Tag color={row.tier === 'small' ? 'geekblue' : 'gold'}>
                  {row.tier === 'small' ? '小模型' : '主模型'}
                </Tag>
                {meta?.failOpen && (
                  <>
                    <Tag color="volcano">静默降级</Tag>
                    <InfoTip title="该场景失败不报错、走兜底逻辑，质量下降只能从这里成功率发现" />
                  </>
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
          title: (
            <>
              延迟 P50 / P90
              <InfoTip title="口径：请求发出 → 完整响应（流式为末 chunk）。P50 = 半数调用快于此值，P90 = 90% 调用快于此值（看长尾体验）。空响应、失败调用也计入延迟样本。" />
            </>
          ),
          key: 'latency',
          width: 150,
          align: 'right',
          render: (_, row) =>
            `${formatMs(row.p50LatencyMs)} / ${formatMs(row.p90LatencyMs)}`,
        },
        {
          title: (
            <>
              首包 P50 / P90
              <InfoTip title="TTFT：请求发出 → 首个流式 chunk 的耗时，孩子「开口前等待」的直接体验指标。仅流式场景（主对话、首响过渡语）有值，其余场景恒为 —。" />
            </>
          ),
          key: 'ttft',
          width: 150,
          align: 'right',
          render: (_, row) => {
            if (!SCENE_META[row.scene]?.streaming) return '—'
            return `${formatMs(row.p50FirstTokenMs)} / ${formatMs(row.p90FirstTokenMs)}`
          },
        },
        {
          title: (
            <>
              总 Token
              <InfoTip title="该场景区间内全部调用的 prompt + completion token 合计，成本核算依据。上游未回传 usage 的调用按 0 计（如首响过渡语）。" />
            </>
          ),
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
