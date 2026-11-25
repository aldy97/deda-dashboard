import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Button,
  Drawer,
  Input,
  Progress,
  Select,
  Space,
  Typography,
  Upload,
  message,
} from 'antd'
import type { UploadProps } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { usePublishAppAsset, useUploadAppAsset } from '../../api/appAssets'
import type { AppAsset, AppAssetKey } from '../../types/appAssets'
import { formatBytes, formatDims } from './labels'
import { readImageDimensions, validateAssetFile } from './uploadRules'

interface Props {
  open: boolean
  keys: AppAssetKey[]
  /** 从某一行点「新建版本」进来时预选该 key；全局入口不预选 */
  presetKey?: string | null
  onClose: () => void
}

interface PendingUpload {
  file: File
  dims: { width: number; height: number }
}

/**
 * 新建素材版本抽屉。
 *
 * 上传走 antd Upload 的 customRequest：beforeUpload 只做校验 + 读尺寸，
 * 校验通过后 customRequest 用 apiClient 发 multipart。width / height 在
 * beforeUpload 阶段就用浏览器 Image 读好，跟着 multipart 一起发出去，
 * 而不是让服务端再解一次图。
 *
 * 上传成功得到 draft，可在这里「立即发布」，也可直接关闭；列表缓存由
 * useUploadAppAsset / usePublishAppAsset 自动作废，父组件不需要手动刷新。
 */
export default function AssetUploadDrawer({
  open,
  keys,
  presetKey = null,
  onClose,
}: Props) {
  const [key, setKey] = useState<string | null>(presetKey)
  const [file, setFile] = useState<File | null>(null)
  const [dims, setDims] = useState<PendingUpload['dims'] | null>(null)
  const [note, setNote] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [uploaded, setUploaded] = useState<AppAsset | null>(null)

  const pendingRef = useRef<PendingUpload | null>(null)

  const upload = useUploadAppAsset()
  const publish = usePublishAppAsset(uploaded?.key ?? key)

  // 每次打开抽屉都回到干净状态；key 预选只在打开那一刻生效，关闭后不残留
  useEffect(() => {
    if (open) {
      setKey(presetKey)
      setFile(null)
      setDims(null)
      setNote('')
      setValidationError(null)
      setProgress(0)
      setUploaded(null)
      pendingRef.current = null
      upload.reset()
      publish.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, presetKey])

  const keyOptions = keys.map((item) => ({
    value: item.key,
    label: `${item.label}（${item.key}）`,
  }))

  function submit(
    pending: PendingUpload,
    hooks?: {
      onProgress?: (percent: number) => void
      onSuccess?: (asset: AppAsset) => void
      onError?: (err: Error) => void
    },
  ) {
    if (!key) {
      hooks?.onError?.(new Error('请先选择展示位'))
      return
    }
    setProgress(0)
    setUploaded(null)
    upload.mutate(
      {
        key,
        file: pending.file,
        width: pending.dims.width,
        height: pending.dims.height,
        note,
        onProgress: (percent) => {
          setProgress(percent)
          hooks?.onProgress?.(percent)
        },
      },
      {
        onSuccess: (asset) => {
          setUploaded(asset)
          hooks?.onSuccess?.(asset)
        },
        onError: (err) => hooks?.onError?.(err),
      },
    )
  }

  const beforeUpload = (nextFile: File): Promise<boolean> => {
    const invalid = validateAssetFile(nextFile)
    if (invalid) {
      setValidationError(invalid)
      return Promise.resolve(false)
    }
    return readImageDimensions(nextFile)
      .then((nextDims) => {
        pendingRef.current = { file: nextFile, dims: nextDims }
        setFile(nextFile)
        setDims(nextDims)
        setValidationError(null)
        return true
      })
      .catch((err: unknown) => {
        setValidationError(err instanceof Error ? err.message : String(err))
        return false
      })
  }

  const customRequest: UploadProps['customRequest'] = (options) => {
    const pending = pendingRef.current
    if (!pending || pending.file !== options.file) {
      options.onError?.(new Error('请先选择图片'))
      return
    }
    submit(pending, {
      onProgress: (percent) => options.onProgress?.({ percent }),
      onSuccess: (asset) => options.onSuccess?.(asset),
      onError: (err) => options.onError?.(err),
    })
  }

  const retry = () => {
    const pending = pendingRef.current
    if (!pending) return
    submit(pending)
  }

  const publishDraft = () => {
    if (!uploaded) return
    publish.mutate(uploaded.id, {
      onSuccess: () => {
        message.success('已发布')
        onClose()
      },
    })
  }

  const selectedKeyLabel = keys.find((item) => item.key === key)?.label

  return (
    <Drawer
      title="新建素材版本"
      open={open}
      onClose={onClose}
      width={480}
      destroyOnHidden
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        {keys.length === 0 ? (
          <Alert
            type="warning"
            showIcon
            message="展示位注册表为空"
            description="服务端还没有任何展示位，无法新建素材。请先在后端注册展示位 key。"
          />
        ) : (
          <>
            <div>
              <Typography.Text strong>展示位</Typography.Text>
              <Select
                style={{ width: '100%', marginTop: 8 }}
                placeholder="选择展示位 key"
                value={key}
                onChange={setKey}
                options={keyOptions}
              />
            </div>

            <div>
              <Typography.Text strong>图片</Typography.Text>
              <div style={{ marginTop: 8 }}>
                <Upload
                  accept=".png,.jpg,.jpeg,.webp"
                  showUploadList={false}
                  disabled={!key}
                  beforeUpload={beforeUpload}
                  customRequest={customRequest}
                >
                  <Button icon={<UploadOutlined />} disabled={!key}>
                    选择图片并上传
                  </Button>
                </Upload>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  支持 png / jpg / jpeg / webp，≤ 2MB
                </Typography.Text>
              </div>
            </div>

            {file && dims && (
              <div>
                <Typography.Text strong>已选图片</Typography.Text>
                <div style={{ marginTop: 8 }}>
                  <Typography.Text code>{file.name}</Typography.Text>
                  <Typography.Text type="secondary">
                    {' '}
                    · {formatDims(dims.width, dims.height)} ·{' '}
                    {formatBytes(file.size)}
                  </Typography.Text>
                </div>
              </div>
            )}

            {validationError && (
              <Alert type="error" showIcon message={validationError} />
            )}

            {upload.isPending && (
              <div>
                <Typography.Text>上传中…</Typography.Text>
                <Progress percent={progress} />
              </div>
            )}

            {upload.isError && !uploaded && (
              <Alert
                type="error"
                showIcon
                message="上传失败"
                description={
                  upload.error instanceof Error
                    ? upload.error.message
                    : '未知错误'
                }
                action={
                  <Button size="small" onClick={retry}>
                    重试
                  </Button>
                }
              />
            )}

            {uploaded && (
              <Alert
                type="success"
                showIcon
                message="草稿已保存"
                description={
                  selectedKeyLabel
                    ? `已为「${selectedKeyLabel}」保存草稿 v${uploaded.version}`
                    : `草稿 v${uploaded.version} 已保存`
                }
              />
            )}

            <div>
              <Typography.Text strong>备注（可选）</Typography.Text>
              <Input.TextArea
                style={{ marginTop: 8 }}
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="例如：新一版探针占位图"
                disabled={upload.isPending}
              />
            </div>

            {uploaded && (
              <Space>
                <Button
                  type="primary"
                  onClick={publishDraft}
                  loading={publish.isPending}
                >
                  立即发布
                </Button>
                <Button onClick={onClose}>完成</Button>
              </Space>
            )}

            {publish.isError && (
              <Alert
                type="error"
                showIcon
                message="发布失败"
                description={
                  publish.error instanceof Error
                    ? publish.error.message
                    : '未知错误'
                }
              />
            )}
          </>
        )}
      </Space>
    </Drawer>
  )
}
