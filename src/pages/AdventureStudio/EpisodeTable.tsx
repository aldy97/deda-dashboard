import { useState } from 'react'
import {
  Alert,
  Button,
  Checkbox,
  Empty,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PlusOutlined } from '@ant-design/icons'
import {
  useAdventureCapabilities,
  useAdventureEpisodes,
} from '../../api/queries'
import type {
  AdventureCharacterKey,
  EpisodeSummary,
} from '../../types/adventureAdmin'
import { characterLabel, fmtDateTime } from './labels'

/**
 * 故事集列表。
 *
 * 三个状态维度必须并排显示，因为它们各自回答不同的问题：
 * - published：孩子能不能被分配到这一集（引擎只从已发布池里选）
 * - hasDraft：有没有人正在改、改到哪一版（多人创作时最先要看的信息）
 * - retiredAt：这一集是不是已经被下架成墓碑（下架不等于删除，历史仍可追溯）
 *
 * 分页由服务端做，total 用来算页数；pageSize 最大 200（服务端会截断，前端不放大）。
 */
interface Props {
  onOpen: (episodeId: string) => void
  /** authoring 环境才传；未传则不渲染「新建故事集」按钮 */
  onCreate?: () => void
}

const PAGE_SIZE_OPTIONS = [20, 50, 100, 200]

const PUBLISHED_OPTIONS = [
  { value: 'all', label: '全部发布状态' },
  { value: 'published', label: '只看已发布' },
  { value: 'unpublished', label: '只看未发布' },
]

function StatusTags({ row }: { row: EpisodeSummary }) {
  return (
    <Space size={4} wrap>
      {row.retiredAt ? (
        <Tag color="red">已下架</Tag>
      ) : row.published ? (
        <Tag color="green">已发布</Tag>
      ) : (
        <Tag color="gold">未发布</Tag>
      )}
      {row.hasDraft && <Tag color="blue">有草稿 v{row.draftVersion}</Tag>}
    </Space>
  )
}

export default function EpisodeTable({ onOpen, onCreate }: Props) {
  const caps = useAdventureCapabilities()
  const characterKeys = caps.data?.characterKeys ?? []

  const [characterKey, setCharacterKey] = useState<AdventureCharacterKey | undefined>()
  const [published, setPublished] = useState<'all' | 'published' | 'unpublished'>(
    'all',
  )
  const [includeRetired, setIncludeRetired] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const episodesQuery = useAdventureEpisodes({
    characterKey,
    published: published === 'all' ? undefined : published === 'published',
    includeRetired: includeRetired || undefined,
    search: search || undefined,
    page,
    pageSize,
  })
  const data = episodesQuery.data ?? null

  const columns: ColumnsType<EpisodeSummary> = [
    {
      title: '业务键',
      dataIndex: 'businessKey',
      key: 'businessKey',
      width: 110,
      render: (value: string) => (
        <Typography.Text code>{value}</Typography.Text>
      ),
    },
    {
      title: 'IP',
      dataIndex: 'characterKey',
      key: 'characterKey',
      width: 100,
      render: (value: string) => characterLabel(value),
    },
    {
      title: '集号',
      dataIndex: 'episodeNumber',
      key: 'episodeNumber',
      width: 70,
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '状态',
      key: 'status',
      width: 160,
      render: (_, row) => <StatusTags row={row} />,
    },
    {
      title: '当前发布版',
      key: 'currentVersion',
      width: 170,
      render: (_, row) =>
        row.currentVersion === null ? (
          <Typography.Text type="secondary">—</Typography.Text>
        ) : (
          <Space orientation="vertical" size={0}>
            <Typography.Text>v{row.currentVersion}</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {fmtDateTime(row.publishedAt)}
            </Typography.Text>
          </Space>
        ),
    },
    {
      title: '草稿',
      key: 'draft',
      width: 200,
      render: (_, row) =>
        !row.hasDraft ? (
          <Typography.Text type="secondary">—</Typography.Text>
        ) : (
          <Space orientation="vertical" size={0}>
            <Typography.Text>v{row.draftVersion}</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {row.draftUpdatedBy ?? '未知'} · {fmtDateTime(row.draftUpdatedAt)}
            </Typography.Text>
          </Space>
        ),
    },
    {
      title: '更新时间',
      key: 'updatedAt',
      width: 170,
      render: (_, row) => fmtDateTime(row.updatedAt),
    },
    {
      title: '操作',
      key: 'actions',
      width: 90,
      fixed: 'right',
      render: (_, row) => (
        <Typography.Link onClick={() => onOpen(row.id)}>打开</Typography.Link>
      ),
    },
  ]

  return (
    <div>
      <Space size={8} wrap style={{ marginBottom: 12 }}>
        <Select
          style={{ width: 150 }}
          placeholder="全部 IP"
          allowClear
          value={characterKey}
          onChange={(value) => {
            setCharacterKey(value)
            setPage(1)
          }}
          options={characterKeys.map((key) => ({
            value: key,
            label: characterLabel(key),
          }))}
        />
        <Select
          style={{ width: 160 }}
          value={published}
          onChange={(value) => {
            setPublished(value)
            setPage(1)
          }}
          options={PUBLISHED_OPTIONS}
        />
        <Checkbox
          checked={includeRetired}
          onChange={(event) => {
            setIncludeRetired(event.target.checked)
            setPage(1)
          }}
        >
          含已下架
        </Checkbox>
        <Input.Search
          style={{ width: 240 }}
          placeholder="搜索标题 / 集号"
          allowClear
          maxLength={50}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
        />
        {onCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
            新建故事集
          </Button>
        )}
      </Space>

      {episodesQuery.error && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message="故事集列表加载失败"
          description={(episodesQuery.error as Error).message}
        />
      )}

      {data === null && episodesQuery.isLoading ? (
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
          onRow={(row) => ({
            onClick: () => onOpen(row.id),
            style: { cursor: 'pointer' },
          })}
          pagination={{
            current: page,
            pageSize,
            total: data.total,
            showSizeChanger: true,
            pageSizeOptions: PAGE_SIZE_OPTIONS.map(String),
            showTotal: (total) => `共 ${total} 集`,
            onChange: (nextPage, nextPageSize) => {
              setPage(nextPage)
              setPageSize(nextPageSize)
            },
          }}
        />
      ) : (
        <Empty description="没有符合条件的故事集">
          {onCreate && (
            <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
              新建第一集
            </Button>
          )}
        </Empty>
      )}
    </div>
  )
}
