import { Empty, Table } from 'antd'
import type { RetentionCohortsResponse } from '../../types/analytics'

/** rate 0-1 → 单元格底色（蓝色阶，越深留存越高） */
function cellBackground(rate: number): string {
  return `rgba(22, 119, 255, ${(0.06 + rate * 0.74).toFixed(3)})`
}

function formatPct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`
}

/**
 * Cohort 留存热力表：行 = cohort（按日/ISO 周），列 = 第 N 天/周留存率。
 * n=0 恒为 100%；后端只返回该 cohort 已完整经过的周期数，
 * 未到期（尚无该 N 数据）的格子显示 —。
 */
export default function CohortTable({
  data,
}: {
  data: RetentionCohortsResponse
}) {
  if (data.cohorts.length === 0) {
    return <Empty description="所选区间暂无 cohort 数据" />
  }

  const maxN = Math.max(
    ...data.cohorts.map((c) => c.retention[c.retention.length - 1]?.n ?? 0),
  )
  const unit = data.granularity === 'day' ? 'D' : 'W'

  const columns = [
    {
      title: 'Cohort',
      dataIndex: 'cohort',
      key: 'cohort',
      fixed: 'left' as const,
      width: 110,
    },
    {
      title: '规模',
      dataIndex: 'size',
      key: 'size',
      fixed: 'left' as const,
      width: 64,
      align: 'right' as const,
    },
    ...Array.from({ length: maxN + 1 }, (_, n) => ({
      title: `${unit}${n}`,
      key: `n${n}`,
      align: 'center' as const,
      width: 72,
      render: (_: unknown, record: (typeof data.cohorts)[number]) => {
        const point = record.retention.find((r) => r.n === n)
        if (!point) {
          return <span style={{ color: '#bfbfbf' }}>—</span>
        }
        return (
          <div
            style={{
              background: cellBackground(point.rate),
              color: point.rate > 0.45 ? '#fff' : 'rgba(0, 0, 0, 0.88)',
              borderRadius: 4,
              padding: '2px 0',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatPct(point.rate)}
          </div>
        )
      },
    })),
  ]

  return (
    <Table
      size="small"
      rowKey="cohort"
      columns={columns}
      dataSource={data.cohorts}
      pagination={false}
      scroll={{ x: 'max-content' }}
    />
  )
}
