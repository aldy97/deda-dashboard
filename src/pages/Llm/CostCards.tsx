import { Col, Row, Statistic, Tag, Typography } from 'antd'
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons'
import type { LlmCostResponse } from '../../types/analytics'
import InfoTip from '../../components/InfoTip'
import { formatCny } from './cost-format'

interface Props {
  data: LlmCostResponse
  /** 前一等长区间的 totals（用于环比），缺数据时不显示环比 */
  previousTotals?: LlmCostResponse['totals']
}

/**
 * 费用区块的 5 张指标卡片。
 * 所有金额 null 统一显示「—」；主模型/小模型分别标注数据源与精度。
 */
export default function CostCards({ data, previousTotals }: Props) {
  const { totals, series, sources, month, unitEconomics } = data

  // ---- 区间合计 ----
  const aliyunAvailable = sources.aliyun.status === 'ok'
  const deepseekHasRows = sources.deepseek.rows > 0
  const partialReasons: string[] = []
  if (!aliyunAvailable) partialReasons.push('缺少小模型账单')
  if (!deepseekHasRows) partialReasons.push('缺少主模型埋点')

  // 前一等长区间环比
  const prevDelta = computeDelta(totals.totalCny, previousTotals ? previousTotals.totalCny : null)

  // ---- 主模型 ----
  const pricedRows = sources.deepseek.pricedRows
  // cacheTokenAvailable 的语义是「区间内是否有行拿到缓存命中数」，pricedRows===0 时它必然为
  // false —— 但那时一行都没计价，没有估算可言，打「含上界」等于描述一个不存在的估算。
  const anyUpperBound =
    pricedRows > 0 &&
    (sources.deepseek.cacheTokenAvailable === false ||
      series.some(
        (s) => s.mainAccuracy === 'upper_bound' || s.mainAccuracy === 'mixed',
      ))

  // ---- 小模型 ----
  const anyUnsettled = series.some((s) => s.settled === false)
  const aliyunOk = sources.aliyun.status === 'ok'
  const aliyunNoData =
    sources.aliyun.status === 'no_data' ||
    sources.aliyun.status === 'unconfigured'
  const modelSplitOk = sources.aliyun.modelSplit

  // ---- 单设备日均 ----
  const maxDevices = unitEconomics.reduce(
    (max, row) => Math.max(max, row.tokenActiveDevices),
    0,
  )
  const daysWithData = series.filter((s) => s.totalCny !== null).length
  const perDevicePerDay =
    maxDevices > 0 && daysWithData > 0 && totals.totalCny !== null
      ? totals.totalCny / maxDevices / daysWithData
      : null

  // ---- 本月 ----
  const monthDelta = month.deltaPct

  return (
    <Row gutter={[24, 16]}>
      {/* 1. 区间合计 */}
      <Col xs={24} sm={12} md={8} lg={4}>
        <Statistic
          title={
            <span>
              区间合计
              {totals.partial && (
                <>
                  <Tag color="warning" style={{ marginLeft: 8 }}>
                    合计不完整
                  </Tag>
                  <InfoTip title={`${partialReasons.join('、')}，当前合计不等于真实总花费`} />
                </>
              )}
            </span>
          }
          value={formatCny(totals.totalCny)}
        />
        {prevDelta !== null && (
          <Typography.Text
            type={prevDelta > 0 ? 'danger' : prevDelta < 0 ? 'success' : 'secondary'}
            style={{ fontSize: 12 }}
          >
            {prevDelta >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
            {' '}vs 前一等长区间 {Math.abs(prevDelta).toFixed(1)}%
          </Typography.Text>
        )}
      </Col>

      {/* 2. 主模型 */}
      <Col xs={24} sm={12} md={8} lg={4}>
        <Statistic
          title={
            <span>
              主模型
              {pricedRows === 0 ? (
                <>
                  <Tag style={{ marginLeft: 8 }}>未计价</Tag>
                  <InfoTip title="区间内所有主模型埋点行都没有成本快照（costMicroCny 为 null），所以没有任何金额可显示。通常是本次改动上线前写入的历史行——需跑 scripts/backfill-llm-cost.ts 回填，但回填结果只能是上界（历史行没有缓存命中数）。上线后新写入的行自动带成本与缓存命中数，为精确值。" />
                </>
              ) : anyUpperBound ? (
                <>
                  <Tag color="warning" style={{ marginLeft: 8 }}>
                    估算·含上界
                  </Tag>
                  <InfoTip title="区间内含缺少缓存命中数的行，全按未命中价计——实测可能高估十几倍" />
                </>
              ) : (
                <>
                  <Tag style={{ marginLeft: 8 }}>估算</Tag>
                  <InfoTip title="主模型金额按 llm_usage_logs 写库时的定价快照估算（deepseek-flash 无账单真值）" />
                </>
              )}
            </span>
          }
          value={formatCny(totals.mainCny)}
        />
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {sources.deepseek.pricedRows} / {sources.deepseek.rows} 行已计价
          {sources.deepseek.cacheHitRows > 0 &&
            `，${sources.deepseek.cacheHitRows} 行含缓存命中`}
        </Typography.Text>
      </Col>

      {/* 3. 小模型 */}
      <Col xs={24} sm={12} md={8} lg={4}>
        <Statistic
          title={
            <span>
              小模型
              {aliyunOk ? (
                <Tag color="blue" style={{ marginLeft: 8 }}>
                  账单
                </Tag>
              ) : (
                <>
                  {/* 拿不到数据 ≠ ¥0：必须显式占位，区分「没接入」与「接入了但还没出账」 */}
                  <Tag color="warning" style={{ marginLeft: 8 }}>
                    {sources.aliyun.status === 'unconfigured'
                      ? '未接入账单'
                      : '暂无账单'}
                  </Tag>
                  <InfoTip title={sources.aliyun.message ?? undefined} />
                </>
              )}
              {aliyunOk && !modelSplitOk && (
                <>
                  <Tag color="orange" style={{ marginLeft: 4 }}>
                    账号合计
                  </Tag>
                  <InfoTip title="账单无法按模型拆分，小模型口径降级为「百炼账号合计」，可能混入同账号其他消费" />
                </>
              )}
            </span>
          }
          value={aliyunNoData ? '—' : formatCny(totals.smallCny)}
        />
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {aliyunOk
            ? `最新账单日 ${sources.aliyun.latestBillDate ?? '—'}${anyUnsettled ? '，含暂估' : ''}`
            : sources.aliyun.message}
        </Typography.Text>
      </Col>

      {/* 4. 单设备日均 */}
      <Col xs={24} sm={12} md={8} lg={4}>
        <Statistic
          title={
            <span>
              单设备日均成本
              <InfoTip title="分母 = 有 token 埋点的去重设备数（llm_usage_logs.deviceId，不是活跃设备数）× 有数据天数。无数据时显示 —。" />
            </span>
          }
          value={formatCny(perDevicePerDay)}
        />
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {maxDevices} 设备 × {daysWithData} 天
        </Typography.Text>
      </Col>

      {/* 5. 本月已发生 / 月末预测 */}
      <Col xs={24} sm={12} md={8} lg={4}>
        <Statistic
          title={
            <span>
              本月已发生 / 月末预测
              {month.partial && (
                <>
                  <Tag color="warning" style={{ marginLeft: 8 }}>
                    不完整
                  </Tag>
                  <InfoTip title="本账期缺账单或缺主模型埋点，「已发生」只含已有数据源，不是真实总额。此标志的窗口是「昨日所在账期」，与上方所选区间无关，可能与「区间合计」的不完整标志不一致。" />
                </>
              )}
              <InfoTip title="月末预测按本月至今有数据天数的日均 run-rate 外推至月末；当月账单为暂估值（未终账）。上月同期为上月 1 日至同一日。账期内没有任何数据源时一律显示 —，不显示 ¥0.0000（拿不到数据 ≠ 花了 0 元）。" />
            </span>
          }
          value={`${formatCny(month.toDateCny)} / ${formatCny(month.projectedEndCny)}`}
        />
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          上月同期 {formatCny(month.prevSamePeriodCny)}
          {monthDelta !== null ? (
            <Tag
              color={monthDelta > 0 ? 'red' : monthDelta < 0 ? 'green' : 'default'}
              style={{ marginLeft: 4 }}
            >
              {monthDelta >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
              {' '}{Math.abs(monthDelta).toFixed(1)}%
            </Tag>
          ) : (
            <Typography.Text type="secondary" style={{ marginLeft: 4, fontSize: 12 }}>
              （上月同期无数据）
            </Typography.Text>
          )}
        </Typography.Text>
      </Col>
    </Row>
  )
}

function computeDelta(
  current: number | null,
  previous: number | null,
): number | null {
  if (current === null || previous === null || previous === 0) return null
  return ((current - previous) / previous) * 100
}
