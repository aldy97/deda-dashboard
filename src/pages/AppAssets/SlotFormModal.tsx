import { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Space,
  Typography,
  message,
} from 'antd'
import {
  useCreateAppAssetKey,
  useUpdateAppAssetKey,
} from '../../api/appAssets'
import type { AppAssetKey } from '../../types/appAssets'
import { copyText } from './clipboard'

interface Props {
  open: boolean
  mode: 'create' | 'edit'
  /** 编辑模式必传 */
  slot?: AppAssetKey | null
  onClose: () => void
}

interface SlotFormValues {
  page: string
  suffix: string
  label: string
  note?: string
}

/**
 * 展示位表单：key = page/suffix，创建后不可改。
 *
 * 运营只需要填「页面 code + 位置后缀 + 中文标签」；完整 key 只读展示并
 * 提供复制按钮，给小程序开发登记用。格式与重复以服务端 400/409 文案为准。
 */
export default function SlotFormModal({
  open,
  mode,
  slot = null,
  onClose,
}: Props) {
  const [form] = Form.useForm<SlotFormValues>()
  const create = useCreateAppAssetKey()
  const update = useUpdateAppAssetKey()
  const [error, setError] = useState<string | null>(null)

  const page = Form.useWatch('page', form)
  const suffix = Form.useWatch('suffix', form)
  const previewKey =
    mode === 'edit'
      ? slot?.key ?? ''
      : page?.trim() && suffix?.trim()
        ? `${page.trim()}/${suffix.trim()}`
        : ''

  const pending = mode === 'edit' ? update : create

  useEffect(() => {
    if (!open) return
    if (mode === 'edit' && slot) {
      form.setFieldsValue({ label: slot.label, note: slot.note ?? '' })
      return
    }
    form.resetFields()
  }, [open, mode, slot, form])

  const submit = async () => {
    setError(null)
    let values: SlotFormValues
    try {
      values = await form.validateFields()
    } catch {
      return
    }

    if (mode === 'edit') {
      if (!slot) return
      update.mutate(
        {
          key: slot.key,
          label: values.label.trim(),
          note: values.note?.trim() || null,
        },
        {
          onSuccess: () => {
            message.success('展示位已更新')
            onClose()
          },
          onError: (err) =>
            setError(err instanceof Error ? err.message : '更新失败'),
        },
      )
      return
    }

    create.mutate(
      {
        page: values.page.trim(),
        suffix: values.suffix.trim(),
        label: values.label.trim(),
        note: values.note?.trim() || null,
      },
      {
        onSuccess: (created) => {
          message.success(`已新建展示位 ${created.key}`)
          onClose()
        },
        onError: (err) =>
          setError(err instanceof Error ? err.message : '创建失败'),
      },
    )
  }

  const copyKey = async () => {
    // 复制按钮在 key 为空时已禁用，这里只防协议被绕过
    /* v8 ignore next */
    if (!previewKey) return
    const ok = await copyText(previewKey)
    if (ok) message.success('已复制 key')
    else message.error('复制失败，请手动复制')
  }

  return (
    <Modal
      open={open}
      title={mode === 'edit' ? '编辑展示位' : '新建展示位'}
      okText={mode === 'edit' ? '保存' : '创建'}
      cancelText="取消"
      confirmLoading={pending.isPending}
      onOk={() => void submit()}
      onCancel={() => {
        setError(null)
        onClose()
      }}
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        {mode === 'create' ? (
          <>
            <Form.Item
              name="page"
              label="页面 code"
              rules={[{ required: true, message: '请填写页面 code' }]}
              extra="短 code，例如 device-home / owner-info / sleep-manage"
            >
              <Input placeholder="device-home" />
            </Form.Item>
            <Form.Item
              name="suffix"
              label="展示位后缀"
              rules={[{ required: true, message: '请填写展示位后缀' }]}
              extra="拼在页面 code 后面，例如 section-hero"
            >
              <Input placeholder="section-hero" />
            </Form.Item>
          </>
        ) : (
          <Form.Item label="展示位 key">
            <Input value={slot?.key ?? ''} disabled />
          </Form.Item>
        )}

        <Form.Item label="key 预览">
          <Space>
            <Typography.Text code>{previewKey || '—'}</Typography.Text>
            <Button size="small" onClick={() => void copyKey()} disabled={!previewKey}>
              复制 key
            </Button>
          </Space>
        </Form.Item>

        <Form.Item
          name="label"
          label="中文标签"
          rules={[{ required: true, message: '请填写中文标签' }]}
        >
          <Input placeholder="首页主视觉" />
        </Form.Item>

        <Form.Item name="note" label="备注">
          <Input.TextArea
            rows={3}
            placeholder="用在哪 / 设计稿 / 责任人（可选）"
          />
        </Form.Item>
      </Form>

      {error && <Alert type="error" showIcon message={error} />}
    </Modal>
  )
}
