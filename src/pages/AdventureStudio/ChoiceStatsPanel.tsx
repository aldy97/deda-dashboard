import {
  Alert,
  Card,
  Col,
  Empty,
  Row,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import InfoTip from '../../components/InfoTip'
import { useEpisodeChoiceStats } from '../../api/queries'
import type { EpisodeChoiceStatsResponse } from '../../types/adventureAdmin'

/**
 * 「选项命中」面板：作者写的二选一选项文案，孩子到底有没有选中。
 *
 * 这个问题在今天完全是隐形的：孩子随口说的跟作者写的文案很少逐字一致，
 * 引擎会先尝试一次确定性匹配（文本相等），不行就丢给 LLM 判定，两者都
 * 对不上就静默走兜底——作者完全不知道自己的选项文案没被孩子选中过、
 * 兜底话术正在被大量使用。
 *
 * 口径全部来自服务端 GET /analytics/adventure-admin/episodes/:episodeId/choice-stats，
 * 前端不做任何加减：所有比率、neverChosen、段排序均为服务端提供。
 *
 * 零填充保证：segments 来自当前发布版本的内容快照（非事件），所以哪怕某个段
 * 一次都没被命中，它也会出现在清单里并带上 neverChosen 标记——这正是本面板
 * 最有价值的信号。但 totalInteractions 为 0 时不铺段清单：那一集根本还没人玩，
 * 把每个段都标红成「从未被选中」只是噪音，此时显示空态。
 */

const formatPct = (rate: number | null) =>
  rate === null ? '—' : `${(rate * 100).toFixed(1)}%`

function Stat({
  title,
  tip,
  value,
}: {
  title: string
  tip: string
  value: number
}) {
  return (
    <Statistic
      title={
        <>
          {title}
          <InfoTip title={tip} />
        </>
      }
      value={value}
      styles={{ content: { fontSize: 22 } }}
    />
  )
}

type ChoiceItem = EpisodeChoiceStatsResponse['segments'][number]['choices'][number]

interface Props {
  episodeId: string
}

export default function ChoiceStatsPanel({ episodeId }: Props) {
  const query = useEpisodeChoiceStats(episodeId)
  const data = query.data ?? null

  // ---- loading ----
  if (query.isLoading) {
    return <Spin />
  }

  // ---- error ----
  if (query.error) {
    const message =
      query.error instanceof Error ? query.error.message : '未知错误'
    const is403 =
      (query.error as Error & { status?: number }).status === 403

    return (
      <Alert
        type="error"
        showIcon
        message="选项命中数据加载失败"
        description={
          is403
            ? '当前账号无权访问该端点的数据（需 ContentAdmin 权限）。如果你已经能看到这个抽屉，权限面应该是对的——请确认服务端 guard 配置。'
            : message
        }
      />
    )
  }

  // ---- empty ----
  if (
    !data ||
    data.totalInteractions === 0 ||
    data.segments.length === 0
  ) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <span>
            这一集还没有选项命中数据。
            <br />
            <Typography.Text type="secondary">
              两种可能：这一集还没有已发布版本（服务端拿不到段清单，无从铺明细）；
              或者已经发布、但还没有孩子玩到它的二选一交互点——选项命中是新上线的
              统计，此前发生过的互动不会被追溯进来。
            </Typography.Text>
          </span>
        }
      />
    )
  }

  // ---- data ----
  const choiceColumns: ColumnsType<ChoiceItem> = [
    {
      title: '#',
      dataIndex: 'index',
      key: 'index',
      width: 48,
      render: (value: number) => (
        <Typography.Text type="secondary">{value + 1}</Typography.Text>
      ),
    },
    {
      title: '选项标识（key）',
      dataIndex: 'key',
      key: 'key',
      width: 120,
      render: (value: string | null) =>
        value ? (
          <Typography.Text code style={{ fontSize: 12 }}>
            {value}
          </Typography.Text>
        ) : (
          <Typography.Text type="secondary">（无标识）</Typography.Text>
        ),
    },
    {
      title: '选项文案',
      dataIndex: 'text',
      key: 'text',
      render: (value: string | null) =>
        value ? (
          <Typography.Text>{value}</Typography.Text>
        ) : (
          <Typography.Text type="secondary">
            （选项文案缺失）
          </Typography.Text>
        ),
    },
    {
      title: '命中次数',
      dataIndex: 'hits',
      key: 'hits',
      width: 100,
      align: 'right',
      render: (value: number) => (
        <Typography.Text strong>{value}</Typography.Text>
      ),
    },
    {
      title: (
        <>
          确定性匹配
          <InfoTip title="孩子说的话里带上了这个选项的文案（子串匹配，不要求整句相等）从而直接命中的次数。这项偏低说明文案不够贴近口语：孩子自然说出口的那句话里没有原样带上这几个字。" />
        </>
      ),
      dataIndex: 'deterministicHits',
      key: 'deterministicHits',
      width: 110,
      align: 'right',
      render: (value: number) => (
        <Typography.Text type="secondary">{value}</Typography.Text>
      ),
    },
    {
      title: (
        <>
          LLM 判定
          <InfoTip title="确定性匹配没命中、但 LLM 判断孩子选了这个选项的次数。这项偏高说明文案方向对但措辞不够直白。" />
        </>
      ),
      dataIndex: 'llmHits',
      key: 'llmHits',
      width: 100,
      align: 'right',
      render: (value: number) => (
        <Typography.Text type="secondary">{value}</Typography.Text>
      ),
    },
    {
      title: '占比',
      dataIndex: 'share',
      key: 'share',
      width: 80,
      align: 'right',
      render: (value: number | null) => formatPct(value),
    },
  ]

  return (
    <div>
      {/* contentNote —— 服务端下发的固定说明，前端原样渲染 */}
      <Alert
        type="info"
        showIcon
        message={data.contentNote}
        style={{ marginBottom: 8 }}
      />

      {/* 本面板不带日期参数，与「内容与质量」页的区间口径不同，必须写明，
          否则两处同名指标数字对不上会被当成数据错误。 */}
      <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
        统计范围为这一集的
        <Typography.Text strong>全时段累计</Typography.Text>
        ，本面板不按日期筛选；需要按区间对比请去「内容与质量 →
        二选一选项命中」。两处的兜底率分母也不同（见各指标问号说明）。
      </Typography.Paragraph>

      {/* 汇总 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Stat
            title="互动点总次数"
            value={data.totalInteractions}
            tip="这一集所有二选一交互点被触发过的总次数。每次孩子走到一个 two_choice 交互点就算一次互动。"
          />
        </Col>
        <Col span={12}>
          <Stat
            title="命中总次数"
            value={data.matchedTotal}
            tip="孩子说的话被成功匹配到某个选项的总次数。两者的差额既包含走兜底话术的，也包含第一次跑题被引回的和沉默超时的，服务端没有下发汇总口径，所以这里不做减法；要看兜底请看下面每段的「兜底次数」。"
          />
        </Col>
      </Row>

      {/* 分段明细 */}
      {data.segments.map((segment, segmentIndex) => (
        <Card
          key={`segment-${segment.segmentOrder ?? `null-${segmentIndex}`}`}
          size="small"
          style={{ marginBottom: 12 }}
          title={
            <Space size={4} wrap>
              <Typography.Text
                type="secondary"
                style={{ fontFamily: 'monospace' }}
              >
                {segment.segmentOrder !== null
                  ? `#${segment.segmentOrder}`
                  : '未记录段号'}
              </Typography.Text>
              <Typography.Text
                type={segment.promptText ? undefined : 'secondary'}
              >
                {segment.promptText ?? '（无引导词）'}
              </Typography.Text>
              {segment.neverChosen && (
                <Tag color="red">从未被选中</Tag>
              )}
            </Space>
          }
        >
          {/* neverChosen 醒目警示 */}
          {segment.neverChosen && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              message={
                segment.promptText
                  ? `「${segment.promptText}」这个交互点的所有选项从未被任何孩子选中过`
                  : '这个交互点的所有选项从未被任何孩子选中过'
              }
              description={
                <Typography.Text type="secondary">
                  最可能的原因是选项文案或引导词与孩子的自然表达差异太大——
                  孩子说的话里既没带上任何选项的文案，LLM 也判不到任何一个选项上，
                  导致每次都走了兜底话术。建议回到「内容与编辑」tab 修改
                  选项文案，让它更贴近孩子在这个场景里会更自然说出口的话。
                </Typography.Text>
              }
            />
          )}

          {/* 段级统计 */}
          <Row gutter={[16, 8]} style={{ marginBottom: 12 }}>
            <Col span={6}>
              <Statistic
                title="段命中"
                value={segment.matchedTotal}
                styles={{ content: { fontSize: 18 } }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title={
                  <>
                    兜底次数
                    <InfoTip title="该段两个孩子都没匹配上、走了兜底话术的次数。" />
                  </>
                }
                value={segment.fallbackTotal}
                styles={{
                  content:
                    segment.fallbackTotal > 0
                      ? { color: '#cf1322', fontSize: 18 }
                      : { fontSize: 18 },
                }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title={
                  <>
                    兜底率
                    <InfoTip title="fallbackTotal / (matchedTotal + fallbackTotal)。null 表示该段还没有任何互动数据。" />
                  </>
                }
                value={formatPct(segment.fallbackRate)}
                styles={{ content: { fontSize: 18 } }}
              />
            </Col>
          </Row>

          {/* 选项明细表 */}
          {segment.choices.length > 0 && (
            <Table<ChoiceItem>
              columns={choiceColumns}
              dataSource={segment.choices}
              rowKey={(row) => `${segment.segmentOrder ?? 'null'}-${row.index}`}
              size="small"
              pagination={false}
            />
          )}
        </Card>
      ))}
    </div>
  )
}