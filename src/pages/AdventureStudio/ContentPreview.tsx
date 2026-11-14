import { Empty, Space, Tag, Timeline, Typography } from 'antd'
import { StarFilled } from '@ant-design/icons'
import type { EpisodeContent, EpisodeSegment } from '../../types/adventureAdmin'
import { interactionLabel, segmentKindLabel } from './labels'

/**
 * 故事集内容的只读渲染。
 *
 * 三处复用：详情抽屉的「查看」态、某个历史版本快照、以及 prod（只读环境）——
 * 后者是常态而不是例外，所以这里不能是「编辑器的降级版」，它本身就是完整体验。
 *
 * 渲染顺序刻意与孩子实际听到的顺序一致（按 order 升序），不做任何折叠或分组：
 * 内容创作者要能一眼从头读到尾，确认这一集听起来是什么样子。
 */
interface Props {
  content: EpisodeContent
  /** 差异对比等窄容器里用：去掉外层留白 */
  compact?: boolean
}

function SegmentBody({ segment }: { segment: EpisodeSegment }) {
  const choices = segment.options?.choices ?? null
  const praise = segment.options?.praise ?? null
  return (
    <Space orientation="vertical" size={4} style={{ width: '100%' }}>
      <Space size={4} wrap>
        <Typography.Text type="secondary" style={{ fontFamily: 'monospace' }}>
          #{segment.order}
        </Typography.Text>
        <Tag color={segment.kind === 'interaction' ? 'green' : 'blue'}>
          {segmentKindLabel(segment.kind)}
        </Tag>
        {segment.kind === 'interaction' && (
          <Tag color="geekblue">
            {interactionLabel(segment.interactionType)}
          </Tag>
        )}
        {segment.rewardStar && (
          <Tag color="gold" icon={<StarFilled />}>
            奖励 1 颗星
          </Tag>
        )}
      </Space>

      <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
        {segment.text || (
          <Typography.Text type="danger">（这一段没有文本）</Typography.Text>
        )}
      </Typography.Paragraph>

      {choices && choices.length > 0 && (
        <Space orientation="vertical" size={2}>
          {choices.map((choice, index) => (
            <Typography.Text key={`${choice.key}-${index}`} type="secondary">
              <Typography.Text code>{choice.key}</Typography.Text>{' '}
              {choice.text}
              {choice.reply ? (
                <>
                  {' '}
                  → 接话：<Typography.Text>{choice.reply}</Typography.Text>
                </>
              ) : (
                <Typography.Text type="danger">（缺接话）</Typography.Text>
              )}
            </Typography.Text>
          ))}
        </Space>
      )}

      {praise && (
        <Typography.Text type="secondary">
          答对后表扬：<Typography.Text>{praise}</Typography.Text>
        </Typography.Text>
      )}

      {(segment.fallbackText || segment.exitText) && (
        <Space orientation="vertical" size={2}>
          {segment.fallbackText && (
            <Typography.Text type="secondary">
              兜底话术（跑题/沉默）：{segment.fallbackText}
            </Typography.Text>
          )}
          {segment.exitText && (
            <Typography.Text type="secondary">
              退出话术（孩子明确拒绝）：{segment.exitText}
            </Typography.Text>
          )}
        </Space>
      )}
    </Space>
  )
}

export default function ContentPreview({ content, compact = false }: Props) {
  const segments = [...(content.segments ?? [])].sort((a, b) => a.order - b.order)

  return (
    <div style={compact ? undefined : { paddingTop: 4 }}>
      <Typography.Title level={5} style={{ marginTop: 0 }}>
        {content.title || <Typography.Text type="danger">（未填标题）</Typography.Text>}
      </Typography.Title>

      {content.recap && (
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
          开场回顾：{content.recap}
        </Typography.Paragraph>
      )}

      {segments.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="这一集还没有任何段落"
        />
      ) : (
        <Timeline
          items={segments.map((segment) => ({
            color: segment.kind === 'interaction' ? 'green' : 'blue',
            children: <SegmentBody segment={segment} />,
          }))}
        />
      )}
    </div>
  )
}
