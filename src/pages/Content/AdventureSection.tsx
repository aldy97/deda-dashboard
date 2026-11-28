import { Button, Card, Col, Rate, Row, Statistic, Typography } from 'antd'
import ResponsiveTable from '../../components/ResponsiveTable'
import AccessLink from '../../components/access/AccessLink'
import type { ApiError } from '../../api/client'
import type { ContentAdventureResponse } from '../../types/analytics'
import type { DayRange } from '../../utils/date-range'
import { fmt } from '../../utils/date-range'
import { useAdventureCapabilities } from '../../api/queries'
import { useAnalyticsMeta } from '../../api/meta'
import { isSuperAdmin } from '../../components/access/role'

const formatPct = (rate: number | null) =>
  rate === null ? '—' : `${(rate * 100).toFixed(1)}%`

/**
 * 冒险故事：区间汇总卡 + 最受欢迎剧集榜（按完集数排序，后端返回序）。
 * 剧集列提供下钻到冒险内容工作台的出口；工作台已归入运维组，只有 superadmin 能进。
 * 看冒险对话消息入口无需权限。
 */
export default function AdventureSection({
  data,
  range,
}: {
  data: ContentAdventureResponse
  range: DayRange
}) {
  const metaQuery = useAnalyticsMeta()
  const superadmin = isSuperAdmin(metaQuery.data)

  // 普通 admin 连 capabilities 都不发：那一发必然 403，只是给监控添噪音。
  // 权限来源只信 meta 的 admin.role，与 OpsGate 同一判据。
  const {
    data: capabilities,
    isPending: capsPending,
    error: capsError,
  } = useAdventureCapabilities({ enabled: superadmin })
  // authoring=false 只表示当前环境只读（CONTENT_ADMIN_PROFILE），查看入口照常可用。
  const hasScope = superadmin && capabilities !== null && capabilities !== undefined

  const is403 = (capsError as ApiError | null)?.status === 403

  // 普通 admin / meta 未就绪交给 AccessLink 退化为纯文本；只有「superadmin 但能力
  // 清单没拿到」才保留禁用按钮（authoring=false 只读环境仍可查看，不算未拿到）。
  const showLink = !superadmin || hasScope

  let disabledReason: string | undefined
  if (metaQuery.isPending) {
    disabledReason = '权限确认中，稍后自动可用'
  } else if (metaQuery.isError) {
    disabledReason =
      '无法确认账号权限（/analytics/meta 不可用），已按无权限处理，请刷新或重新登录'
  } else if (!superadmin) {
    disabledReason =
      '冒险内容工作台只对超级管理员（superadmin）开放，请联系超级管理员调整账号 role 后重新登录'
  } else if (capsPending) {
    disabledReason = '权限确认中，稍后自动可用'
  } else if (is403) {
    disabledReason =
      '服务端拒绝了冒险内容的访问（需要超级管理员权限），请重新登录后再试'
  } else if (capsError) {
    disabledReason = '能力清单加载失败，请稍后重试'
  }

  const dateQuery = `startDate=${fmt(range[0])}&endDate=${fmt(range[1])}`

  const renderEpisodeLink = (episodeId: string, title: string) =>
    showLink ? (
      <AccessLink
        hint="adventure"
        detail="该集"
        to={`/adventure?tab=episodes&episodeId=${encodeURIComponent(episodeId)}`}
      >
        {title}
      </AccessLink>
    ) : (
      <Button type="link" disabled>
        {title}
      </Button>
    )

  const renderWorkbenchLink = () =>
    showLink ? (
      <AccessLink hint="adventure" arrow to="/adventure?tab=episodes">
        冒险内容工作台
      </AccessLink>
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
        <ResponsiveTable
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
          <AccessLink
            hint="message-list"
            to={`/messages?mode=adventure_story&${dateQuery}`}
          >
            看冒险对话消息 →
          </AccessLink>
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
