import { useState } from 'react'
import { Alert, Card, Col, Radio, Row, Spin, Typography } from 'antd'
import {
  useActivationFunnel,
  useRetentionCohorts,
  useRetentionCurve,
} from '../../api/queries'
import type { CohortBasis } from '../../types/analytics'
import InfoTip from '../../components/InfoTip'
import AnalyticsRangePicker from '../../components/AnalyticsRangePicker'
import { defaultRange, fmt } from '../../utils/date-range'
import type { DayRange } from '../../utils/date-range'
import CohortTable from './CohortTable'
import RetentionCurve from './RetentionCurve'
import ActivationFunnel from './ActivationFunnel'

function toErrorMessage(err: unknown): string | null {
  if (!err) return null
  return err instanceof Error ? err.message : '加载失败'
}

/**
 * 留存与激活页（P2）：cohort 留存热力表 + 留存曲线 + 激活漏斗。BP 核心页。
 * 三个模块参数独立：cohort 表有粒度/口径/区间，曲线可选 cohort 区间，漏斗为必选区间。
 */
export default function Retention() {
  // ---- cohort 热力表 ----
  const [cohortRange, setCohortRange] = useState<DayRange>(defaultRange(56))
  const [granularity, setGranularity] = useState<'day' | 'week'>('week')
  const [basis, setBasis] = useState<CohortBasis>('activation')
  const cohortsQuery = useRetentionCohorts({
    startDate: fmt(cohortRange[0]),
    endDate: fmt(cohortRange[1]),
    granularity,
    basis,
  })
  const cohorts = cohortsQuery.data ?? null
  const cohortsLoading = cohortsQuery.isLoading
  const cohortsError = toErrorMessage(cohortsQuery.error)

  // ---- 留存曲线 ----
  const [curveRange, setCurveRange] = useState<DayRange | null>(null)
  const curveQuery = useRetentionCurve(
    curveRange
      ? {
          cohortStartDate: fmt(curveRange[0]),
          cohortEndDate: fmt(curveRange[1]),
        }
      : undefined,
  )
  const curve = curveQuery.data ?? null
  const curveLoading = curveQuery.isLoading
  const curveError = toErrorMessage(curveQuery.error)

  // ---- 激活漏斗 ----
  const [funnelRange, setFunnelRange] = useState<DayRange>(defaultRange(30))
  const funnelQuery = useActivationFunnel({
    startDate: fmt(funnelRange[0]),
    endDate: fmt(funnelRange[1]),
  })
  const funnel = funnelQuery.data ?? null
  const funnelLoading = funnelQuery.isLoading
  const funnelError = toErrorMessage(funnelQuery.error)

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          留存与激活
        </Typography.Title>
        <Typography.Text type="secondary">
          日期为闭区间，含今日时今日数据进行中；激活口径基于当前绑定记录，设备解绑后会从
          cohort 消失（二期快照表冻结）
        </Typography.Text>
      </div>

      <Card
        title={
          <>
            Cohort 留存热力表
            <InfoTip title="Cohort = 同一周期内「激活/首用」的一批设备。单元格 = 这批设备在第 N 个周期仍有对话的比例（活跃 = 当天有 ≥1 条孩子发言）；颜色越深留存越高；格子显示 — 表示该周期尚未到期。设备解绑后会从激活口径 cohort 中消失。" />
          </>
        }
        extra={
          <Radio.Group
            optionType="button"
            buttonStyle="solid"
            size="small"
            value={basis}
            onChange={(e) => setBasis(e.target.value as CohortBasis)}
            options={[
              { label: '激活口径', value: 'activation' },
              { label: '首用口径', value: 'firstUse' },
            ]}
          />
        }
      >
        <div
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            marginBottom: 12,
            alignItems: 'center',
          }}
        >
          <AnalyticsRangePicker
            value={cohortRange}
            onChange={(r) => {
              if (r) setCohortRange(r)
            }}
          />
          <Radio.Group
            optionType="button"
            value={granularity}
            onChange={(e) => setGranularity(e.target.value as 'day' | 'week')}
            options={[
              { label: '按周', value: 'week' },
              { label: '按日', value: 'day' },
            ]}
          />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            激活口径 = 首次绑定日；首用口径 = 首次发言日（解绑后仍可追溯）
          </Typography.Text>
        </div>
        {cohortsError && (
          <Alert
            type="error"
            showIcon
            message="Cohort 数据加载失败"
            description={cohortsError}
            style={{ marginBottom: 12 }}
          />
        )}
        <Spin spinning={cohortsLoading}>
          {cohorts && <CohortTable data={cohorts} />}
        </Spin>
      </Card>

      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card
            title={
              <>
                留存曲线
                <InfoTip title="横轴 = 激活后第 N 天，纵轴 = 该批设备在第 N 天仍有对话的比例。分母只含激活已满 N 天的设备（未到期不计入），所以越靠右的点样本越小、波动越大。口径固定为激活口径（首次绑定日）。" />
              </>
            }
            extra={
              <AnalyticsRangePicker
                size="small"
                allowClear
                placeholder={['Cohort 起始', 'Cohort 截止']}
                value={curveRange}
                onChange={(r) => setCurveRange(r)}
              />
            }
          >
            <Typography.Text type="secondary">
              样本设备 {curve?.cohortSize ?? '—'} 台（不选区间 = 全部激活
              cohort）
            </Typography.Text>
            {curveError && (
              <Alert
                type="error"
                showIcon
                message="留存曲线加载失败"
                description={curveError}
                style={{ marginTop: 8 }}
              />
            )}
            <Spin spinning={curveLoading}>
              {curve && <RetentionCurve data={curve} />}
            </Spin>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title={
              <>
                激活漏斗
                <InfoTip title="区间内激活的设备逐层转化：绑定激活 → 首次对话（有过发言）→ 激活满 7 天且第 7 天仍活跃 → 满 30 天且第 30 天仍活跃。「出货」一级一期无埋点数据，自动隐藏。" />
              </>
            }
            extra={
              <AnalyticsRangePicker
                size="small"
                value={funnelRange}
                onChange={(r) => {
                  if (r) setFunnelRange(r)
                }}
              />
            }
          >
            {funnelError && (
              <Alert
                type="error"
                showIcon
                message="激活漏斗加载失败"
                description={funnelError}
                style={{ marginBottom: 8 }}
              />
            )}
            <Spin spinning={funnelLoading}>
              {funnel && <ActivationFunnel data={funnel} />}
            </Spin>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
