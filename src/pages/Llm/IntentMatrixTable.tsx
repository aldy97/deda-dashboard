import { Empty, Table, Tag } from 'antd'
import type { IntentSummaryResponse } from '../../types/analytics'
import {
  INTENT_META,
  NULL_BUCKET,
  intentLabel,
  intentSourceLabel,
  pivotIntentMatrix,
} from './decisions'

/**
 * intent × source 交叉表。排查路由错位的主表：
 * 看「哄睡故事」行的「正则未命中·直接闲聊」列——如果孩子说了想听故事却落在这里，
 * 说明路由词表没覆盖到那种说法；看「自由聊天」行的「兜底」列——落在这里说明
 * 模型没给出可用标签，这轮的 free_chat 不可信。
 *
 * 缺组合渲染「—」而不是 0：0 是「查过、确实没有」，— 是「这个组合没出现过」，
 * 在稀疏矩阵里两者视觉上要分开，否则满屏 0 会淹掉真正有值的格子。
 */
export default function IntentMatrixTable({
  summary,
}: {
  summary: IntentSummaryResponse
}) {
  const { sources, rows } = pivotIntentMatrix(summary.matrix)

  if (rows.length === 0) {
    return <Empty description="所选区间暂无意图判定记录" />
  }

  const columnLabel = (sourceKey: string) =>
    intentSourceLabel(sourceKey === NULL_BUCKET ? null : sourceKey)

  return (
    <Table
      size="small"
      rowKey={(row) => row.intent ?? NULL_BUCKET}
      dataSource={rows}
      pagination={false}
      scroll={{ x: 160 + sources.length * 130 }}
      columns={[
        {
          title: '意图',
          dataIndex: 'intent',
          fixed: 'left',
          width: 160,
          render: (intent: string | null) => (
            <Tag
              color={
                intent !== null ? (INTENT_META[intent]?.color ?? 'default') : 'default'
              }
            >
              {intentLabel(intent)}
            </Tag>
          ),
        },
        ...sources.map((sourceKey) => ({
          title: columnLabel(sourceKey),
          key: sourceKey,
          width: 130,
          align: 'right' as const,
          render: (_: unknown, row: (typeof rows)[number]) =>
            row.counts[sourceKey] ?? '—',
        })),
        {
          title: '合计',
          dataIndex: 'total',
          width: 90,
          align: 'right' as const,
          fixed: 'right' as const,
        },
      ]}
    />
  )
}
