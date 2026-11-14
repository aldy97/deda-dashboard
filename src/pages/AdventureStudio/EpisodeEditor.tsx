import { Button, Input, Space, Typography } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import type {
  CapabilitiesResponse,
  EpisodeContent,
  EpisodeSegment,
  LintReport,
} from '../../types/adventureAdmin'
import SegmentEditor from './SegmentEditor'

/**
 * 整集内容的编辑表单（受控组件：value + onChange，状态由 EpisodeWorkspace 持有）。
 *
 * 段落顺序只允许上移 / 下移 / 删除，序号一律按位置重新编号。引擎要求 order 严格
 * 0..n-1 连续（它用 order >= segments.length 判完集），一旦断档，孩子会在中途
 * 被判定「这一集播完了」——所以这里从交互上就不给出填号的机会。
 *
 * 切换段落类型 / 交互原语时主动清掉不再适用的字段。留着脏字段不会报错，
 * 但会静默进入下一次发布的快照，让「这一段到底是什么」在事后无法判断。
 */
interface Props {
  value: EpisodeContent
  capabilities: CapabilitiesResponse
  /** 服务端 lint 结论；按 segmentOrder 分发到各段，集级问题由父组件的 LintPanel 呈现 */
  lint: LintReport | null
  disabled?: boolean
  onChange: (next: EpisodeContent) => void
}

/** 序号按位置重排，保证 order 永远严格 0..n-1 连续 */
function reindex(segments: EpisodeSegment[]): EpisodeSegment[] {
  return segments.map((segment, index) => ({ ...segment, order: index }))
}

function newSegment(
  kind: EpisodeSegment['kind'],
  order: number,
): EpisodeSegment {
  return {
    order,
    kind,
    text: '',
    interactionType: kind === 'interaction' ? 'open_question' : null,
    options: null,
    // 需要孩子开口的原语必须有兜底与退出话术；先给空串占位，
    // 让创作者看到这两个框（lint 会拦发布，但不该靠报错来教人有哪些字段）。
    fallbackText: kind === 'interaction' ? '' : null,
    exitText: kind === 'interaction' ? '' : null,
    rewardStar: false,
  }
}

export default function EpisodeEditor({
  value,
  capabilities,
  lint,
  disabled = false,
  onChange,
}: Props) {
  const segments = value.segments ?? []
  const titleLimit = capabilities.lintThresholds.maxTitleChars
  const issuesFor = (index: number) =>
    (lint?.issues ?? []).filter((issue) => issue.segmentOrder === index)

  const patchSegments = (next: EpisodeSegment[]) =>
    onChange({ ...value, segments: reindex(next) })

  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      <div>
        <Typography.Text strong style={{ fontSize: 13 }}>
          集标题
        </Typography.Text>
        <Input
          value={value.title}
          disabled={disabled}
          maxLength={titleLimit + 40}
          onChange={(event) => onChange({ ...value, title: event.target.value })}
          placeholder="家长端与看板列表里看到的名字"
          style={{ marginTop: 4 }}
        />
        <Typography.Text
          type={value.title.length > titleLimit ? 'danger' : 'secondary'}
          style={{ fontSize: 12 }}
        >
          {value.title.length} / {titleLimit} 字
        </Typography.Text>
      </div>

      <div>
        <Typography.Text strong style={{ fontSize: 13 }}>
          开场回顾（可选）
        </Typography.Text>
        <Input.TextArea
          rows={2}
          value={value.recap ?? ''}
          disabled={disabled}
          onChange={(event) => onChange({ ...value, recap: event.target.value })}
          placeholder="孩子可能是第二天接着玩的，这一句帮他想起来上次到哪了"
          style={{ marginTop: 4 }}
        />
      </div>

      <div>
        <Space size={8} style={{ marginBottom: 8 }} wrap>
          <Typography.Text strong style={{ fontSize: 13 }}>
            段落（{segments.length}）
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            顺序即播放顺序，序号自动连续编号
          </Typography.Text>
          <Button
            size="small"
            icon={<PlusOutlined />}
            disabled={disabled}
            onClick={() =>
              patchSegments([...segments, newSegment('narration', segments.length)])
            }
          >
            加旁白
          </Button>
          <Button
            size="small"
            icon={<PlusOutlined />}
            disabled={disabled}
            onClick={() =>
              patchSegments([
                ...segments,
                newSegment('interaction', segments.length),
              ])
            }
          >
            加互动
          </Button>
        </Space>

        {segments.length === 0 && (
          <Typography.Paragraph type="secondary">
            还没有段落。一集至少需要一段可用内容——空壳集自己发布不出去（lint 的
            NO_SEGMENTS 会挡着），而且一旦落地就会让之后每一次跨环境导入都卡住。
          </Typography.Paragraph>
        )}

        {segments.map((segment, index) => (
          <SegmentEditor
            key={index}
            segment={segment}
            index={index}
            total={segments.length}
            capabilities={capabilities}
            issues={issuesFor(index)}
            disabled={disabled}
            onChange={(next) =>
              patchSegments(segments.map((item, i) => (i === index ? next : item)))
            }
            onMove={(direction) => {
              const target = index + direction
              if (target < 0 || target >= segments.length) return
              const swapped = [...segments]
              const [moved] = swapped.splice(index, 1)
              swapped.splice(target, 0, moved)
              patchSegments(swapped)
            }}
            onRemove={() => patchSegments(segments.filter((_, i) => i !== index))}
          />
        ))}
      </div>
    </Space>
  )
}
