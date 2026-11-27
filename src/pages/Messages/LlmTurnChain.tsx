import { Alert, Spin, Typography } from 'antd'
import { useLlmCallsByTurn } from '../../api/queries'
import { formatMs } from '../Llm/scenes'
import { buildTurnChainLayout, fillerAnswerGapMs } from './turn-chain-layout'
import TurnChainTimeline from './TurnChainTimeline'

/**
 * 单轮 LLM 调用链路：把一轮问答的安全/意图/filler/记忆/主回答画成共享时间轴，
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

  const layout = calls && calls.length > 0 ? buildTurnChainLayout(calls) : null
  const gapMs = calls ? fillerAnswerGapMs(calls) : null

  return (
    <Spin spinning={loading}>
      {layout && (
        <>
          <TurnChainTimeline layout={layout} />
          {gapMs !== null && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {gapMs >= 0
                ? `防死空气 gap（filler 收尾 → 主回答首包，历史链路）：${formatMs(gapMs)}`
                : `filler 收尾晚于主回答首包，重叠 ${formatMs(-gapMs)}（历史链路）`}
            </Typography.Text>
          )}
        </>
      )}
    </Spin>
  )
}
