import { useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Link } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import {
  useAddTestDevice,
  useRevokeTestDevice,
  useTestDevices,
} from '../../api/testDevices'
import type { TestDeviceWhitelistItem } from '../../api/testDevices'

const PAGE_SIZE = 20

function fmtTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString('zh-CN') : '—'
}

/**
 * 测试设备白名单（仅 superadmin）。
 *
 * 这份名单管一件事：设备能不能被下发测试冒险故事，以及能不能用
 * 「测试冒险故事」语音触发词。页面只做增删查，
 * 真正的安全闸在服务端；这里不做任何前端侧的「白名单判断」。
 *
 * 冒险测试开关关闭（prod）时整页只读：不是权限不足，而是这个环境没有测试模式。
 */
export default function TestDevices() {
  const [keyword, setKeyword] = useState('')
  const [includeRevoked, setIncludeRevoked] = useState(false)
  const [page, setPage] = useState(1)
  const [revokeTarget, setRevokeTarget] =
    useState<TestDeviceWhitelistItem | null>(null)

  const [addForm] = Form.useForm()
  const [revokeForm] = Form.useForm()

  const query = useTestDevices({
    keyword: keyword || undefined,
    includeRevoked,
    page,
    pageSize: PAGE_SIZE,
  })
  const add = useAddTestDevice()
  const revoke = useRevokeTestDevice()

  const data = query.data
  const adventureTestOff = data ? !data.enabled.adventure : false

  function submitAdd(values: {
    deviceId: string
    note?: string
    reason: string
  }) {
    add.mutate(
      {
        deviceId: values.deviceId.trim(),
        note: values.note?.trim() || undefined,
        reason: values.reason.trim(),
      },
      {
        onSuccess: (res) => {
          addForm.resetFields()
          message.success(
            res.reactivated
              ? `已恢复 ${res.item.device.deviceId} 的测试资格`
              : `已把 ${res.item.device.deviceId} 加入测试白名单`,
          )
        },
      },
    )
  }

  function openRevoke(row: TestDeviceWhitelistItem) {
    setRevokeTarget(row)
    revokeForm.resetFields()
  }

  async function submitRevoke() {
    if (!revokeTarget) return
    let values: { reason: string }
    try {
      values = await revokeForm.validateFields()
    } catch {
      return
    }
    revoke.mutate(
      {
        deviceId: revokeTarget.device.deviceId,
        reason: values.reason.trim(),
      },
      {
        onSuccess: (res) => {
          setRevokeTarget(null)
          revokeForm.resetFields()
          message.success(
            res.clearedAdventureAssignment
              ? `已撤销 ${revokeTarget.device.deviceId} 的测试资格，并已清空该设备的测试冒险下发`
              : `已撤销 ${revokeTarget.device.deviceId} 的测试资格`,
          )
        },
      },
    )
  }

  const columns: ColumnsType<TestDeviceWhitelistItem> = [
    {
      title: '设备ID',
      key: 'device',
      width: 220,
      render: (_, row) => (
        <Link
          to={`/users/${encodeURIComponent(row.device.deviceId)}`}
          style={{ fontFamily: 'monospace' }}
        >
          {row.device.deviceId}
        </Link>
      ),
    },
    {
      title: '角色',
      key: 'character',
      width: 100,
      render: (_, row) => row.device.characterKey,
    },
    {
      title: '固件',
      key: 'firmware',
      width: 110,
      render: (_, row) => row.device.firmwareVersion ?? '—',
    },
    {
      title: '状态',
      key: 'active',
      width: 90,
      render: (_, row) =>
        row.active ? <Tag color="green">在册</Tag> : <Tag color="red">已撤销</Tag>,
    },
    {
      title: '备注',
      key: 'note',
      width: 160,
      render: (_, row) => row.note ?? '—',
    },
    {
      title: '添加',
      key: 'added',
      width: 240,
      render: (_, row) => (
        <Space orientation="vertical" size={0}>
          <Typography.Text>
            {row.addedBy} · {fmtTime(row.addedAt)}
          </Typography.Text>
          {row.addedReason && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {row.addedReason}
            </Typography.Text>
          )}
        </Space>
      ),
    },
    {
      title: '撤销',
      key: 'revoked',
      width: 240,
      render: (_, row) =>
        row.active ? (
          '—'
        ) : (
          <Space orientation="vertical" size={0}>
            <Typography.Text>
              {row.revokedBy} · {fmtTime(row.revokedAt)}
            </Typography.Text>
            {row.revokeReason && (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {row.revokeReason}
              </Typography.Text>
            )}
          </Space>
        ),
    },
    {
      title: '操作',
      key: 'action',
      width: 90,
      fixed: 'right',
      render: (_, row) =>
        row.active ? (
          <Button size="small" danger onClick={() => openRevoke(row)}>
            撤销
          </Button>
        ) : (
          '—'
        ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="测试设备白名单"
        description="只有名单内在册的设备才能被下发测试冒险故事，才能用「测试冒险故事」语音触发词。添加与撤销都会留操作人与理由；撤销会同时清空该设备的测试冒险下发。"
      />

      {adventureTestOff && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="当前环境未开启冒险测试模式，白名单只读。"
          description="这是生产环境的预期状态：白名单可以查看，但不能添加或撤销。需要测试请使用 staging。"
        />
      )}

      {data && !adventureTestOff && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={`测试开关：冒险测试${data.enabled.adventure ? '已开启' : '未开启'}`}
        />
      )}

      <Card title="添加测试设备" style={{ marginBottom: 16 }}>
        <Form
          form={addForm}
          layout="vertical"
          onFinish={submitAdd}
          disabled={adventureTestOff}
        >
          <Space size={12} wrap align="start">
            <Form.Item
              name="deviceId"
              label="设备"
              rules={[{ required: true, message: '请填写设备 ID' }]}
              style={{ width: 280 }}
            >
              <Input placeholder="设备 ID / 设备编码 / MAC" />
            </Form.Item>
            <Form.Item name="note" label="备注" style={{ width: 220 }}>
              <Input placeholder="备注（可选）" />
            </Form.Item>
            <Form.Item
              name="reason"
              label="理由"
              rules={[
                { required: true, message: '请填写变更理由' },
                { min: 8, message: '理由至少 8 个字' },
              ]}
              style={{ width: 320 }}
            >
              <Input placeholder="变更理由（至少 8 个字）" />
            </Form.Item>
            <Form.Item label=" ">
              <Button
                type="primary"
                htmlType="submit"
                loading={add.isPending}
                disabled={adventureTestOff}
              >
                添加到白名单
              </Button>
            </Form.Item>
          </Space>
        </Form>
        {add.error && (
          <Alert
            type="error"
            showIcon
            style={{ marginTop: 12 }}
            message={add.error.message}
          />
        )}
      </Card>

      <Card
        title="白名单"
        extra={
          <Space size={12} wrap>
            <Input.Search
              allowClear
              placeholder="按设备号 / 编码 / MAC 搜索"
              style={{ width: 260 }}
              onSearch={(value) => {
                setKeyword(value.trim())
                setPage(1)
              }}
            />
            <Space size={6}>
              <Typography.Text type="secondary">显示已撤销</Typography.Text>
              <Switch
                checked={includeRevoked}
                onChange={(checked) => {
                  setIncludeRevoked(checked)
                  setPage(1)
                }}
              />
            </Space>
          </Space>
        }
      >
        {query.error && (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 12 }}
            message="白名单加载失败"
            description={query.error.message}
          />
        )}
        <Table
          columns={columns}
          dataSource={data?.items ?? []}
          rowKey="id"
          size="small"
          loading={query.isLoading}
          scroll={{ x: 1500 }}
          locale={{ emptyText: '白名单里还没有设备' }}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total: data?.total ?? 0,
            showSizeChanger: false,
            onChange: (next) => setPage(next),
          }}
        />
      </Card>

      <Modal
        open={revokeTarget !== null}
        title="撤销测试设备资格"
        okText="确认撤销"
        cancelText="取消"
        okButtonProps={{ danger: true }}
        confirmLoading={revoke.isPending}
        onOk={submitRevoke}
        onCancel={() => {
          setRevokeTarget(null)
          revokeForm.resetFields()
        }}
      >
        <Space orientation="vertical" size={8} style={{ width: '100%' }}>
          <Typography.Text>
            撤销{' '}
            <Typography.Text code>
              {revokeTarget?.device.deviceId}
            </Typography.Text>
            ：设备将不能再被下发测试冒险故事，语音触发词也会失效；该设备当前的测试冒险下发会被清空。
          </Typography.Text>
          <Form form={revokeForm} layout="vertical">
            <Form.Item
              name="reason"
              label="撤销理由"
              rules={[
                { required: true, message: '请填写撤销理由' },
                { min: 8, message: '理由至少 8 个字' },
              ]}
              style={{ marginBottom: 0 }}
            >
              <Input.TextArea
                rows={3}
                placeholder="撤销理由（至少 8 个字）"
              />
            </Form.Item>
          </Form>
          {revoke.error && (
            <Alert type="error" showIcon message={revoke.error.message} />
          )}
        </Space>
      </Modal>
    </div>
  )
}
