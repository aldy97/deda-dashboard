import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  Alert,
  Button,
  Dropdown,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { MoreOutlined, ReloadOutlined } from '@ant-design/icons'
import AccessLink from '../../components/access/AccessLink'
import CopyableText from '../../components/CopyableText'
import type { ApiError } from '../../api/client'
import {
  useAssignTestStory,
  useCharacterTestDevices,
  useClearTestStory,
} from '../../api/queries'
import type { CharacterTestDevice } from '../../types/adventureAdmin'
import ReasonDialog from './ReasonDialog'
import { fmtDateTime, versionStatusMeta } from './labels'

/**
 * 当前 IP 下已经下发到样机的故事集列表。
 *
 * 数据源是 device 上的两条字段（每台设备同时只记一集），不是审计流水：
 * 下发会覆盖、清除会清空，拿历史推导会列出早已换走的设备。
 *
 * `stale` 只是提醒「重新下发会换到更新的快照」，不是故障：设备的播放仍锁在
 * 它自己那一版上。这一点必须写清楚，否则有人会以为旧快照播不了。
 *
 * 行内动作必须用 `row.episode.id`，不能用抽屉当前这一集的 id：列表按 IP 跨集
 * 展示，混用会把别的集错发到这台设备上。
 */
interface Props {
  characterKey: string | null
  /** 只读环境不给写入口（服务端同样会 403） */
  writable: boolean
}

type ActionKind = 'assign' | 'clear'

interface PendingAction {
  kind: ActionKind
  row: CharacterTestDevice
}

interface ResultNote {
  tone: 'success' | 'error'
  text: string
}

export default function DeviceTestAssignList({
  characterKey,
  writable,
}: Props) {
  const query = useCharacterTestDevices(characterKey, characterKey !== null)
  const assign = useAssignTestStory()
  const clear = useClearTestStory()
  const [action, setAction] = useState<PendingAction | null>(null)
  const [result, setResult] = useState<ResultNote | null>(null)

  const data = query.data ?? null
  const rows = data?.devices ?? []
  const truncated = data !== null && data.total > rows.length
  const error =
    ((action?.kind === 'clear' ? clear.error : assign.error) as ApiError | null) ??
    null
  const pending = assign.isPending || clear.isPending

  function openAction(kind: ActionKind, row: CharacterTestDevice) {
    setResult(null)
    setAction({ kind, row })
  }

  function submit(values: { reason: string }) {
    if (!action) return
    const { kind, row } = action
    const target = { episodeId: row.episode.id, deviceId: row.deviceId }

    if (kind === 'assign') {
      assign.mutate(
        { ...target, reason: values.reason },
        {
          onSuccess: (res) => {
            setAction(null)
            if (!res.audited) {
              setResult({
                tone: 'error',
                text: '已下发，但审计没写进去（audited=false）。这一次动作没有留痕，请人工记录时间与理由。',
              })
              return
            }
            setResult({
              tone: 'success',
              text: `已重新下发「${res.assignment.title}」到 ${row.deviceId}（${res.assignment.versionStatus === 'draft' ? '草稿快照' : '当前发布版'}）。孩子说「测试冒险故事」即可播放。`,
            })
          },
        },
      )
      return
    }

    clear.mutate(
      { ...target, reason: values.reason },
      {
        onSuccess: (res) => {
          setAction(null)
          if (!res.audited) {
            setResult({
              tone: 'error',
              text: '已清除下发，但审计没写进去（audited=false）。这一次动作没有留痕，请人工记录时间与理由。',
            })
            return
          }
          setResult({
            tone: 'success',
            text: `已清除 ${row.deviceId} 的下发。`,
          })
        },
      },
    )
  }

  const columns: ColumnsType<CharacterTestDevice> = [
    {
      title: '故事集',
      key: 'episode',
      width: 240,
      render: (_, row) => (
        <Space orientation="vertical" size={0}>
          <Typography.Text code>{row.episode.businessKey}</Typography.Text>
          <Typography.Text>{row.episode.title || '（未填标题）'}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '设备',
      key: 'device',
      width: 190,
      render: (_, row) => (
        <Space size={4}>
          <AccessLink
            hint="device-profile"
            to={`/users/${encodeURIComponent(row.deviceId)}`}
            style={{ fontFamily: 'monospace' }}
          >
            {row.deviceId}
          </AccessLink>
          <CopyableText text={row.deviceId} tip="复制设备 ID" />
        </Space>
      ),
    },
    {
      title: '锁定版本',
      key: 'version',
      width: 160,
      render: (_, row) => {
        if (row.followsCurrent || !row.version) {
          return <Typography.Text type="secondary">跟随当前发布版</Typography.Text>
        }
        const meta = versionStatusMeta(row.version.status)
        return (
          <Space size={4}>
            <Typography.Text>v{row.version.version}</Typography.Text>
            <Tag color={meta.color}>{meta.label}</Tag>
          </Space>
        )
      },
    },
    {
      title: '状态',
      key: 'status',
      width: 150,
      render: (_, row) => {
        const tags: ReactNode[] = []
        if (row.episode.retiredAt) {
          tags.push(
            <Tag key="retired" color="red">
              已下架
            </Tag>,
          )
        }
        if (row.stale) {
          tags.push(
            <Tooltip
              key="stale"
              title="设备锁的快照已不是现在重新下发会选中的版本；重新下发即可更新，当前播放不受影响。"
            >
              <Tag color="gold">旧快照</Tag>
            </Tooltip>,
          )
        }
        if (tags.length === 0) {
          return <Typography.Text type="secondary">最新</Typography.Text>
        }
        return (
          <Space size={4} wrap>
            {tags}
          </Space>
        )
      },
    },
    {
      title: '下发时间',
      key: 'lastAssignedAt',
      width: 180,
      render: (_, row) => fmtDateTime(row.lastAssignedAt),
    },
    ...(writable
      ? [
          {
            title: '操作',
            key: 'actions',
            width: 80,
            fixed: 'right' as const,
            render: (_: unknown, row: CharacterTestDevice) => (
              <Dropdown
                trigger={['click']}
                menu={{
                  items: [
                    { key: 'assign', label: '重新下发到最新版本' },
                    { key: 'clear', label: '清除下发', danger: true },
                  ],
                  onClick: ({ key }) => openAction(key as ActionKind, row),
                }}
              >
                <Button
                  size="small"
                  type="text"
                  icon={<MoreOutlined />}
                  aria-label="操作"
                />
              </Dropdown>
            ),
          },
        ]
      : []),
  ]

  return (
    <div style={{ marginTop: 8 }}>
      <Space size={8} wrap style={{ marginBottom: 8 }}>
        <Typography.Text strong>当前已下发的样机</Typography.Text>
        {data && <Typography.Text type="secondary">共 {data.total} 台</Typography.Text>}
        <Button
          size="small"
          icon={<ReloadOutlined />}
          loading={query.isFetching}
          onClick={() => void query.refetch()}
        >
          刷新
        </Button>
      </Space>

      {result && (
        <Alert
          type={result.tone}
          showIcon
          closable
          style={{ marginBottom: 8 }}
          message={result.text}
          onClose={() => setResult(null)}
        />
      )}

      {query.error && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 8 }}
          message="样机下发列表加载失败"
          description={(query.error as Error).message}
        />
      )}

      {truncated && (
        <Typography.Text type="warning" style={{ display: 'block', marginBottom: 8 }}>
          仅显示前 {rows.length} 台，共 {data?.total} 台。
        </Typography.Text>
      )}

      <Table
        columns={columns}
        dataSource={rows}
        rowKey="deviceId"
        size="small"
        loading={query.isLoading}
        pagination={false}
        scroll={{ x: writable ? 1000 : 920 }}
        locale={{ emptyText: '这个 IP 下还没有样机被下发测试故事' }}
      />

      {action?.kind === 'assign' && (
        <ReasonDialog
          key="assign"
          open
          title="重新下发到最新版本"
          okText="确认下发"
          pending={pending}
          error={error}
          onCancel={() => setAction(null)}
          onSubmit={submit}
          description={
            <Space orientation="vertical" size={6} style={{ width: '100%' }}>
              <Typography.Text>
                把 <Typography.Text code>{action.row.episode.businessKey}</Typography.Text>
                「{action.row.episode.title || '（未填标题）'}」重新下发到{' '}
                <Typography.Text code>{action.row.deviceId}</Typography.Text>
                ：锁定的版本会换成现在的最新快照。
              </Typography.Text>
              <Typography.Text type="secondary">
                有草稿时锁草稿快照，否则锁当前发布版。孩子下一次说「测试冒险故事」即从第
                0 段播放；正在进行的这一轮不受影响。会落一条审计。
              </Typography.Text>
              {action.row.episode.retiredAt && (
                <Typography.Text type="warning">
                  注意：这一集已下架。重新下发后样机仍能播放，但正式设备不会再被分配这一集。
                </Typography.Text>
              )}
            </Space>
          }
        />
      )}

      {action?.kind === 'clear' && (
        <ReasonDialog
          key="clear"
          open
          title="清除样机下发"
          okText="确认清除"
          danger
          pending={pending}
          error={error}
          onCancel={() => setAction(null)}
          onSubmit={submit}
          description={
            <Space orientation="vertical" size={6} style={{ width: '100%' }}>
              <Typography.Text>
                清除 <Typography.Text code>{action.row.deviceId}</Typography.Text> 上的{' '}
                <Typography.Text code>{action.row.episode.businessKey}</Typography.Text>{' '}
                下发。清除后孩子说「测试冒险故事」会得到「还没有下发」的确定性回复。
              </Typography.Text>
              <Typography.Text type="secondary">
                只有该设备当前下发的正是这一集才会被清除，否则服务端会拒绝（409）。会落一条审计。
              </Typography.Text>
            </Space>
          }
        />
      )}
    </div>
  )
}
