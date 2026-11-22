import { Alert, Button, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ReloadOutlined } from '@ant-design/icons'
import { useCharacterTestDevices } from '../../api/queries'
import type { CharacterTestDevice } from '../../types/adventureAdmin'
import { fmtDateTime, versionStatusMeta } from './labels'

/**
 * 当前 IP 下已经下发到样机的故事集列表。
 *
 * 数据源是 device 上的两条字段（每台设备同时只记一集），不是审计流水：
 * 下发会覆盖、清除会清空，拿历史推导会列出早已换走的设备。
 *
 * `stale` 只是提醒「重新下发会换到更新的快照」，不是故障：设备的播放仍锁在
 * 它自己那一版上。这一点必须写清楚，否则有人会以为旧快照播不了。
 */
interface Props {
  characterKey: string | null
}

export default function DeviceTestAssignList({ characterKey }: Props) {
  const query = useCharacterTestDevices(characterKey, characterKey !== null)
  const data = query.data ?? null
  const rows = data?.devices ?? []
  const truncated = data !== null && data.total > rows.length

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
        <Space orientation="vertical" size={0}>
          <Typography.Text code>{row.deviceId}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {row.deviceCode ?? '未登记设备编码'}
          </Typography.Text>
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
      render: (_, row) => (
        <Space size={4} wrap>
          {row.episode.retiredAt && <Tag color="red">已下架</Tag>}
          {row.stale && <Tag color="gold">旧快照</Tag>}
          {!row.episode.retiredAt && !row.stale && (
            <Typography.Text type="secondary">—</Typography.Text>
          )}
        </Space>
      ),
    },
    {
      title: '下发时间',
      key: 'lastAssignedAt',
      width: 180,
      render: (_, row) => fmtDateTime(row.lastAssignedAt),
    },
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
        scroll={{ x: 900 }}
        locale={{ emptyText: '这个 IP 下还没有样机被下发测试故事' }}
      />
    </div>
  )
}
