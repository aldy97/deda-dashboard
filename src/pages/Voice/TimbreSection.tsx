import { useState } from 'react'
import { Alert, Button, Card, Form, Input, Modal, Popconfirm, Space, Tag, message } from 'antd'
import ResponsiveTable from '../../components/ResponsiveTable'
import type { ColumnsType } from 'antd/es/table'
import {
  useCreateVoiceTimbre,
  useDeleteVoiceTimbre,
  useUpdateVoiceTimbre,
  useVoiceTimbres,
} from '../../api/voiceTimbre'
import type { VoiceTimbreItem } from '../../api/voiceTimbre'

type EditorState =
  | { mode: 'create' }
  | { mode: 'edit'; row: VoiceTimbreItem }
  | null

interface FormValues {
  characterKey: string
  timbreId: string
}

const TIMBRE_ID_RULE = {
  pattern: /^\d{1,19}$/,
  message: 'timbreId 必须是 1–19 位数字',
}

/**
 * 音色管理区块。
 *
 * 「人设」列必须显式暴露 personaConfigured：只配音色不配人设时，对话会用
 * Elly 的人设说话，界面上如果不说，运营会以为新角色已经完整上线。
 */
export default function TimbreSection() {
  const { data, isPending, isError, error } = useVoiceTimbres()
  const create = useCreateVoiceTimbre()
  const update = useUpdateVoiceTimbre()
  const remove = useDeleteVoiceTimbre()

  const [editor, setEditor] = useState<EditorState>(null)
  const [pendingDelete, setPendingDelete] = useState<VoiceTimbreItem | null>(
    null,
  )
  const [form] = Form.useForm<FormValues>()

  const rows = data ?? []
  const saving = create.isPending || update.isPending

  const openCreate = () => {
    form.resetFields()
    setEditor({ mode: 'create' })
  }

  const openEdit = (row: VoiceTimbreItem) => {
    form.setFieldsValue({ characterKey: row.characterKey, timbreId: row.timbreId })
    setEditor({ mode: 'edit', row })
  }

  const submit = async () => {
    const values = await form.validateFields()
    if (!editor) return
    if (editor.mode === 'create') {
      await create.mutateAsync({
        characterKey: values.characterKey.trim().toLowerCase(),
        timbreId: values.timbreId.trim(),
      })
      message.success('角色已新增，下一轮对话生效')
    } else {
      await update.mutateAsync({
        characterKey: editor.row.characterKey,
        timbreId: values.timbreId.trim(),
      })
      message.success('音色已更新，下一轮对话生效')
    }
    setEditor(null)
  }

  const confirmDelete = async (row: VoiceTimbreItem, force: boolean) => {
    try {
      await remove.mutateAsync({ characterKey: row.characterKey, force })
      message.success('角色已删除')
      setPendingDelete(null)
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败')
    }
  }

  const columns: ColumnsType<VoiceTimbreItem> = [
    {
      title: '角色',
      dataIndex: 'characterKey',
      render: (key: string) => <Tag>{key}</Tag>,
    },
    { title: '音色 ID', dataIndex: 'timbreId' },
    {
      title: '人设',
      dataIndex: 'personaConfigured',
      render: (configured: boolean) =>
        configured ? (
          <Tag color="green">已配置</Tag>
        ) : (
          <Tag color="red">未配置，对话将回落 Elly</Tag>
        ),
    },
    {
      title: '在用设备',
      dataIndex: 'devicesInUse',
      render: (count: number) => (count > 0 ? `${count} 台` : '—'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, row) => (
        <Space>
          <Button type="link" size="small" onClick={() => openEdit(row)}>
            编辑
          </Button>
          {row.devicesInUse > 0 ? (
            <Button
              type="link"
              size="small"
              danger
              onClick={() => setPendingDelete(row)}
            >
              删除
            </Button>
          ) : (
            <Popconfirm
              title={`删除角色 ${row.characterKey}？`}
              okText="确认删除"
              cancelText="取消"
              onConfirm={() => confirmDelete(row, false)}
            >
              <Button type="link" size="small" danger>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <Card
      title="音色管理"
      extra={
        <Button type="primary" onClick={openCreate}>
          新增角色
        </Button>
      }
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="改完下一轮对话生效，无需重启。音色只决定用哪个声音；人设、冒险内容与设备归属另有配置。"
      />
      {isError && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message="音色列表加载失败"
          description={error instanceof Error ? error.message : undefined}
        />
      )}
      <ResponsiveTable<VoiceTimbreItem>
        rowKey="characterKey"
        size="small"
        loading={isPending}
        locale={{ emptyText: '暂无角色' }}
        pagination={false}
        columns={columns}
        dataSource={rows}
      />

      <Modal
        title={editor?.mode === 'edit' ? '编辑音色' : '新增角色'}
        open={editor !== null}
        okText="保存"
        cancelText="取消"
        confirmLoading={saving}
        destroyOnHidden
        onOk={submit}
        onCancel={() => setEditor(null)}
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            name="characterKey"
            label="角色标识"
            extra="小写字母开头，2–32 位，可用 a-z 0-9 _ -；保存后不可修改"
            rules={[
              { required: true, message: '请输入角色标识' },
              {
                pattern: /^[a-z][a-z0-9_-]{1,31}$/,
                message: '必须是小写字母开头、2–32 位的 a-z0-9_-',
                transform: (value: string) => value?.trim().toLowerCase(),
              },
            ]}
          >
            <Input
              placeholder="如 nemo"
              disabled={editor?.mode === 'edit'}
            />
          </Form.Item>
          <Form.Item
            name="timbreId"
            label="音色 ID"
            extra="百度 timbreId（数字），来自音色列表"
            rules={[
              { required: true, message: '请输入音色 ID' },
              TIMBRE_ID_RULE,
            ]}
          >
            <Input placeholder="如 1000957" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="删除仍在使用中的角色"
        open={pendingDelete !== null}
        okText="仍然删除"
        okButtonProps={{ danger: true }}
        cancelText="取消"
        confirmLoading={remove.isPending}
        onOk={() => pendingDelete && confirmDelete(pendingDelete, true)}
        onCancel={() => setPendingDelete(null)}
      >
        <Alert
          type="warning"
          showIcon
          message={`角色 ${pendingDelete?.characterKey ?? ''} 仍有 ${
            pendingDelete?.devicesInUse ?? 0
          } 台设备在用`}
          description="删除后这些设备下一轮对话会因查不到音色而失败（fail-closed）。确认这些设备已改配到其他角色再删除。"
        />
      </Modal>
    </Card>
  )
}
