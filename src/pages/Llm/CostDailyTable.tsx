import { Alert, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type {
  LlmCostReconciliation,
  LlmCostResponse,
  LlmCostSeriesItem,
} from '../../types/analytics'
import InfoTip from '../../components/InfoTip'
import { dayTotalPartial } from './cost-series'
import { formatCny } from './cost-format'

function sourceTag(small: string, main: string) {
  const smallLabel = small === 'bill' ? '账单' : '—'
  const mainLabel = main === 'estimated' ? '估算' : '—'
  return (
    <>
      <Tag color="blue">{smallLabel}</Tag>
      <Tag color="orange">{mainLabel}</Tag>
    </>
  )
}

function settledTag(settled: boolean | null) {
  if (settled === true) return <Tag>已终账</Tag>
  if (settled === false) return <Tag color="warning">暂估</Tag>
  return '—'
}

const columns: ColumnsType<LlmCostSeriesItem> = [
  {
    title: '日期',
    dataIndex: 'date',
    key: 'date',
    width: 120,
    defaultSortOrder: 'descend',
    sorter: (a, b) => a.date.localeCompare(b.date),
  },
  {
    title: '小模型 ¥',
    dataIndex: 'smallCny',
    key: 'smallCny',
    sorter: (a, b) => (a.smallCny ?? 0) - (b.smallCny ?? 0),
    render: (v: number | null) => formatCny(v),
  },
  {
    title: '主模型 ¥',
    dataIndex: 'mainCny',
    key: 'mainCny',
    sorter: (a, b) => (a.mainCny ?? 0) - (b.mainCny ?? 0),
    render: (v: number | null) => formatCny(v),
  },
  {
    title: '其他 ¥',
    dataIndex: 'otherCny',
    key: 'otherCny',
    sorter: (a, b) => (a.otherCny ?? 0) - (b.otherCny ?? 0),
    render: (v: number | null) => formatCny(v),
  },
  {
    title: (
      <span>
        合计 ¥
        <InfoTip title="带 * 的日期＝当日缺一个数据源（账单未出，或有 token 却未计价），后端把缺失部分按 0 计入合计，所以该数不等于当日真实总花费。最近 1–3 天常见（账单延迟 24h 出账）。" />
      </span>
    ),
    dataIndex: 'totalCny',
    key: 'totalCny',
    sorter: (a, b) => (a.totalCny ?? 0) - (b.totalCny ?? 0),
    render: (v: number | null, r: LlmCostSeriesItem) =>
      v === null ? (
        formatCny(v)
      ) : (
        <span>
          {formatCny(v)}
          {dayTotalPartial(r) && (
            <span style={{ color: '#faad14', marginLeft: 2 }}>*</span>
          )}
        </span>
      ),
  },
  {
    title: '来源',
    key: 'source',
    width: 120,
    render: (_: unknown, r: LlmCostSeriesItem) =>
      sourceTag(r.smallSource, r.mainSource),
  },
  {
    title: '终账',
    dataIndex: 'settled',
    key: 'settled',
    width: 80,
    render: (v: boolean | null) => settledTag(v),
  },
]

function ReconciliationBar({ rec }: { rec: LlmCostReconciliation }) {
  if (rec.status === 'insufficient') {
    return (
      <div style={{ marginBottom: 12, color: '#999', fontSize: 13 }}>
        尚无已终账账单日（终账在次月 3 日 12 点后），暂无法对账
      </div>
    )
  }

  if (rec.deltaPct === null) {
    return (
      <div style={{ marginBottom: 12 }}>
        <span style={{ marginRight: 16 }}>
          小模型估算 {formatCny(rec.smallEstimatedCny)} vs 账单真值{' '}
          {formatCny(rec.smallBilledCny)}
        </span>
        <span style={{ color: '#999' }}>账单真值为 0，无法计算偏差</span>
      </div>
    )
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <span style={{ marginRight: 16 }}>
        小模型估算 {formatCny(rec.smallEstimatedCny)} vs 账单真值{' '}
        {formatCny(rec.smallBilledCny)}
      </span>
      <Tag color={Math.abs(rec.deltaPct) > 15 ? 'warning' : 'default'}>
        偏差 {rec.deltaPct >= 0 ? '+' : ''}
        {rec.deltaPct.toFixed(1)}%
      </Tag>
      {Math.abs(rec.deltaPct) > 15 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginTop: 8 }}
          message="小模型估算与账单真值偏差超过 ±15%，建议排查 bill-fetch 日志、aliyun 外部扣款或未建模的优惠/调价。"
        />
      )}
    </div>
  )
}

interface Props {
  data: LlmCostResponse
}

/**
 * 费用明细表 + 对账条。
 * 默认日期倒序；金额列可排序；表尾补充缺源日 / unpriced / noToken 说明。
 */
export default function CostDailyTable({ data }: Props) {
  const { series, reconciliation, totals } = data

  const partialDays = series.filter(dayTotalPartial).length
  const notes: string[] = []
  if (partialDays > 0) {
    notes.push(
      `* ${partialDays} 天合计不完整（当日缺账单或缺计价，后端按 0 计入合计，不是真实总额）`,
    )
  }
  if (totals.unpricedRows > 0) {
    notes.push(
      `未计价 ${totals.unpricedRows} 行（${totals.unpricedTokens.toLocaleString()} tokens 无匹配定价）`,
    )
  }
  if (totals.noTokenRows > 0) {
    notes.push(`无 token ${totals.noTokenRows} 行（该行不产生费用）`)
  }
  const footerNote =
    notes.length > 0 ? (
      <div style={{ color: '#999', fontSize: 13 }}>{notes.join('；')}</div>
    ) : null

  return (
    <div>
      <ReconciliationBar rec={reconciliation} />
      <Table
        columns={columns}
        dataSource={series}
        rowKey="date"
        size="small"
        pagination={{
          pageSize: 31,
          showSizeChanger: true,
          pageSizeOptions: ['7', '31', '60', '90'],
        }}
        scroll={{ x: 600 }}
        footer={footerNote ? () => footerNote : undefined}
      />
    </div>
  )
}
