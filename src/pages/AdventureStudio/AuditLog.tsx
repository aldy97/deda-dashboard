import { useState } from 'react'
import {
  Alert,
  Empty,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { Dayjs } from 'dayjs'
import AnalyticsRangePicker from '../../components/AnalyticsRangePicker'
import InfoTip from '../../components/InfoTip'
import { useAdventureAudit } from '../../api/queries'
import type { AuditItem } from '../../types/adventureAdmin'
import { AUDIT_ACTION_OPTIONS, auditActionMeta, fmtDateTime, shortHash } from './labels'
import type { DayRange } from '../../utils/date-range'

/**
 * 审计流水：谁、在什么时候、对哪一集、做了什么、**理由是什么**。
 *
 * 这张表是整套内容管理台存在的理由——半年后线上出问题，能回答「是谁在什么理由下
 * 改的」比任何监控图都重要。所以：
 * - 理由列常驻显示，不折进详情（它是主要信息，不是附加信息）；
 * - 环境列（authoring / readonly）常驻显示，用来区分「staging 试的」和「prod 真改的」；
 * - detail 是可展开的自由结构 JSON，原样展示不做美化：巡检摘要、导入计划、自检漂移
 *   各自形状不同，前端一旦挑字段展示就会漏掉服务端新加的内容。
 *
 * 传 episodeId 时是「本集审计」视图，筛选条件收窄到动作与人，不再显示全局筛选。
 */
interface Props {
  episodeId?: string
}

const PAGE_SIZE_OPTIONS = [20, 50, 100, 200]

function DetailBody({ detail }: { detail: unknown }) {
  if (detail === null || detail === undefined) {
    return <Typography.Text type="secondary">无附加信息</Typography.Text>
  }
  return (
    <pre
      style={{
        margin: 0,
        maxHeight: 320,
        overflow: 'auto',
        fontSize: 12,
        background: '#fafafa',
        padding: 8,
        borderRadius: 4,
      }}
    >
      {JSON.stringify(detail, null, 2)}
    </pre>
  )
}

export default function AuditLog({ episodeId }: Props) {
  const [action, setAction] = useState<string | undefined>()
  const [actorUsername, setActorUsername] = useState('')
  const [range, setRange] = useState<DayRange | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const auditQuery = useAdventureAudit({
    episodeId: episodeId || undefined,
    action,
    actorUsername: actorUsername || undefined,
    from: range ? (range[0] as Dayjs).startOf('day').toISOString() : undefined,
    to: range ? (range[1] as Dayjs).endOf('day').toISOString() : undefined,
    page,
    pageSize,
  })
  const data = auditQuery.data ?? null

  const columns: ColumnsType<AuditItem> = [
    {
      title: '时间',
      key: 'createdAt',
      width: 170,
      render: (_, row) => fmtDateTime(row.createdAt),
    },
    {
      title: '动作',
      key: 'action',
      width: 130,
      render: (_, row) => {
        const meta = auditActionMeta(row.action)
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: '业务键',
      dataIndex: 'businessKey',
      key: 'businessKey',
      width: 130,
      render: (value: string) => <Typography.Text code>{value}</Typography.Text>,
    },
    {
      title: (
        <>
          操作人
          <InfoTip title="审计里的「谁」。服务端在 JWT 缺 username 时会直接拒绝执行内容操作，所以这一栏永远能追到具体的人，不会出现 unknown。" />
        </>
      ),
      key: 'actor',
      width: 150,
      render: (_, row) => (
        <Space orientation="vertical" size={0}>
          <Typography.Text>{row.actorDisplayName}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {row.actorUsername}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: (
        <>
          环境
          <InfoTip title="操作发生时服务端的 CONTENT_ADMIN_PROFILE。authoring = 可写环境（staging），readonly = 只读环境。用来区分「staging 试的」和「prod 真改的」。" />
        </>
      ),
      key: 'profile',
      width: 100,
      render: (_, row) => (
        <Tag color={row.profile === 'authoring' ? 'green' : 'default'}>
          {row.profile}
        </Tag>
      ),
    },
    {
      title: (
        <>
          理由
          <InfoTip title="每次变更都必须填、至少 8 个字，由服务端强制。这一栏是整套审计的核心，所以常驻显示而不是折进详情。" />
        </>
      ),
      dataIndex: 'reason',
      key: 'reason',
      render: (value: string | null) =>
        value ? value : <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: '来源 bundle',
      key: 'sourceBundleHash',
      width: 140,
      render: (_, row) =>
        row.sourceBundleHash ? (
          <Typography.Text code style={{ fontSize: 12 }}>
            {shortHash(row.sourceBundleHash)}
          </Typography.Text>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
  ]

  return (
    <div>
      <Space size={8} wrap style={{ marginBottom: 12 }}>
        <Select
          style={{ width: 180 }}
          placeholder="全部动作"
          allowClear
          value={action}
          onChange={(value) => {
            setAction(value)
            setPage(1)
          }}
          options={AUDIT_ACTION_OPTIONS}
        />
        <Input.Search
          style={{ width: 200 }}
          placeholder="操作人 username"
          allowClear
          maxLength={64}
          value={actorUsername}
          onChange={(event) => {
            setActorUsername(event.target.value)
            setPage(1)
          }}
        />
        <AnalyticsRangePicker
          value={range}
          allowClear
          onChange={(next) => {
            setRange(next)
            setPage(1)
          }}
        />
      </Space>

      {auditQuery.error && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message="审计流水加载失败"
          description={(auditQuery.error as Error).message}
        />
      )}

      {data === null && auditQuery.isLoading ? (
        <Table
          columns={columns}
          dataSource={[]}
          rowKey="id"
          size="small"
          loading
          pagination={false}
        />
      ) : data && data.items.length > 0 ? (
        <Table
          columns={columns}
          dataSource={data.items}
          rowKey="id"
          size="small"
          scroll={{ x: 1200 }}
          expandable={{
            rowExpandable: (row) => row.detail !== null && row.detail !== undefined,
            expandedRowRender: (row) => <DetailBody detail={row.detail} />,
          }}
          pagination={{
            current: page,
            pageSize,
            total: data.total,
            showSizeChanger: true,
            pageSizeOptions: PAGE_SIZE_OPTIONS.map(String),
            showTotal: (total) => `共 ${total} 条`,
            onChange: (nextPage, nextPageSize) => {
              setPage(nextPage)
              setPageSize(nextPageSize)
            },
          }}
        />
      ) : (
        <Empty description="没有符合条件的审计记录" />
      )}
    </div>
  )
}
