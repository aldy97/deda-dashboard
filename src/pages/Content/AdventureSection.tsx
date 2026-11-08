import { Card, Col, Rate, Row, Statistic, Table } from 'antd'
import type { ContentAdventureResponse } from '../../types/analytics'

const formatPct = (rate: number | null) =>
  rate === null ? '—' : `${(rate * 100).toFixed(1)}%`

/**
 * 冒险故事：区间汇总卡 + 最受欢迎剧集榜（按完集数排序，后端返回序）。
 */
export default function AdventureSection({
  data,
}: {
  data: ContentAdventureResponse
}) {
  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title="开始冒险的设备" value={data.startedDevices} suffix="台" />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title="完集次数" value={data.completedEpisodes} suffix="次" />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title="完集率" value={formatPct(data.completionRate)} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic
              title="平均每集星数"
              value={data.avgStarsPerEpisode ?? '—'}
              suffix={data.avgStarsPerEpisode === null ? '' : '星'}
            />
          </Card>
        </Col>
      </Row>
      {data.topEpisodes.length > 0 && (
        <Table
          size="small"
          rowKey="episodeId"
          style={{ marginTop: 16 }}
          dataSource={data.topEpisodes}
          pagination={false}
          columns={[
            { title: '剧集', dataIndex: 'title' },
            {
              title: '完集次数',
              dataIndex: 'completions',
              width: 110,
              align: 'right',
            },
            {
              title: '平均星数',
              dataIndex: 'avgStars',
              width: 160,
              render: (stars: number | null) =>
                stars === null ? (
                  '—'
                ) : (
                  <Rate disabled allowHalf value={stars} style={{ fontSize: 14 }} />
                ),
            },
          ]}
        />
      )}
    </div>
  )
}
