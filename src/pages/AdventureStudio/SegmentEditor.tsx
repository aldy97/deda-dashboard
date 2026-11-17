import {
  Button,
  Card,
  Checkbox,
  Input,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd'
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import type {
  CapabilitiesResponse,
  EpisodeSegment,
  LintIssue,
  TwoChoiceOption,
} from '../../types/adventureAdmin'
import { interactionLabel, segmentKindLabel } from './labels'

/**
 * 单个段落的编辑表单。
 *
 * 字段按 interactionType 分支显示，分支的依据是 capabilities 下发的
 * replyWaitingInteractionTypes——「哪些原语需要孩子开口、因而必须有兜底与退出话术」
 * 是服务端的口径，前端不自己判定。
 *
 * `order` 刻意不做成可输入的数字框：引擎要求 order 严格 0..n-1 连续，
 * 人手填号必然会填出断档（lint 会报 SEGMENT_ORDER_NOT_CONTIGUOUS），
 * 所以这里只提供上移/下移/删除，序号由父组件按位置重新编号。
 * 显示出来的 `#order` 与 lint 报告、差异视图里的编号同源，三处对得上。
 */
interface Props {
  segment: EpisodeSegment
  index: number
  total: number
  capabilities: CapabilitiesResponse
  /** 已按 segmentOrder 过滤好的本段问题 */
  issues: LintIssue[]
  disabled?: boolean
  onChange: (next: EpisodeSegment) => void
  onMove: (direction: -1 | 1) => void
  onRemove: () => void
}

const EMPTY_CHOICE: TwoChoiceOption = { key: '', text: '', reply: '' }

export default function SegmentEditor({
  segment,
  index,
  total,
  capabilities,
  issues,
  disabled = false,
  onChange,
  onMove,
  onRemove,
}: Props) {
  const isInteraction = segment.kind === 'interaction'
  const interactionType = segment.interactionType ?? null
  const waitsForReply =
    interactionType !== null &&
    capabilities.replyWaitingInteractionTypes.includes(interactionType)
  const textLimit = isInteraction
    ? capabilities.lintThresholds.maxInteractionTextChars
    : capabilities.lintThresholds.maxNarrationTextChars

  const patch = (next: Partial<EpisodeSegment>) => onChange({ ...segment, ...next })

  const choices = segment.options?.choices ?? []

  const patchChoice = (at: number, next: Partial<TwoChoiceOption>) => {
    const updated = choices.map((choice, i) =>
      i === at ? { ...choice, ...next } : choice,
    )
    patch({ options: { ...segment.options, choices: updated } })
  }

  return (
    <Card
      size="small"
      style={{ marginBottom: 12 }}
      styles={{
        body: { padding: 12 },
      }}
      title={
        <Space size={6} wrap>
          <Typography.Text style={{ fontFamily: 'monospace' }}>#{index}</Typography.Text>
          <Tag color={isInteraction ? 'green' : 'blue'}>
            {segmentKindLabel(segment.kind)}
          </Tag>
          {isInteraction && interactionType && (
            <Tag color="geekblue">{interactionLabel(interactionType)}</Tag>
          )}
          {segment.rewardStar && <Tag color="gold">奖励 1 颗星</Tag>}
          {issues.length > 0 && (
            <Tag color={issues.some((issue) => issue.severity === 'error') ? 'red' : 'orange'}>
              {issues.length} 条问题
            </Tag>
          )}
        </Space>
      }
      extra={
        <Space size={4}>
          <Button
            size="small"
            type="text"
            icon={<ArrowUpOutlined />}
            disabled={disabled || index === 0}
            onClick={() => onMove(-1)}
          />
          <Button
            size="small"
            type="text"
            icon={<ArrowDownOutlined />}
            disabled={disabled || index === total - 1}
            onClick={() => onMove(1)}
          />
          <Button
            size="small"
            type="text"
            danger
            icon={<DeleteOutlined />}
            disabled={disabled}
            onClick={onRemove}
          />
        </Space>
      }
    >
      <Space orientation="vertical" size={10} style={{ width: '100%' }}>
        <Space size={8} wrap>
          <Select
            style={{ width: 130 }}
            value={segment.kind}
            disabled={disabled}
            onChange={(value) =>
              patch({
                kind: value,
                // 切成旁白时把互动专属字段清掉：留着脏字段不会报错，
                // 但会在下一次发布时静默进快照，让「这一段到底是什么」变得含糊。
                ...(value === 'narration'
                  ? { interactionType: null, options: null }
                  : {}),
              })
            }
            options={capabilities.segmentKinds.map((kind) => ({
              value: kind,
              label: segmentKindLabel(kind),
            }))}
          />
          {isInteraction && (
            <Select
              style={{ width: 170 }}
              placeholder="选择交互原语"
              value={interactionType ?? undefined}
              disabled={disabled}
              onChange={(value) =>
                patch({
                  interactionType: value,
                  // 换原语时清掉上一个原语的专属字段，避免 choices 与 praise 同时存在
                  options:
                    value === 'two_choice'
                      ? { choices: choices.length > 0 ? choices : [{ ...EMPTY_CHOICE }] }
                      : value === 'repeat_after_me'
                        ? { praise: segment.options?.praise ?? '' }
                        : null,
                })
              }
              options={capabilities.interactionTypes.map((type) => ({
                value: type,
                label: `${interactionLabel(type)}${
                  capabilities.replyWaitingInteractionTypes.includes(type)
                    ? '（需孩子开口）'
                    : ''
                }`,
              }))}
            />
          )}
          <Checkbox
            checked={segment.rewardStar === true}
            disabled={disabled}
            onChange={(event) => patch({ rewardStar: event.target.checked })}
          >
            通过这一段奖励一颗星
          </Checkbox>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            单集星光上限 {capabilities.lintThresholds.maxStarsPerEpisode} 颗
          </Typography.Text>
        </Space>

        <div>
          <Input.TextArea
            rows={isInteraction ? 2 : 3}
            value={segment.text}
            disabled={disabled}
            onChange={(event) => patch({ text: event.target.value })}
            placeholder={
              isInteraction
                ? '互动引导词：问孩子什么（要短，孩子听完就要作答）'
                : '旁白原文：这一段说给孩子听的话'
            }
          />
          <Typography.Text
            type={segment.text.length > textLimit ? 'danger' : 'secondary'}
            style={{ fontSize: 12 }}
          >
            {segment.text.length} / {textLimit} 字
            {isInteraction ? '（互动引导词上限）' : '（旁白上限）'}
          </Typography.Text>
        </div>

        {isInteraction && interactionType === 'two_choice' && (
          <div>
            <Space size={6} style={{ marginBottom: 6 }}>
              <Typography.Text strong style={{ fontSize: 13 }}>
                两个选项
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                key 至少 {capabilities.lintThresholds.minChoiceKeyChars} 字（引擎用
                includes 匹配，单字符几乎必误命中）；reply 是孩子选了之后立刻听到的接话
              </Typography.Text>
            </Space>
            <Space orientation="vertical" size={6} style={{ width: '100%' }}>
              {choices.map((choice, at) => (
                <Space key={at} size={6} wrap>
                  <Input
                    style={{ width: 110 }}
                    addonBefore="key"
                    value={choice.key}
                    disabled={disabled}
                    onChange={(event) => patchChoice(at, { key: event.target.value })}
                  />
                  <Input
                    style={{ width: 220 }}
                    addonBefore="选项"
                    value={choice.text}
                    disabled={disabled}
                    onChange={(event) => patchChoice(at, { text: event.target.value })}
                  />
                  <Input
                    style={{ width: 320 }}
                    addonBefore="接话"
                    value={choice.reply}
                    disabled={disabled}
                    onChange={(event) => patchChoice(at, { reply: event.target.value })}
                  />
                  <Button
                    size="small"
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    disabled={disabled}
                    onClick={() =>
                      patch({
                        options: {
                          ...segment.options,
                          choices: choices.filter((_, i) => i !== at),
                        },
                      })
                    }
                  />
                </Space>
              ))}
              <Button
                size="small"
                icon={<PlusOutlined />}
                disabled={disabled}
                onClick={() =>
                  patch({
                    options: { ...segment.options, choices: [...choices, { ...EMPTY_CHOICE }] },
                  })
                }
              >
                加一个选项
              </Button>
            </Space>
          </div>
        )}

        {isInteraction && interactionType === 'repeat_after_me' && (
          <div>
            <Typography.Text strong style={{ fontSize: 13 }}>
              孩子念对之后的表扬
            </Typography.Text>
            <Input
              value={segment.options?.praise ?? ''}
              disabled={disabled}
              onChange={(event) =>
                patch({ options: { ...segment.options, praise: event.target.value } })
              }
              placeholder="例如：哇，你说得真清楚！"
              style={{ marginTop: 4 }}
            />
          </div>
        )}

        {waitsForReply && (
          <Space orientation="vertical" size={8} style={{ width: '100%' }}>
            <div>
              <Typography.Text strong style={{ fontSize: 13 }}>
                兜底话术（必填）
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12, marginLeft: 6 }}>
                孩子跑题、沉默或不配合时说的话——没有它，孩子开口那一刻就可能没有回应
              </Typography.Text>
              <Input.TextArea
                rows={2}
                value={segment.fallbackText ?? ''}
                disabled={disabled}
                onChange={(event) => patch({ fallbackText: event.target.value })}
                style={{ marginTop: 4 }}
              />
            </div>
            <div>
              <Typography.Text strong style={{ fontSize: 13 }}>
                退出话术（必填）
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12, marginLeft: 6 }}>
                孩子明确说「不要」时的温柔收尾，不逼、不重复问
              </Typography.Text>
              <Input.TextArea
                rows={2}
                value={segment.exitText ?? ''}
                disabled={disabled}
                onChange={(event) => patch({ exitText: event.target.value })}
                style={{ marginTop: 4 }}
              />
            </div>
          </Space>
        )}

        {issues.length > 0 && (
          <Space orientation="vertical" size={2}>
            {issues.map((issue, at) => (
              <Typography.Text
                key={`${issue.code}-${at}`}
                type={issue.severity === 'error' ? 'danger' : 'warning'}
                style={{ fontSize: 12 }}
              >
                <Typography.Text code style={{ fontSize: 11 }}>
                  {issue.code}
                </Typography.Text>{' '}
                {issue.message}
              </Typography.Text>
            ))}
          </Space>
        )}
      </Space>
    </Card>
  )
}
