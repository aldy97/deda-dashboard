import { useState } from 'react'
import {
  Alert,
  Button,
  Dropdown,
  Empty,
  Image,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import type { MenuProps } from 'antd'
import { MoreOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import PageHeader from '../../components/PageHeader'
import {
  useAppAssetKeys,
  useAppAssets,
  useArchiveAppAsset,
  usePublishAppAsset,
} from '../../api/appAssets'
import type { AppAsset, AppAssetGroup } from '../../types/appAssets'
import { formatBytes, formatDims, formatTime } from './labels'
import { copyText } from './clipboard'
import AssetUploadDrawer from './AssetUploadDrawer'
import VersionHistoryDrawer from './VersionHistoryDrawer'

/** 诊断展示位是服务端内置兜底，不算「有业务素材可管理」 */
const DIAGNOSTIC_KEY = 'diagnostics/remote-probe'

type RowAction = 'upload' | 'publish' | 'archive' | 'history' | 'preview' | 'copy'

/**
 * 单行动作收成一个「操作」下拉菜单：操作列从 360px 降到 80px，整表约 1198px，
 * 14 寸屏（内容区约 1224px）不必横向滚动。菜单项按当前状态裁剪——没有草稿
 * 就没有「发布」，没有版本就没有「预览 / 复制 URL」。
 *
 * 发布 / 下架仍要二次确认，但换成同一行的受控 Modal：下拉菜单里的 action item
 * 一旦点击就关浮层，没有可挂 Popconfirm 的锚点。
 *
 * 单行独立成组件：发布 / 下架两个 mutation 都要按 key 作废缓存，必须拿到当前行
 * 的 key，不能在一个父组件里用一个 hook 覆盖所有行。
 */
function AssetRow({
  group,
  onOpenUpload,
  onOpenHistory,
  onPreview,
}: {
  group: AppAssetGroup
  onOpenUpload: () => void
  onOpenHistory: () => void
  onPreview: (asset: AppAsset) => void
}) {
  const publish = usePublishAppAsset(group.key)
  const archive = useArchiveAppAsset(group.key)
  const [confirming, setConfirming] = useState<'publish' | 'archive' | null>(
    null,
  )
  const [copying, setCopying] = useState(false)
  const [copied, setCopied] = useState(false)
  const previewAsset = group.published ?? group.latestDraft

  const items: MenuProps['items'] = [
    { key: 'upload', label: '新建版本' },
    ...(group.latestDraft ? [{ key: 'publish', label: '发布' }] : []),
    ...(group.published
      ? [{ key: 'archive', label: '下架', danger: true }]
      : []),
    { key: 'history', label: '版本历史' },
    ...(previewAsset
      ? [
          { key: 'preview', label: '预览' },
          { key: 'copy', label: copied ? '已复制 URL' : '复制 URL' },
        ]
      : []),
  ]

  const handleAction = async (action: RowAction) => {
    switch (action) {
      case 'upload':
        onOpenUpload()
        return
      case 'publish':
      case 'archive':
        setConfirming(action)
        return
      case 'history':
        onOpenHistory()
        return
      case 'preview':
        if (previewAsset) onPreview(previewAsset)
        return
      case 'copy': {
        if (!previewAsset || copying) return
        setCopying(true)
        try {
          const ok = await copyText(previewAsset.url)
          if (ok) {
            setCopied(true)
            message.success('已复制 URL')
          } else {
            message.error('复制失败，请手动复制')
          }
        } finally {
          setCopying(false)
        }
        return
      }
    }
  }

  const confirmCopy =
    confirming === 'publish'
      ? {
          title: '发布这个草稿？',
          description: '发布后该草稿将立即成为小程序的展示素材。',
        }
      : {
          title: '下架当前发布版本？',
          description: '下架后该展示位将没有已发布素材。',
        }
  const confirmingMutation = confirming === 'publish' ? publish : archive

  const runConfirmed = () => {
    if (confirming === 'publish' && group.latestDraft) {
      publish.mutate(group.latestDraft.id, {
        onSuccess: () => {
          setConfirming(null)
          message.success('已发布')
        },
      })
    } else if (confirming === 'archive' && group.published) {
      archive.mutate(group.published.id, {
        onSuccess: () => {
          setConfirming(null)
          message.success('已下架')
        },
      })
    }
  }

  return (
    <>
      <Dropdown
        trigger={['click']}
        menu={{
          items,
          onClick: ({ key }) => void handleAction(key as RowAction),
        }}
      >
        <Button size="small" type="text" icon={<MoreOutlined />} aria-label="操作" />
      </Dropdown>
      <Modal
        open={confirming !== null}
        title={confirmCopy.title}
        okText="确认"
        cancelText="取消"
        confirmLoading={confirmingMutation.isPending}
        onOk={runConfirmed}
        onCancel={() => setConfirming(null)}
      >
        {confirmCopy.description}
      </Modal>
    </>
  )
}

/**
 * Elly 素材管理（仅 superadmin，路由层 OpsGate 已挡住普通 admin）。
 *
 * 列表按展示位 key 分组；上传新版本走抽屉，发布 / 下架 / 回滚都在行内或
 * 版本历史抽屉里二次确认。注册表为空或只有内置诊断位时给空态说明，
 * 而不是让管理员对着一个「未发布」的占位行猜。
 */
export default function AppAssets() {
  const keysQuery = useAppAssetKeys()
  const assetsQuery = useAppAssets()

  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadPresetKey, setUploadPresetKey] = useState<string | null>(null)
  const [historyGroup, setHistoryGroup] = useState<AppAssetGroup | null>(null)
  const [previewAsset, setPreviewAsset] = useState<AppAsset | null>(null)

  const keys = keysQuery.data ?? []
  const groups = assetsQuery.data ?? []

  const registryEmpty = keys.length === 0
  const onlyDiagnostic =
    keys.length === 1 && keys[0].key === DIAGNOSTIC_KEY

  const openUpload = (presetKey?: string) => {
    setUploadPresetKey(presetKey ?? null)
    setUploadOpen(true)
  }

  const columns: ColumnsType<AppAssetGroup> = [
    {
      title: '展示位',
      dataIndex: 'key',
      // 不定宽列在窄屏会被压到一两个字宽（中文与 code 逐字断行、行高爆掉），
      // 配合下方 scroll.x 让表格横向滚动而不是压缩列。
      width: 240,
      render: (_, group) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{group.label}</Typography.Text>
          <Typography.Text code style={{ fontSize: 12 }}>
            {group.key}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {group.page}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '当前发布版本',
      dataIndex: 'published',
      width: 120,
      render: (_, group) =>
        group.published ? (
          <Typography.Text strong>v{group.published.version}</Typography.Text>
        ) : (
          <Typography.Text type="secondary">未发布</Typography.Text>
        ),
    },
    {
      title: '缩略图',
      width: 88,
      render: (_, group) => {
        const asset = group.published ?? group.latestDraft
        return asset ? (
          <Image
            src={asset.url}
            alt={`${group.key} 缩略图`}
            width={56}
            height={56}
            preview={false}
            style={{ objectFit: 'cover', borderRadius: 4 }}
          />
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        )
      },
    },
    {
      title: '尺寸',
      width: 110,
      render: (_, group) => {
        const asset = group.published ?? group.latestDraft
        return asset ? formatDims(asset.width, asset.height) : '—'
      },
    },
    {
      title: '大小',
      width: 100,
      render: (_, group) => {
        const asset = group.published ?? group.latestDraft
        return asset ? formatBytes(asset.bytes) : '—'
      },
    },
    {
      title: '状态',
      width: 180,
      render: (_, group) => (
        <Space size={4}>
          {group.published ? (
            <Tag color="green">已发布 v{group.published.version}</Tag>
          ) : (
            <Tag color="default">未发布</Tag>
          )}
          {group.latestDraft && (
            <Tag color="gold">草稿 v{group.latestDraft.version}</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '更新时间',
      width: 160,
      render: (_, group) =>
        formatTime(
          group.published?.updatedAt ?? group.latestDraft?.updatedAt ?? null,
        ),
    },
    {
      title: '操作人',
      width: 120,
      render: (_, group) =>
        group.published?.createdBy ?? group.latestDraft?.createdBy ?? '—',
    },
    {
      title: '操作',
      width: 80,
      render: (_, group) => (
        <AssetRow
          group={group}
          onOpenUpload={() => openUpload(group.key)}
          onOpenHistory={() => setHistoryGroup(group)}
          onPreview={setPreviewAsset}
        />
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Elly 素材"
        description="上传自有图片并绑定到固定展示位，发布后小程序通过公开 manifest 读取。仅超级管理员可操作。"
        actions={
          <Button
            type="primary"
            disabled={registryEmpty || keysQuery.isLoading}
            onClick={() => openUpload()}
          >
            新建版本
          </Button>
        }
      />

      {keysQuery.isError && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="展示位注册表加载失败"
          description={
            keysQuery.error instanceof Error
              ? keysQuery.error.message
              : '未知错误'
          }
        />
      )}

      {!keysQuery.isLoading && registryEmpty && (
        <Empty
          style={{ margin: '48px 0' }}
          description={
            <Typography.Text type="secondary">
              展示位注册表为空，无法管理素材。请先在服务端注册展示位 key。
            </Typography.Text>
          }
        />
      )}

      {!keysQuery.isLoading && !registryEmpty && onlyDiagnostic && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="当前只有内置诊断展示位"
          description="注册表里只有「远程素材探针」这一个诊断位，还没有业务展示位。可在后端注册新展示位后，在这里上传并发布素材。"
        />
      )}

      {!keysQuery.isLoading && !registryEmpty && (
        <>
          {assetsQuery.isError && (
            <Alert
              type="error"
              showIcon
              style={{ marginBottom: 16 }}
              message="素材列表加载失败"
              description={
                assetsQuery.error instanceof Error
                  ? assetsQuery.error.message
                  : '未知错误'
              }
            />
          )}
          <Table<AppAssetGroup>
            rowKey="key"
            size="middle"
            locale={{ emptyText: '暂无素材' }}
            columns={columns}
            dataSource={groups}
            loading={assetsQuery.isLoading}
            pagination={false}
            // 9 列固定宽合计约 1.5k：容器更窄时横向滚动，而不是把列压向 min-content。
            // 用 max-content 而不是写死像素，后续增删列不用同步改数字。
            scroll={{ x: 'max-content' }}
          />
        </>
      )}

      <AssetUploadDrawer
        open={uploadOpen}
        keys={keys}
        presetKey={uploadPresetKey}
        onClose={() => setUploadOpen(false)}
      />

      <VersionHistoryDrawer
        group={historyGroup}
        onClose={() => setHistoryGroup(null)}
      />

      <Modal
        open={previewAsset !== null}
        footer={null}
        onCancel={() => setPreviewAsset(null)}
        mask={{ closable: true }}
        title={
          previewAsset
            ? `预览 v${previewAsset.version}`
            : undefined
        }
      >
        {previewAsset && (
          <Image
            src={previewAsset.url}
            alt={`${previewAsset.key} v${previewAsset.version}`}
            style={{ width: '100%' }}
            preview={false}
          />
        )}
      </Modal>
    </div>
  )
}
