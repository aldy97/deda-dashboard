import { Button, Empty, Table, Tag, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import type { PromptVersionItem } from '../../types/analytics'
import { versionStateTags } from './labels'

/**
 * 版本历史（审计链）。
 *
 * 只读展示 + 一个入口：回滚到该版本。回滚不是把指针拨回去，而是以目标版本
 * 正文新建 revision 再发布（服务端 git revert 语义），所以历史只增不改，
 * 这里也不提供删除——服务端同样禁止删模板与删版本。
 */

export interface VersionHistoryProps {
  versions: PromptVersionItem[]
  loading?: boolean
  /** 环境认得出来且服务端写开关开着；否则回滚按钮一律禁用 */
  canRollback: boolean
  /** canRollback=false 时给管理员看的理由，不让人以为是页面坏了 */
  disabledReason?: string | null
  /** 当前生效版本号：回滚到它自己是空操作，按钮禁用 */
  publishedRevision: number | null
  onRollback: (version: PromptVersionItem) => void
}

function fmtTime(iso: string | null): string {
  return iso ? dayjs(iso).format('YYYY-MM-DD HH:mm:ss') : '—'
}

export default function VersionHistory({
  versions,
  loading = false,
  canRollback,
  disabledReason = null,
  publishedRevision,
  onRollback,
}: VersionHistoryProps) {
  if (!loading && versions.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <Typography.Text type="secondary">
            这个 prompt 还没被编辑过，当前生效的是代码默认值
          </Typography.Text>
        }
      />
    )
  }

  const columns: ColumnsType<PromptVersionItem> = [
    {
      title: '版本',
      dataIndex: 'revision',
      width: 72,
      render: (revision: number) => (
        <Typography.Text code>r{revision}</Typography.Text>
      ),
    },
    {
      title: '状态',
      width: 96,
      render: (_, version) => {
        const tag = versionStateTags(version)
        return <Tag color={tag.color}>{tag.text}</Tag>
      },
    },
    {
      title: '改动说明',
      dataIndex: 'changeNote',
      render: (note: string | null) =>
        note ? (
          <Typography.Text style={{ whiteSpace: 'pre-wrap' }}>{note}</Typography.Text>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
    {
      title: '操作人',
      width: 140,
      render: (_, version) =>
        version.authorDisplayName || version.authorUsername,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 170,
      render: fmtTime,
    },
    {
      title: '发布时间',
      dataIndex: 'publishedAt',
      width: 170,
      render: fmtTime,
    },
    {
      title: '操作',
      width: 132,
      render: (_, version) => {
        const isCurrent = version.revision === publishedRevision
        const disabled = !canRollback || isCurrent || version.isDraft
        const reason = !canRollback
          ? disabledReason
          : isCurrent
            ? '这就是当前生效版本，无需回滚'
            : version.isDraft
              ? '草稿还没发布，先在上方发布或继续编辑'
              : null
        const button = (
          <Button
            size="small"
            danger
            disabled={disabled}
            onClick={() => onRollback(version)}
          >
            回滚到此版本
          </Button>
        )
        return reason ? (
          <Tooltip title={reason}>{button}</Tooltip>
        ) : (
          button
        )
      },
    },
  ]

  return (
    <Table<PromptVersionItem>
      rowKey="revision"
      size="small"
      loading={loading}
      columns={columns}
      dataSource={versions}
      pagination={false}
      expandable={{
        expandedRowRender: (version) => (
          <pre
            style={{
              margin: 0,
              maxHeight: 260,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: 12,
            }}
          >
            {version.content}
          </pre>
        ),
        rowExpandable: (version) => version.content.length > 0,
      }}
    />
  )
}
