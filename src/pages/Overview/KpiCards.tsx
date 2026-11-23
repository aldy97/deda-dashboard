import type { MouseEvent } from 'react'
import { ArrowRightOutlined } from '@ant-design/icons'
import { Card, Col, Row, Statistic, Tag, Typography } from 'antd'
import { Link } from 'react-router-dom'
import type { OverviewResponse } from '../../types/analytics'
import InfoTip from '../../components/InfoTip'
import { PAGE_LABELS, kpiDefs, type KpiFooter } from './kpi-defs'

/** 环比标签：正绿负红，null/0 灰色 */
function DeltaTag({ value }: { value: number | null }) {
  return (
    <>
      {value === null || value === 0 ? (
        <Tag style={{ marginTop: 8 }}>环比持平</Tag>
      ) : (
        <Tag color={value > 0 ? 'green' : 'red'} style={{ marginTop: 8 }}>
          环比 {value > 0 ? '+' : ''}
          {value.toFixed(1)}%
        </Tag>
      )}
      <InfoTip title="与前一自然日的活跃设备数相比；前一日活跃为 0 时无法计算，显示持平" />
    </>
  )
}

function Footer({ footer }: { footer: KpiFooter }) {
  if (footer.kind === 'delta') return <DeltaTag value={footer.value} />
  return <Tag style={{ marginTop: 8 }}>估算口径</Tag>
}

/**
 * 整卡即出口：说明图标与文字选择这两类「不是想跳转」的点击要放行给原行为，
 * 否则点问号看口径、或拖选文字松手，都会把人带到别的页面。
 */
function handleCardClick(event: MouseEvent<HTMLAnchorElement>) {
  const clickedInfoIcon = (event.target as Element).closest('.anticon') !== null
  const hasTextSelection = (window.getSelection()?.toString() ?? '') !== ''
  if (clickedInfoIcon || hasTextSelection) event.preventDefault()
}

export default function KpiCards({ data }: { data: OverviewResponse }) {
  return (
    <Row gutter={[16, 16]}>
      {kpiDefs(data).map((def) => (
        <Col key={def.key} xs={12} md={6}>
          <Link
            to={def.href}
            className="kpi-card"
            aria-label={`${def.title}，前往${PAGE_LABELS[def.href]}`}
            onClick={handleCardClick}
          >
            <Card
              hoverable
              style={{ height: '100%' }}
              extra={<ArrowRightOutlined className="kpi-card-arrow" />}
            >
              <Statistic
                title={
                  def.tip ? (
                    <>
                      {def.title}
                      <InfoTip title={def.tip} />
                    </>
                  ) : (
                    def.title
                  )
                }
                value={def.value}
                suffix={def.suffix}
              />
              {def.note && (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {def.note}
                </Typography.Text>
              )}
              {def.footer && <Footer footer={def.footer} />}
            </Card>
          </Link>
        </Col>
      ))}
    </Row>
  )
}
