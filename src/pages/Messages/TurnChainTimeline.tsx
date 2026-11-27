import { Tag, Typography } from 'antd'
import dayjs from 'dayjs'
import {
  FAILURE_REASON_META,
  SCENE_META,
  failureReasonLabel,
  formatMs,
  sceneLabel,
} from '../Llm/scenes'
import type { TurnChainLayout, TurnChainRow } from './turn-chain-layout'

const formatTime = (iso: string) => dayjs(iso).format('HH:mm:ss.SSS')

const LABEL_WIDTH = 104
const LABEL_GAP = 8

function barColor(row: TurnChainRow): string {
  if (row.call.success) return '#52c41a'
  // fail-open 场景失败是设计内降级：标警告而非错误
  return SCENE_META[row.call.scene]?.failOpen ? '#faad14' : '#ff4d4f'
}

/** 首包等待段占整条的比例；没有首包或零宽条时不拆段 */
function ttftSharePct(row: TurnChainRow): number | null {
  if (
    row.ttftPct === null ||
    row.leftPct === null ||
    row.widthPct === null ||
    row.widthPct === 0
  ) {
    return null
  }
  return Math.min(100, Math.max(0, ((row.ttftPct - row.leftPct) / row.widthPct) * 100))
}

function TurnChainRowView({
  row,
  labels,
}: {
  row: TurnChainRow
  labels: Map<string, string>
}) {
  const call = row.call
  const meta = SCENE_META[call.scene]
  const color = barColor(row)
  const share = ttftSharePct(row)
  const parallelNames = row.parallelWith.map((id) => labels.get(id) ?? id)
  const durationText =
    row.durationMs === null ? '耗时未知' : `耗时 ${formatMs(row.durationMs)}`

  return (
    <div
      role="group"
      aria-label={`${sceneLabel(call.scene)}，${durationText}`}
      style={{ marginBottom: 12 }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `${LABEL_WIDTH}px 1fr`,
          columnGap: LABEL_GAP,
          alignItems: 'center',
        }}
      >
        <div
          title={sceneLabel(call.scene)}
          style={{
            fontSize: 12,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {parallelNames.length > 0 && (
            <span
              title={`与「${parallelNames.join('、')}」并行`}
              style={{ color: '#8c8c8c', marginRight: 4 }}
            >
              ∥
            </span>
          )}
          {sceneLabel(call.scene)}
        </div>
        <div
          style={{
            position: 'relative',
            height: 10,
            background: '#f0f0f0',
            borderRadius: 5,
          }}
        >
          {row.leftPct !== null && row.widthPct !== null && (
            <div
              style={{
                position: 'absolute',
                left: `${row.leftPct}%`,
                width: `${row.widthPct}%`,
                minWidth: 2,
                top: 0,
                bottom: 0,
                display: 'flex',
                borderRadius: 5,
                overflow: 'hidden',
              }}
            >
              {share !== null && (
                <div
                  title={`首包等待 ${formatMs(call.firstTokenMs)}`}
                  style={{
                    width: `${share}%`,
                    background: color,
                    opacity: 0.35,
                  }}
                />
              )}
              <div style={{ flex: 1, background: color }} />
            </div>
          )}
        </div>
      </div>
      <div
        style={{
          marginLeft: LABEL_WIDTH + LABEL_GAP,
          marginTop: 4,
          fontSize: 12,
        }}
      >
        <Tag color={call.tier === 'small' ? 'geekblue' : 'gold'}>
          {call.tier === 'small' ? '小模型' : '主模型'}
        </Tag>
        {call.success ? (
          <Tag color="success">成功</Tag>
        ) : (
          <Tag
            color={
              FAILURE_REASON_META[call.failureReason ?? '']?.color ?? 'default'
            }
          >
            {failureReasonLabel(call.failureReason)}
            {meta?.failOpen ? '（已静默降级）' : ''}
          </Tag>
        )}
        <Typography.Text type="secondary">
          {durationText}
          {call.firstTokenMs !== null &&
            ` · 首包 ${formatMs(call.firstTokenMs)}`}
          {call.totalTokens !== null && ` · ${call.totalTokens} tokens`}
          {` · ${call.model} · ${formatTime(call.createdAt)}`}
        </Typography.Text>
      </div>
      {!call.success && call.failureDetail && (
        <div
          style={{
            marginLeft: LABEL_WIDTH + LABEL_GAP,
            marginTop: 4,
            padding: '4px 8px',
            background: '#fff1f0',
            borderRadius: 4,
            color: '#cf1322',
            fontSize: 12,
            wordBreak: 'break-all',
          }}
        >
          {call.failureDetail}
        </div>
      )}
    </div>
  )
}

/**
 * 单轮 LLM 调用链路的横向时间轴：每条调用按真实毫秒比例绘制，
 * 并发（区间相交）自然呈现为同一水平段，而不是竖排时间线的先后错觉。
 */
export default function TurnChainTimeline({
  layout,
}: {
  layout: TurnChainLayout
}) {
  const labels = new Map(
    layout.rows.map((row) => [row.call.id, sceneLabel(row.call.scene)]),
  )

  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `${LABEL_WIDTH}px 1fr`,
          columnGap: LABEL_GAP,
          marginBottom: 8,
        }}
      >
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          最早调用 +0ms
        </Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          总跨度 {formatMs(layout.totalMs)}
        </Typography.Text>
      </div>
      {layout.rows.map((row) => (
        <TurnChainRowView key={row.call.id} row={row} labels={labels} />
      ))}
    </div>
  )
}
