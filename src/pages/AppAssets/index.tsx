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
  useUpdateAppAssetKey,
} from '../../api/appAssets'
import type { AppAsset, AppAssetGroup, AppAssetKey } from '../../types/appAssets'
import { formatBytes, formatDims, formatTime } from './labels'
import { copyText } from '../../utils/clipboard'
import AssetUploadDrawer from './AssetUploadDrawer'
import VersionHistoryDrawer from './VersionHistoryDrawer'
import SlotFormModal from './SlotFormModal'

/** 诊断展示位是服务端内置兜底，不算「有业务素材可管理」 */
const DIAGNOSTIC_KEY = 'diagnostics/remote-probe'

type RowAction =
  | 'upload'
  | 'publish'
  | 'archive'
  | 'history'
  | 'preview'
  | 'copy'
  | 'edit-slot'
  | 'disable-slot'
  | 'enable-slot'
  | 'copy-key'

/**
 * 单行动作收成一个「操作」下拉菜单，按当前状态裁剪：
 * - 停用 / 孤儿展示位不提供上传与发布；
 * - 有 published 时「停用展示位」禁用，必须先下架；
 * - 孤儿 key 只保留版本历史与预览。
 */
function AssetRow({
  group,
  onOpenUpload,
  onOpenHistory,
  onPreview,
  onEditSlot,
}: {
  group: AppAssetGroup
  onOpenUpload: () => void
  onOpenHistory: () => void
  onPreview: (asset: AppAsset) => void
  onEditSlot: () => void
}) {
  const publish = usePublishAppAsset(group.key)
  const archive = useArchiveAppAsset(group.key)
  const update = useUpdateAppAssetKey()
  const [confirming, setConfirming] = useState<
    'publish' | 'archive' | 'disable' | null
  >(null)
  const [copying, setCopying] = useState(false)
  const [copied, setCopied] = useState(false)
  const previewAsset = group.published ?? group.latestDraft
  const isOrphan = group.orphan === true
  const isEnabled = group.enabled !== false
  const canManageSlot = !isOrphan

  const items: MenuProps['items'] = [
    ...(isEnabled && !isOrphan
      ? [{ key: 'upload', label: '上传到此展示位' }]
      : []),
    ...(isEnabled && !isOrphan && group.latestDraft
      ? [{ key: 'publish', label: '发布' }]
      : []),
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
    ...(canManageSlot ? [{ key: 'edit-slot', label: '编辑展示位' }] : []),
    ...(canManageSlot
      ? isEnabled
        ? [
            {
              key: 'disable-slot',
              label: '停用展示位',
              danger: true,
              disabled: Boolean(group.published),
            },
          ]
        : [{ key: 'enable-slot', label: '启用展示位' }]
      : []),
    ...(canManageSlot ? [{ key: 'copy-key', label: '复制 key' }] : []),
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
      case 'disable-slot':
        setConfirming('disable')
        return
      case 'enable-slot':
        update.mutate(
          { key: group.key, enabled: true },
          { onSuccess: () => message.success('已启用展示位') },
        )
        return
      case 'edit-slot':
        onEditSlot()
        return
      case 'copy-key': {
        const ok = await copyText(group.key)
        if (ok) message.success('已复制 key')
        else message.error('复制失败，请手动复制')
        return
      }
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
      : confirming === 'archive'
        ? {
            title: '下架当前发布版本？',
            description: '下架后该展示位将没有已发布素材。',
          }
        : {
            title: '停用这个展示位？',
            description:
              '停用后小程序将不再下发该位置的素材，回退包内图；需要重新启用后才能上传/发布。',
          }
  const confirmingMutation =
    confirming === 'publish'
      ? publish
      : confirming === 'archive'
        ? archive
        : update

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
    } else if (confirming === 'disable') {
      update.mutate(
        { key: group.key, enabled: false },
        {
          onSuccess: () => {
            setConfirming(null)
            message.success('已停用展示位')
          },
        },
      )
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
 * 图片素材管理（仅 superadmin，路由层 OpsGate 已挡住普通 admin）。
 *
 * 列表按展示位 key 分组；新建/编辑/停用展示位与上传版本都在本页完成。
 * 一个展示位同一时刻只有一条线上素材；上传先存草稿，发布才替换线上。
 */
export default function AppAssets() {
  const keysQuery = useAppAssetKeys()
  const assetsQuery = useAppAssets()

  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadPresetKey, setUploadPresetKey] = useState<string | null>(null)
  const [historyGroup, setHistoryGroup] = useState<AppAssetGroup | null>(null)
  const [previewAsset, setPreviewAsset] = useState<AppAsset | null>(null)
  const [slotModal, setSlotModal] = useState<
    { mode: 'create' } | { mode: 'edit'; slot: AppAssetKey } | null
  >(null)

  const keys = keysQuery.data ?? []
  const groups = assetsQuery.data ?? []
  const enabledKeys = keys.filter((item) => item.enabled !== false)
  const keysByKey = new Map(keys.map((item) => [item.key, item]))

  const registryEmpty = keys.length === 0
  const noEnabled = keys.length > 0 && enabledKeys.length === 0
  const onlyDiagnostic =
    enabledKeys.length === 1 && enabledKeys[0].key === DIAGNOSTIC_KEY

  const openUpload = (presetKey?: string) => {
    setUploadPresetKey(presetKey ?? null)
    setUploadOpen(true)
  }

  const openEditSlot = (key: string) => {
    const slot = keysByKey.get(key)
    if (slot) setSlotModal({ mode: 'edit', slot })
  }

  const columns: ColumnsType<AppAssetGroup> = [
    {
      title: '展示位',
      dataIndex: 'key',
      width: 240,
      render: (_, group) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{group.label}</Typography.Text>
          <Typography.Text code style={{ fontSize: 12 }}>
            {group.key}
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
        <Space size={4} wrap>
          {group.orphan ? (
            <Tag color="default">未注册</Tag>
          ) : (
            !group.enabled && <Tag color="default">已停用</Tag>
          )}
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
          onEditSlot={() => openEditSlot(group.key)}
        />
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="图片素材"
        description="每个展示位对应小程序里的一个固定图片位置；上传先存草稿，发布才替换线上素材。仅超级管理员可操作。"
        actions={
          <Space>
            <Button
              disabled={keysQuery.isLoading}
              onClick={() => setSlotModal({ mode: 'create' })}
            >
              新建展示位
            </Button>
            <Button
              type="primary"
              disabled={enabledKeys.length === 0 || keysQuery.isLoading}
              onClick={() => openUpload()}
            >
              上传新版本
            </Button>
          </Space>
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

      {!keysQuery.isLoading && registryEmpty && groups.length === 0 && (
        <Empty
          style={{ margin: '48px 0' }}
          description={
            <Typography.Text type="secondary">
              展示位注册表为空，无法管理素材。请先新建展示位。
            </Typography.Text>
          }
        />
      )}

      {!keysQuery.isLoading && noEnabled && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="所有展示位已停用"
          description="启用至少一个展示位后才能上传素材。"
        />
      )}

      {!keysQuery.isLoading && !registryEmpty && !noEnabled && onlyDiagnostic && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="当前只有内置诊断展示位"
          description="注册表里只有「远程素材探针」这一个诊断位。可在本页「新建展示位」创建业务展示位后再上传素材。"
        />
      )}

      {!keysQuery.isLoading && (keys.length > 0 || groups.length > 0) && (
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
            scroll={{ x: 'max-content' }}
          />
        </>
      )}

      <AssetUploadDrawer
        open={uploadOpen}
        keys={enabledKeys}
        presetKey={uploadPresetKey}
        onClose={() => setUploadOpen(false)}
      />

      <VersionHistoryDrawer
        group={historyGroup}
        onClose={() => setHistoryGroup(null)}
      />

      <SlotFormModal
        open={slotModal !== null}
        mode={slotModal?.mode ?? 'create'}
        slot={slotModal && slotModal.mode === 'edit' ? slotModal.slot : null}
        onClose={() => setSlotModal(null)}
      />

      <Modal
        open={previewAsset !== null}
        footer={null}
        onCancel={() => setPreviewAsset(null)}
        mask={{ closable: true }}
        title={previewAsset ? `预览 v${previewAsset.version}` : undefined}
      >
        {previewAsset && (
          <div data-testid="asset-preview" style={{ textAlign: 'center' }}>
            <Image
              src={previewAsset.url}
              alt={`${previewAsset.key} v${previewAsset.version}`}
              preview={false}
              styles={{ image: { maxWidth: '100%' } }}
            />
          </div>
        )}
      </Modal>
    </div>
  )
}
