import { Button, Card, Col, Rate, Row, Statistic, Table, Typography } from 'antd'
import { Link } from 'react-router-dom'
import type { ApiError } from '../../api/client'
import type { ContentAdventureResponse } from '../../types/analytics'
import type { DayRange } from '../../utils/date-range'
import { fmt } from '../../utils/date-range'
import { useAdventureCapabilities } from '../../api/queries'

const formatPct = (rate: number | null) =>
  rate === null ? '—' : `${(rate * 100).toFixed(1)}%`

/**
 * 冒险故事：区间汇总卡 + 最受欢迎剧集榜（按完集数排序，后端返回序）。
 * 剧集列提供下钻到冒险内容工作台的出口，受 adventure-content scope 权限门控。
 * 看冒险对话消息入口无需权限。
 */
export default function AdventureSection({
  data,
  range,
}: {
  data: ContentAdventureResponse
  range: DayRange
}) {
  const {
    data: capabilities,
    isPending: capsPending,
    error: capsError,
  } = useAdventureCapabilities()
  // 闸口是「有没有 adventure-content scope」而不是 authoring：服务端 capabilities 与
  // episodes 同受 ContentAdminGuard 保护，能读到能力清单就说明能读剧集列表。
  // authoring=false 只表示当前环境只读（CONTENT_ADMIN_PROFILE），查看入口照常可用。
  const hasScope = capabilities !== null && capabilities !== undefined

  const is403 = (capsError as ApiError | null)?.status === 403

  let disabledReason: string | undefined
  if (capsPending) {
    disabledReason = '权限确认中，稍后自动可用'
  } else if (is403) {
    disabledReason =
      '需要 adventure-content scope，联系后端管理员在 ANALYTICS_ADMIN_USERS 里加上后重新登录'
  } else if (capsError) {
    disabledReason = '能力清单加载失败，请稍后重试'
  }

  const dateQuery = `startDate=${fmt(range[0])}&endDate=${fmt(range[1])}`

  const renderEpisodeLink = (episodeId: string, title: string) =>
    hasScope ? (
      <Link
        to={`/adventure?tab=episodes&episodeId=${encodeURIComponent(episodeId)}`}
      >
        {title}
      </Link>
    ) : (
      <Button type="link" disabled>
        {title}
      </Button>
    )

  const renderWorkbenchLink = () =>
    hasScope ? (
      <Link to="/adventure?tab=episodes">冒险内容工作台 →</Link>
    ) : (
      <Button type="link" disabled>
        冒险内容工作台 →
      </Button>
    )

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <Card size="small" style={{ height: '100%' }}>
            <Statistic title="开始冒险的设备" value={data.startedDevices} suffix="台" />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" style={{ height: '100%' }}>
            <Statistic title="完集次数" value={data.completedEpisodes} suffix="次" />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" style={{ height: '100%' }}>
            <Statistic title="完集率" value={formatPct(data.completionRate)} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" style={{ height: '100%' }}>
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
            {
              title: '剧集',
              dataIndex: 'title',
              render: (title: string, record: { episodeId: string }) =>
                renderEpisodeLink(record.episodeId, title),
            },
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
      <Row gutter={[16, 8]} style={{ marginTop: 16 }}>
        <Col>{renderWorkbenchLink()}</Col>
        <Col>
          <Link to={`/messages?mode=adventure_story&${dateQuery}`}>
            看冒险对话消息 →
          </Link>
        </Col>
      </Row>
      {disabledReason && (
        <Typography.Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>
          {disabledReason}
        </Typography.Text>
      )}
    </div>
  )
}
