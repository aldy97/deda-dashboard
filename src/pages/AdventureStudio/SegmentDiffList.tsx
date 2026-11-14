import { Empty, Space, Tag, Typography } from 'antd'
import type { SegmentDiff } from '../../types/adventureAdmin'

/**
 * 段级差异列表。两个地方复用：版本对比、导入预览的 replace 明细。
 *
 * 只渲染服务端算好的 SegmentDiff，前端不自己比对内容——哈希与差异口径必须唯一，
 * 否则会出现「界面说改了 3 段、服务端说改了 4 段」这种无法自证的矛盾。
 * before/after 是任意 JSON（options 是嵌套对象），所以统一走 fmtValue 兜底成可读串。
 */

const CHANGE_META: Record<SegmentDiff['change'], { label: string; color: string }> =
  {
    added: { label: '新增段', color: 'green' },
    removed: { label: '删除段', color: 'red' },
    modified: { label: '修改', color: 'orange' },
  }

const FIELD_LABELS: Record<string, string> = {
  kind: '段落类型',
  text: '文本',
  interactionType: '交互原语',
  options: '选项 / 接话',
  fallbackText: '兜底话术',
  exitText: '退出话术',
  rewardStar: '奖励星光',
}

function fmtValue(value: unknown): string {
  if (value === null || value === undefined) return '（空）'
  if (typeof value === 'string') return value === '' ? '（空字符串）' : value
  if (typeof value === 'boolean') return value ? '是' : '否'
  return JSON.stringify(value)
}

export default function SegmentDiffList({
  diffs,
  emptyText = '两个版本逐段一致，没有任何差异',
}: {
  diffs: SegmentDiff[]
  emptyText?: string
}) {
  if (!diffs || diffs.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />
  }

  return (
    <Space orientation="vertical" size={8} style={{ width: '100%' }}>
      {diffs.map((diff, index) => {
        const meta = CHANGE_META[diff.change] ?? {
          label: diff.change,
          color: 'default',
        }
        return (
          <div
            key={`${diff.order}-${diff.change}-${diff.field ?? ''}-${index}`}
            style={{
              borderLeft: '3px solid #f0f0f0',
              paddingLeft: 10,
            }}
          >
            <Space size={6} wrap>
              <Tag color={meta.color}>{meta.label}</Tag>
              <Typography.Text type="secondary" style={{ fontFamily: 'monospace' }}>
                #{diff.order}
              </Typography.Text>
              {diff.field && (
                <Typography.Text strong>
                  {FIELD_LABELS[diff.field] ?? diff.field}
                </Typography.Text>
              )}
            </Space>

            {diff.change === 'modified' && (
              <div style={{ marginTop: 4 }}>
                <Typography.Text type="secondary" delete>
                  {fmtValue(diff.before)}
                </Typography.Text>
                <Typography.Text type="secondary"> → </Typography.Text>
                <Typography.Text>{fmtValue(diff.after)}</Typography.Text>
              </div>
            )}
            {diff.change === 'added' && (
              <div style={{ marginTop: 4 }}>
                <Typography.Text>{fmtValue(diff.after)}</Typography.Text>
              </div>
            )}
            {diff.change === 'removed' && (
              <div style={{ marginTop: 4 }}>
                <Typography.Text type="secondary" delete>
                  {fmtValue(diff.before)}
                </Typography.Text>
              </div>
            )}
          </div>
        )
      })}
    </Space>
  )
}
