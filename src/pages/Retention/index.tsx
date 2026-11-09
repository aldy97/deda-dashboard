import { useCallback, useEffect, useState } from 'react'
import { Alert, Card, Col, Radio, Row, Spin, Typography } from 'antd'
import {
  fetchActivationFunnel,
  fetchRetentionCohorts,
  fetchRetentionCurve,
} from '../../api/analytics'
import type {
  ActivationFunnelResponse,
  CohortBasis,
  RetentionCohortsResponse,
  RetentionCurveResponse,
} from '../../types/analytics'
import AnalyticsRangePicker from '../../components/AnalyticsRangePicker'
import { defaultRange, fmt } from '../../utils/date-range'
import type { DayRange } from '../../utils/date-range'
import CohortTable from './CohortTable'
import RetentionCurve from './RetentionCurve'
import ActivationFunnel from './ActivationFunnel'

function toErrorMessage(err: unknown): string {
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
  const [cohorts, setCohorts] = useState<RetentionCohortsResponse | null>(null)
  const [cohortsLoading, setCohortsLoading] = useState(true)
  const [cohortsError, setCohortsError] = useState<string | null>(null)

  const loadCohorts = useCallback(
    async (range: DayRange, g: 'day' | 'week', b: CohortBasis) => {
      setCohortsLoading(true)
      setCohortsError(null)
      try {
        setCohorts(
          await fetchRetentionCohorts({
            startDate: fmt(range[0]),
            endDate: fmt(range[1]),
            granularity: g,
            basis: b,
          }),
        )
      } catch (err) {
        setCohortsError(toErrorMessage(err))
      } finally {
        setCohortsLoading(false)
      }
    },
    [],
  )

  // ---- 留存曲线 ----
  const [curveRange, setCurveRange] = useState<DayRange | null>(null)
  const [curve, setCurve] = useState<RetentionCurveResponse | null>(null)
  const [curveLoading, setCurveLoading] = useState(true)
  const [curveError, setCurveError] = useState<string | null>(null)

  const loadCurve = useCallback(async (range: DayRange | null) => {
    setCurveLoading(true)
    setCurveError(null)
    try {
      setCurve(
        await fetchRetentionCurve(
          range
            ? { cohortStartDate: fmt(range[0]), cohortEndDate: fmt(range[1]) }
            : undefined,
        ),
      )
    } catch (err) {
      setCurveError(toErrorMessage(err))
    } finally {
      setCurveLoading(false)
    }
  }, [])

  // ---- 激活漏斗 ----
  const [funnelRange, setFunnelRange] = useState<DayRange>(defaultRange(30))
  const [funnel, setFunnel] = useState<ActivationFunnelResponse | null>(null)
  const [funnelLoading, setFunnelLoading] = useState(true)
  const [funnelError, setFunnelError] = useState<string | null>(null)

  const loadFunnel = useCallback(async (range: DayRange) => {
    setFunnelLoading(true)
    setFunnelError(null)
    try {
      setFunnel(
        await fetchActivationFunnel({
          startDate: fmt(range[0]),
          endDate: fmt(range[1]),
        }),
      )
    } catch (err) {
      setFunnelError(toErrorMessage(err))
    } finally {
      setFunnelLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCohorts(cohortRange, granularity, basis)
  }, [loadCohorts, cohortRange, granularity, basis])

  useEffect(() => {
    void loadCurve(curveRange)
  }, [loadCurve, curveRange])

  useEffect(() => {
    void loadFunnel(funnelRange)
  }, [loadFunnel, funnelRange])

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
        title="Cohort 留存热力表"
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
            title="留存曲线"
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
            title="激活漏斗"
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
