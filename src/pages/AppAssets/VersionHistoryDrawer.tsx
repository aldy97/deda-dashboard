import { useState } from 'react'
import {
  Alert,
  Button,
  Drawer,
  Image,
  List,
  Modal,
  Popconfirm,
  Space,
  Tag,
  Typography,
  message,
} from 'antd'
import {
  useAppAssetVersions,
  useArchiveAppAsset,
  usePublishAppAsset,
} from '../../api/appAssets'
import type { AppAsset, AppAssetGroup } from '../../types/appAssets'
import {
  assetStatusLabel,
  formatBytes,
  formatDims,
  formatTime,
} from './labels'

interface Props {
  /** null = 抽屉关闭 */
  group: AppAssetGroup | null
  onClose: () => void
}

/**
 * 版本历史抽屉：按 version 降序展示某个展示位的全部版本。
 *
 * 发布历史版本（archived → 再发布）就是「回滚」；草稿可直接发布；已发布版本可下架。
 * 三个动作都包了 Popconfirm 二次确认，避免手滑把线上素材换掉。
 */
export default function VersionHistoryDrawer({ group, onClose }: Props) {
  const key = group?.key ?? null
  const versionsQuery = useAppAssetVersions(key)
  const publish = usePublishAppAsset(key)
  const archive = useArchiveAppAsset(key)
  const [preview, setPreview] = useState<AppAsset | null>(null)

  const versions = versionsQuery.data ?? group?.versions ?? []

  const renderActions = (asset: AppAsset) => {
    if (asset.status === 'published') {
      return (
        <Popconfirm
          title="下架当前发布版本？"
          description="下架后该展示位将没有已发布素材，请确认已在别处兜底。"
          okText="确认"
          cancelText="取消"
          onConfirm={() =>
            archive.mutate(asset.id, {
              onSuccess: () => message.success('已下架'),
            })
          }
        >
          <Button size="small" danger loading={archive.isPending}>
            下架
          </Button>
        </Popconfirm>
      )
    }
    const isRollback = asset.status === 'archived'
    return (
      <Popconfirm
        title={isRollback ? '回滚到此版本？' : '发布此草稿？'}
        okText="确认"
        cancelText="取消"
        onConfirm={() =>
          publish.mutate(asset.id, {
            onSuccess: () =>
              message.success(isRollback ? '已回滚' : '已发布'),
          })
        }
      >
        <Button size="small" type="primary" loading={publish.isPending}>
          {isRollback ? '回滚到此版本' : '发布'}
        </Button>
      </Popconfirm>
    )
  }

  return (
    <Drawer
      title={
        group ? (
          <span>
            版本历史{' '}
            <Typography.Text code style={{ fontSize: 13 }}>
              {group.key}
            </Typography.Text>
          </span>
        ) : (
          '版本历史'
        )
      }
      open={group !== null}
      onClose={onClose}
      width={720}
      destroyOnHidden
    >
      {group && (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {versionsQuery.isError && (
            <Alert
              type="error"
              showIcon
              message="版本历史加载失败"
              description={
                versionsQuery.error instanceof Error
                  ? versionsQuery.error.message
                  : '未知错误'
              }
            />
          )}
          <List
            dataSource={versions}
            loading={versionsQuery.isLoading}
            locale={{ emptyText: '该展示位还没有任何版本' }}
            renderItem={(asset) => {
              const status = assetStatusLabel(asset.status)
              return (
                <List.Item
                  actions={[
                    renderActions(asset),
                    <Button
                      key="preview"
                      size="small"
                      onClick={() => setPreview(asset)}
                    >
                      预览
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={
                      <Image
                        src={asset.url}
                        alt={`${group.key} v${asset.version}`}
                        width={56}
                        height={56}
                        preview={false}
                        style={{ objectFit: 'cover', borderRadius: 4 }}
                      />
                    }
                    title={
                      <Space size={8}>
                        <Typography.Text strong>
                          v{asset.version}
                        </Typography.Text>
                        <Tag color={status.color}>{status.text}</Tag>
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size={0}>
                        <Typography.Text type="secondary">
                          {formatDims(asset.width, asset.height)} ·{' '}
                          {formatBytes(asset.bytes)} · {asset.mimeType}
                        </Typography.Text>
                        {asset.note && (
                          <Typography.Text type="secondary">
                            {asset.note}
                          </Typography.Text>
                        )}
                        <Typography.Text type="secondary">
                          {asset.createdBy} · {formatTime(asset.createdAt)}
                        </Typography.Text>
                      </Space>
                    }
                  />
                </List.Item>
              )
            }}
          />
        </Space>
      )}

      <Modal
        open={preview !== null}
        footer={null}
        onCancel={() => setPreview(null)}
        mask={{ closable: true }}
        title={preview ? `${group?.label ?? ''} v${preview.version}` : undefined}
      >
        {preview && (
          // 与列表页预览同口径：外层容器居中，超宽图用 maxWidth 收进来。
          <div data-testid="version-preview" style={{ textAlign: 'center' }}>
            <Image
              src={preview.url}
              alt={`${preview.key} v${preview.version}`}
              preview={false}
              styles={{ image: { maxWidth: '100%' } }}
            />
          </div>
        )}
      </Modal>
    </Drawer>
  )
}
