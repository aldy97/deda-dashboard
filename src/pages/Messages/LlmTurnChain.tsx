import { Alert, Spin, Tag, Timeline, Typography } from 'antd'
import dayjs from 'dayjs'
import { useLlmCallsByTurn } from '../../api/queries'
import type { LlmTurnCall } from '../../types/analytics'
import {
  FAILURE_REASON_META,
  SCENE_META,
  failureReasonLabel,
  formatMs,
  sceneLabel,
} from '../Llm/scenes'

const formatTime = (iso: string) => dayjs(iso).format('HH:mm:ss.SSS')

/** filler 完毕 → 主回答首包的「防死空气 gap」，两条流式记录都在时才能算 */
function fillerAnswerGapMs(calls: LlmTurnCall[]): number | null {
  const filler = calls.find(
    (c) => c.scene === 'filler' && c.success && c.latencyMs !== null,
  )
  const answer = calls.find(
    (c) => c.scene === 'chat_main' && c.firstTokenMs !== null,
  )
  if (!filler || !answer) return null
  const fillerDoneAt = dayjs(filler.createdAt).valueOf() + filler.latencyMs!
  const answerFirstAt = dayjs(answer.createdAt).valueOf() + answer.firstTokenMs!
  return answerFirstAt - fillerDoneAt
}

function callItem(call: LlmTurnCall) {
  const meta = SCENE_META[call.scene]
  // fail-open 场景失败是设计内降级：标警告而非错误
  const color = call.success ? 'green' : meta?.failOpen ? 'orange' : 'red'
  return {
    color,
    children: (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Typography.Text strong>{sceneLabel(call.scene)}</Typography.Text>
          <Tag color={call.tier === 'small' ? 'geekblue' : 'gold'}>
            {call.tier === 'small' ? '小模型' : '主模型'}
          </Tag>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {call.model}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {formatTime(call.createdAt)}
          </Typography.Text>
        </div>
        <div style={{ marginTop: 4, fontSize: 12 }}>
          {call.success ? (
            <Tag color="success">成功</Tag>
          ) : (
            <Tag color={FAILURE_REASON_META[call.failureReason ?? '']?.color ?? 'default'}>
              {failureReasonLabel(call.failureReason)}
              {meta?.failOpen ? '（已静默降级）' : ''}
            </Tag>
          )}
          <Typography.Text type="secondary">
            耗时 {formatMs(call.latencyMs)}
            {call.firstTokenMs !== null &&
              ` · 首包 ${formatMs(call.firstTokenMs)}`}
            {call.totalTokens !== null && ` · ${call.totalTokens} tokens`}
          </Typography.Text>
          {!call.success && call.failureDetail && (
            <div
              style={{
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
      </div>
    ),
  }
}

/**
 * 单轮 LLM 调用链路：把一轮问答的安全/意图/filler/主回答串成时间线，
 * 用于验证大小模型配合度（fail-open 场景失败在此才可见）。
 */
export default function LlmTurnChain({ turnId }: { turnId: string }) {
  const query = useLlmCallsByTurn(turnId)
  const calls = query.data?.calls ?? null
  const loading = query.isLoading
  const error = query.error
    ? query.error instanceof Error
      ? query.error.message
      : '加载失败'
    : null

  if (error) {
    return (
      <Alert
        type="error"
        showIcon
        message="LLM 调用链路加载失败"
        description={error}
      />
    )
  }

  if (!loading && calls?.length === 0) {
    return (
      <Typography.Text type="secondary">
        本轮暂无 LLM 调用记录（早于 turnId 埋点上线，或该轮未触发模型调用）
      </Typography.Text>
    )
  }

  const gapMs = calls ? fillerAnswerGapMs(calls) : null

  return (
    <Spin spinning={loading}>
      {calls && calls.length > 0 && (
        <>
          <Timeline items={calls.map(callItem)} />
          {gapMs !== null && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              防死空气 gap（filler 收尾 → 主回答首包）：{formatMs(gapMs)}
            </Typography.Text>
          )}
        </>
      )}
    </Spin>
  )
}
