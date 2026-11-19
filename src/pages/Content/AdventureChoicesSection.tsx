import { Card, Col, Empty, Row, Spin, Statistic, Table, Typography } from 'antd'
import type { ContentAdventureChoicesResponse } from '../../types/analytics'
import type { DayRange } from '../../utils/date-range'
import { fmt } from '../../utils/date-range'
import { useContentAdventureChoices } from '../../api/queries'

const formatPct = (rate: number | null) =>
  rate === null ? '—' : `${(rate * 100).toFixed(1)}%`

/**
 * 二选一选项命中报表（运营视角）。
 * 展示 choice_matched 事件的汇总数据与按剧集/选项拆分。
 */
export default function AdventureChoicesSection({
  data,
  range,
}: {
  data: ContentAdventureChoicesResponse
  range: DayRange
}) {
  const params = { startDate: fmt(range[0]), endDate: fmt(range[1]) }
  const { isLoading, error } = useContentAdventureChoices(params)

  if (isLoading) {
    return <Spin />
  }

  if (error) {
    return (
      <Typography.Text type="danger">
        {error instanceof Error ? error.message : '加载失败'}
      </Typography.Text>
    )
  }

  if (data.totalInteractions === 0 || data.byEpisode.length === 0) {
    return <Empty description="暂无选项命中数据" />
  }

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <Card size="small" style={{ height: '100%' }}>
            <Statistic title="总互动数" value={data.totalInteractions} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" style={{ height: '100%' }}>
            <Statistic title="命中总数" value={data.matchedTotal} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" style={{ height: '100%' }}>
            <Statistic title="兜底率" value={formatPct(data.fallbackRate)} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" style={{ height: '100%' }}>
            <Statistic title="LLM 占比" value={formatPct(data.llmShare)} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card size="small" title="互动结果分布">
            <Row gutter={[16, 8]}>
              <Col xs={12} sm={6}>
                <Statistic
                  title="已应答"
                  value={data.outcomeCounts.answered}
                />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic
                  title="跑题"
                  value={data.outcomeCounts.off_topic}
                />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic
                  title="兜底"
                  value={data.outcomeCounts.fallback}
                />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic
                  title="超时"
                  value={data.outcomeCounts.timeout}
                />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card size="small" title="判定来源分布">
            <Row gutter={[16, 8]}>
              <Col xs={12} sm={12}>
                <Statistic
                  title="确定性匹配"
                  value={data.sourceCounts.deterministic}
                />
              </Col>
              <Col xs={12} sm={12}>
                <Statistic
                  title="LLM 判定"
                  value={data.sourceCounts.llm}
                />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <Table
        size="small"
        rowKey="episodeId"
        style={{ marginTop: 16 }}
        dataSource={data.byEpisode}
        pagination={false}
        defaultExpandAllRows
        columns={[
          {
            title: '剧集',
            dataIndex: 'title',
          },
          {
            title: '命中数',
            dataIndex: 'matchedTotal',
            width: 100,
            align: 'right',
          },
          {
            title: '兜底率',
            dataIndex: 'fallbackRate',
            width: 100,
            align: 'right',
            render: (rate: number | null) => formatPct(rate),
          },
        ]}
        expandable={{
          expandedRowRender: (episode) => (
            <Table
              size="small"
              rowKey="index"
              dataSource={episode.choices}
              pagination={false}
              columns={[
                {
                  title: '段落',
                  dataIndex: 'segmentOrder',
                  width: 80,
                  render: (v: number | null) =>
                    v === null ? '—' : v,
                },
                {
                  title: '文案',
                  dataIndex: 'text',
                  render: (v: string | null) =>
                    v === null ? '（文案已变更）' : v,
                },
                {
                  title: 'Key',
                  dataIndex: 'key',
                  render: (v: string | null) =>
                    v === null ? '—' : v,
                },
                {
                  title: '命中次数',
                  dataIndex: 'hits',
                  width: 100,
                  align: 'right',
                },
              ]}
            />
          ),
        }}
      />
    </div>
  )
}