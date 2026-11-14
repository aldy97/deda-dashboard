import { Typography } from 'antd'
import type { DiffLine } from './diff'
import { diffStat } from './diff'

/**
 * prompt 正文 diff 的渲染。
 *
 * 只用带底色的 <pre> 行、不上 diff 组件库：管理员要看清的是「哪几行变了」，
 * 而 prompt 是发给模型的纯文本，等宽字体 + 行号比语法高亮更有用。
 */

const BACKGROUND: Record<DiffLine['type'], string> = {
  add: '#e6ffed',
  del: '#ffeef0',
  same: 'transparent',
}

const PREFIX: Record<DiffLine['type'], string> = {
  add: '+',
  del: '-',
  same: ' ',
}

export interface PromptDiffProps {
  lines: DiffLine[]
  maxHeight?: number
}

export default function PromptDiff({ lines, maxHeight = 280 }: PromptDiffProps) {
  if (lines.length === 0) {
    return (
      <Typography.Text type="secondary" data-testid="diff-empty">
        两侧正文都为空
      </Typography.Text>
    )
  }

  const stat = diffStat(lines)
  const unchangedOnly = stat.added === 0 && stat.removed === 0

  return (
    <div data-testid="prompt-diff">
      <Typography.Text
        type={unchangedOnly ? 'secondary' : 'warning'}
        style={{ fontSize: 12 }}
        data-testid="diff-stat"
      >
        {unchangedOnly
          ? `两侧正文一致（${stat.unchanged} 行）`
          : `+${stat.added} 行 / -${stat.removed} 行，未变 ${stat.unchanged} 行`}
      </Typography.Text>
      <pre
        style={{
          margin: '6px 0 0',
          padding: 8,
          maxHeight,
          overflow: 'auto',
          background: '#fafafa',
          border: '1px solid #f0f0f0',
          borderRadius: 4,
          fontSize: 12,
          lineHeight: 1.7,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        }}
      >
        {lines.map((line, index) => (
          <div
            // diff 结果是每次重算的新数组，行序即稳定标识
            key={`${line.type}-${line.oldNo ?? ''}-${line.newNo ?? ''}-${index}`}
            data-type={line.type}
            style={{ background: BACKGROUND[line.type] }}
          >
            <span style={{ color: '#bbb', userSelect: 'none' }}>
              {String(line.oldNo ?? '').padStart(4, ' ')}
              {' → '}
              {String(line.newNo ?? '').padStart(4, ' ')}
            </span>
            <span style={{ userSelect: 'none' }}> {PREFIX[line.type]} </span>
            <span>{line.text}</span>
          </div>
        ))}
      </pre>
    </div>
  )
}
