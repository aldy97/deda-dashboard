import { useCallback, useEffect, useState } from 'react'
import { Alert, Col, Row, Statistic, Table, Typography } from 'antd'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import { fetchLlmTurnHandoff } from '../../api/analytics'
import type { LlmTurnHandoffResponse } from '../../types/analytics'
import InfoTip from '../../components/InfoTip'
import { formatMs } from './scenes'

/**
 * 轮次衔接健康度（防死空气，生成侧口径）：
 * gapMs = chat_main 首包时刻 − filler 生成完成时刻。
 * gap > 0 表示 filler 生成完后大模型还没出首包——能否盖住取决于 filler
 * 音频播放时长（不在 llm_usage_logs，为估算口径）；gap ≤ 0 覆盖良好。
 * filler 缺失轮（静默降级）单独计数：这些轮次没有任何缓冲。
 */
export default function TurnHandoffCard({
  startDate,
  endDate,
}: {
  startDate: string
  endDate: string
}) {
  const [data, setData] = useState<LlmTurnHandoffResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (s: string, e: string) => {
    setError(null)
    try {
      setData(await fetchLlmTurnHandoff({ startDate: s, endDate: e }))
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    }
  }, [])

  useEffect(() => {
    void load(startDate, endDate)
  }, [load, startDate, endDate])

  if (error) {
    return (
      <Alert
        type="error"
        showIcon
        message="轮次衔接数据加载失败"
        description={error}
      />
    )
  }
  if (!data) return null

  const gapRatePct =
    data.gapRate === null ? null : Math.round(data.gapRate * 1000) / 10

  return (
    <div>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        gap = 主模型首包时刻 − 过渡语生成完成时刻（生成侧口径，非设备播放侧真实死空气）
        <InfoTip title="gap ≤ 0：过渡语还没生成完，主模型首包已就位，覆盖良好。gap > 0：过渡语已生成完、主模型首包未到——这段时间靠过渡语音频播放时长覆盖，播放完仍有剩余即死空气。filler 缺失轮（静默降级）没有任何缓冲，需单独盯。" />
      </Typography.Text>
      <Row gutter={24} style={{ margin: '12px 0' }}>
        <Col>
          <Statistic
            title="空窗轮占比"
            value={gapRatePct === null ? '—' : `${gapRatePct}%`}
          />
        </Col>
        <Col>
          <Statistic title="gap P50" value={formatMs(data.gapP50Ms)} />
        </Col>
        <Col>
          <Statistic title="gap P90" value={formatMs(data.gapP90Ms)} />
        </Col>
        <Col>
          <Statistic
            title="filler 缺失轮 / 总轮数"
            value={`${data.turnsMissingFiller} / ${data.turnsWithChat}`}
          />
        </Col>
      </Row>
      <Table
        size="small"
        rowKey="turnId"
        dataSource={data.topGaps}
        pagination={false}
        locale={{ emptyText: '所选区间暂无双样本轮次' }}
        columns={[
          {
            title: '轮次',
            dataIndex: 'turnId',
            width: 140,
            render: (turnId: string) => (
              <Link to={`/messages?turnId=${turnId}`}>
                {turnId.slice(0, 8)}…
              </Link>
            ),
          },
          {
            title: 'gap',
            dataIndex: 'gapMs',
            width: 110,
            align: 'right',
            render: (v: number) => formatMs(v),
          },
          {
            title: '发生时间',
            dataIndex: 'createdAt',
            render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss'),
          },
        ]}
      />
    </div>
  )
}
