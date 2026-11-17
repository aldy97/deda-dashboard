import { useState } from 'react'
import { Alert, Button, Descriptions, Space, Tag, Timeline, Typography } from 'antd'
import { PlayCircleOutlined } from '@ant-design/icons'
import { useAdventureSimulate } from '../../api/queries'
import type { ApiError } from '../../api/client'
import type {
  CapabilitiesResponse,
  EpisodeContent,
  EpisodeIdentity,
} from '../../types/adventureAdmin'
import { fmtSeconds, interactionLabel } from './labels'

/**
 * 试播面板：把整集从头走一遍，看孩子实际会听到什么。
 *
 * 与 lint 的分工——lint 回答「这一集合不合规」，试播回答「这一集听起来是什么样」。
 * 后者只有把每一拍连着播的文本、停在哪里等回答、发了几颗星摊开来看才成立，
 * 所以这里刻意用时间线而不是一张汇总表。
 *
 * 试播是 POST 但**不写库**（服务端标了 @ContentReadOnly），只读环境同样可用，
 * 所以它被做成显式触发的按钮而不是随输入自动跑：一次试播要传整集内容，
 * 边打字边传既浪费也没有意义。
 */
interface Props {
  identity: EpisodeIdentity
  content: EpisodeContent
  capabilities: CapabilitiesResponse
}

export default function PreviewSimulator({
  identity,
  content,
  capabilities,
}: Props) {
  const simulate = useAdventureSimulate()
  const [ran, setRan] = useState(false)
  const result = simulate.data ?? null
  const limits = capabilities.simulationThresholds

  const overAwait = result !== null && result.awaitsReplyCount > limits.maxAwaitPoints
  const overDuration = result !== null && result.estimatedSeconds > limits.maxSessionSeconds

  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      <Space size={8} wrap>
        <Button
          icon={<PlayCircleOutlined />}
          loading={simulate.isPending}
          onClick={() => {
            setRan(true)
            simulate.mutate({ identity, content })
          }}
        >
          {ran ? '重新试播' : '试播整集'}
        </Button>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          不写库、不留审计，可以随便点。时长按 4 字/秒估算。
        </Typography.Text>
      </Space>

      {simulate.error && (
        <Alert
          type="error"
          showIcon
          message="试播失败"
          description={(simulate.error as ApiError).message}
        />
      )}

      {result && (
        <>
          <Descriptions
            size="small"
            column={4}
            bordered
            items={[
              {
                key: 'duration',
                label: '预计时长',
                children: (
                  <Typography.Text type={overDuration ? 'danger' : undefined}>
                    {fmtSeconds(result.estimatedSeconds)} / 上限{' '}
                    {fmtSeconds(limits.maxSessionSeconds)}
                  </Typography.Text>
                ),
              },
              {
                key: 'awaits',
                label: '开口次数',
                children: (
                  <Typography.Text type={overAwait ? 'danger' : undefined}>
                    {result.awaitsReplyCount} / 上限 {limits.maxAwaitPoints}
                  </Typography.Text>
                ),
              },
              { key: 'stars', label: '星光总数', children: `${result.totalStars} 颗` },
              {
                key: 'chars',
                label: '播报字数',
                children: `${result.totalSpokenChars} 字`,
              },
            ]}
          />

          {result.problems.length > 0 && (
            <Alert
              type="warning"
              showIcon
              message={`试播发现 ${result.problems.length} 个问题`}
              description={
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {result.problems.map((problem, index) => (
                    <li key={`${problem.code}-${index}`}>
                      <Typography.Text code style={{ fontSize: 11 }}>
                        {problem.code}
                      </Typography.Text>{' '}
                      {problem.message}
                    </li>
                  ))}
                </ul>
              }
            />
          )}

          <Timeline
            items={result.beats.map((beat, index) => ({
              color: beat.waitsForReply ? 'green' : 'blue',
              children: (
                <Space orientation="vertical" size={2} style={{ width: '100%' }}>
                  <Space size={6} wrap>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      第 {index + 1} 拍
                    </Typography.Text>
                    {beat.waitsForReply ? (
                      <Tag color="green">
                        停在 #{beat.stopsAtOrder} 等孩子回答 ·{' '}
                        {interactionLabel(beat.interactionType)}
                      </Tag>
                    ) : (
                      <Tag color="blue">连着播，不等回答</Tag>
                    )}
                    {beat.starsAwarded > 0 && (
                      <Tag color="gold">这一拍发 {beat.starsAwarded} 颗星</Tag>
                    )}
                    <Tag color={beat.outcome === 'episode_complete' ? 'purple' : 'default'}>
                      {beat.outcome === 'episode_complete' ? '这一集播完了' : '等回答'}
                    </Tag>
                  </Space>

                  {beat.says.map((line, lineIndex) => (
                    <Typography.Paragraph
                      key={lineIndex}
                      style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}
                    >
                      {line}
                    </Typography.Paragraph>
                  ))}

                  {beat.choices && beat.choices.length > 0 && (
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      孩子可以选：
                      {beat.choices
                        .map((choice) => `${choice.key}（${choice.text}）`)
                        .join(' / ')}
                    </Typography.Text>
                  )}
                  {beat.praise && (
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      念对了会听到：{beat.praise}
                    </Typography.Text>
                  )}
                </Space>
              ),
            }))}
          />
        </>
      )}
    </Space>
  )
}
