import { useState } from 'react'
import type { ReactNode } from 'react'
import { Alert, Modal, Select, Space, Spin, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import InfoTip from '../../components/InfoTip'
import {
  useAdventureVersion,
  useAdventureVersionDiff,
  useAdventureVersions,
} from '../../api/queries'
import type { VersionSummary } from '../../types/adventureAdmin'
import ContentPreview from './ContentPreview'
import SegmentDiffList from './SegmentDiffList'
import { fmtDateTime, shortHash, versionStatusMeta } from './labels'

/**
 * 版本时间线 + 两版对比。
 *
 * 「快速回滚」的入口在这里（P8 接上按钮），因为回滚的前提是**先看清要回到哪一版**：
 * 时间线只增不改，任何一版都能被复制成新版本重新发布，历史一行都不会被改。
 *
 * 默认对比「当前发布版 vs 它的上一版」——这是出事后第一个要看的差异。
 * 只有一版时不出对比（没有可比的），而不是硬凑成「自己和自己比」。
 *
 * 由父组件用 key={episodeId} 挂载，所以这里不需要处理「切换到另一集」的残留状态。
 */
interface Props {
  episodeId: string
  /** 「回滚到这一版」按钮插槽；只读环境下不传，操作列自然只剩「查看内容」 */
  renderRowAction?: (version: VersionSummary) => ReactNode
}

function VersionContentModal({
  episodeId,
  versionId,
  onClose,
}: {
  episodeId: string
  versionId: string | null
  onClose: () => void
}) {
  const query = useAdventureVersion(episodeId, versionId)
  const detail = query.data ?? null
  return (
    <Modal
      open={versionId !== null}
      onCancel={onClose}
      footer={null}
      width={720}
      title={
        detail
          ? `v${detail.meta.version} 快照内容 · ${versionStatusMeta(detail.meta.status).label}`
          : '版本快照内容'
      }
    >
      <Spin spinning={query.isFetching}>
        {query.error && (
          <Alert
            type="error"
            showIcon
            message="快照加载失败"
            description={(query.error as Error).message}
          />
        )}
        {detail && <ContentPreview content={detail.content} />}
      </Spin>
    </Modal>
  )
}

export default function VersionHistory({ episodeId, renderRowAction }: Props) {
  const versionsQuery = useAdventureVersions(episodeId)
  const versions = versionsQuery.data ?? []

  const [previewVersionId, setPreviewVersionId] = useState<string | null>(null)

  // 默认对比「当前发布版 vs 它的上一版」——出事后第一个要看的差异。
  // 每次渲染直接算而不用 useMemo：版本行最多几十条，算一次的成本远低于
  // 「react-query 每次返回新数组引用 → memo 反复失效」带来的心智负担。
  const currentIndex = versions.findIndex((row) => row.isCurrent)
  const rightIndex = currentIndex >= 0 ? currentIndex : 0
  const defaultRight = versions[rightIndex]?.id ?? null
  const defaultLeft = versions[rightIndex + 1]?.id ?? null

  // 人工选择带上「它基于哪一份版本列表做出」的指纹。刚发布 / 刚回滚后指纹变了，
  // 旧选择自动失效并回落到默认对比对——否则框里会留着一个已经不是当前版的选择，
  // 看上去像是回滚没生效。用派生值而不是 useEffect + setState，少一轮渲染。
  const fingerprint = versions.map((row) => row.id).join(',')
  const [picked, setPicked] = useState<{
    fingerprint: string
    left: string | null
    right: string | null
  } | null>(null)
  const active = picked && picked.fingerprint === fingerprint ? picked : null
  const left = active ? active.left : defaultLeft
  const right = active ? active.right : defaultRight

  const diffQuery = useAdventureVersionDiff(
    episodeId,
    left !== null && left !== right ? left : null,
    right,
  )
  const diff = diffQuery.data ?? null

  const options = versions.map((row) => ({
    value: row.id,
    label: `v${row.version} · ${versionStatusMeta(row.status).label} · ${fmtDateTime(row.createdAt)}`,
  }))

  const columns: ColumnsType<VersionSummary> = [
    {
      title: '版本',
      key: 'version',
      width: 110,
      render: (_, row) => (
        <Space size={4}>
          <Typography.Text strong>v{row.version}</Typography.Text>
          {row.isCurrent && <Tag color="green">当前</Tag>}
        </Space>
      ),
    },
    {
      title: '状态',
      key: 'status',
      width: 110,
      render: (_, row) => {
        const meta = versionStatusMeta(row.status)
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    { title: '标题', dataIndex: 'title', key: 'title', ellipsis: true },
    {
      title: (
        <>
          段数
          <InfoTip title="这一版快照里的段落总数。引擎用 order >= segments.length 判完集，所以段数变化会直接改变孩子的播放长度。" />
        </>
      ),
      dataIndex: 'segmentCount',
      key: 'segmentCount',
      width: 80,
    },
    {
      title: (
        <>
          变更说明
          <InfoTip title="操作人当时填的理由（至少 8 个字）。半年后只能靠这一栏看懂当初为什么这么改。" />
        </>
      ),
      dataIndex: 'changeNote',
      key: 'changeNote',
      width: 220,
      render: (value: string | null) =>
        value ? value : <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: '创建人',
      dataIndex: 'createdByName',
      key: 'createdByName',
      width: 110,
    },
    {
      title: '创建时间',
      key: 'createdAt',
      width: 170,
      render: (_, row) => fmtDateTime(row.createdAt),
    },
    {
      title: '发布时间',
      key: 'publishedAt',
      width: 170,
      render: (_, row) => fmtDateTime(row.publishedAt),
    },
    {
      title: (
        <>
          内容哈希
          <InfoTip title="只由内容决定，不含身份字段与时间戳——所以同一份内容在 staging 与 prod 算出的哈希一致，跨环境搬运靠它判断是新增还是替换。" />
        </>
      ),
      key: 'contentHash',
      width: 140,
      render: (_, row) => (
        <Typography.Text code style={{ fontSize: 12 }}>
          {shortHash(row.contentHash)}
        </Typography.Text>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 170,
      fixed: 'right',
      render: (_, row) => (
        <Space size={4}>
          <Typography.Link onClick={() => setPreviewVersionId(row.id)}>
            查看内容
          </Typography.Link>
          {renderRowAction?.(row)}
        </Space>
      ),
    },
  ]

  return (
    <Spin spinning={versionsQuery.isLoading}>
      {versionsQuery.error && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message="版本时间线加载失败"
          description={(versionsQuery.error as Error).message}
        />
      )}

      <Table
        columns={columns}
        dataSource={versions}
        rowKey="id"
        size="small"
        pagination={false}
        scroll={{ x: 1400 }}
        locale={{ emptyText: '这一集还没有任何版本' }}
      />

      <div style={{ marginTop: 20 }}>
        <Space size={8} wrap style={{ marginBottom: 12 }}>
          <Typography.Text strong>版本对比</Typography.Text>
          <Select
            style={{ width: 340 }}
            placeholder="旧版本"
            value={left}
            onChange={(value) => setPicked({ fingerprint, left: value ?? null, right })}
            options={options}
            allowClear
          />
          <Typography.Text type="secondary">→</Typography.Text>
          <Select
            style={{ width: 340 }}
            placeholder="新版本"
            value={right}
            onChange={(value) => setPicked({ fingerprint, left, right: value ?? null })}
            options={options}
            allowClear
          />
        </Space>

        {left === null || right === null ? (
          <Typography.Text type="secondary">
            选择两个版本即可查看逐段差异。
          </Typography.Text>
        ) : left === right ? (
          <Typography.Text type="secondary">
            两侧是同一个版本，请另选一版。
          </Typography.Text>
        ) : (
          <Spin spinning={diffQuery.isFetching}>
            {diffQuery.error && (
              <Alert
                type="error"
                showIcon
                message="差异计算失败"
                description={(diffQuery.error as Error).message}
              />
            )}
            {diff && (
              <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                <Space size={8} wrap>
                  <Typography.Text type="secondary">
                    v{diff.left.version} → v{diff.right.version}
                  </Typography.Text>
                  {diff.titleChanged && <Tag color="orange">标题有改动</Tag>}
                  {diff.recapChanged && <Tag color="orange">开场回顾有改动</Tag>}
                  <Tag color="green">新增 {diff.added.length}</Tag>
                  <Tag color="red">删除 {diff.removed.length}</Tag>
                  <Tag color="orange">修改 {diff.changed.length}</Tag>
                </Space>
                <SegmentDiffList diffs={diff.segmentDiffs} />
              </Space>
            )}
          </Spin>
        )}
      </div>

      <VersionContentModal
        episodeId={episodeId}
        versionId={previewVersionId}
        onClose={() => setPreviewVersionId(null)}
      />
    </Spin>
  )
}
