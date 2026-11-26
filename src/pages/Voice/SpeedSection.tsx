import { useEffect, useState } from 'react'
import {
  Button,
  Card,
  Col,
  Form,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Space,
  Tooltip,
  Typography,
  message,
} from 'antd'
import {
  useApplyVoiceSpeed,
  useSaveVoiceSpeed,
  useVoiceSpeed,
} from '../../api/voiceSpeed'
import type {
  VoiceSpeedApplyResult,
  VoiceSpeedConfig,
} from '../../api/voiceSpeed'

const SPD_MIN = 0.5
const SPD_MAX = 2
const SPD_STEP = 0.05
const SPD_HINT = '两个语速取值范围均为 0.5–2.0 倍，步进 0.05'

/** 语速区块：卡片内的全局两值 + 立即下发到在线实例 */
export default function SpeedSection() {
  const { data, isPending } = useVoiceSpeed()
  const save = useSaveVoiceSpeed()
  const apply = useApplyVoiceSpeed()
  const [form] = Form.useForm<VoiceSpeedConfig>()
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (data) form.setFieldsValue(data)
  }, [data, form])

  const onValuesChange = (_: unknown, all: Partial<VoiceSpeedConfig>) => {
    setDirty(
      Number(all.normalSpd) !== Number(data?.normalSpd) ||
        Number(all.sleepSpd) !== Number(data?.sleepSpd),
    )
  }

  const onFinish = async (values: VoiceSpeedConfig) => {
    if (!dirty) return
    try {
      await save.mutateAsync(values)
      setDirty(false)
      message.success('已保存；当前这轮不受影响，下一轮起生效')
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存失败')
    }
  }

  const showApplyResult = (result: VoiceSpeedApplyResult) => {
    message.success(
      `已下发：${result.live} 台生效，${result.deferred} 台延后，${result.skipped} 台跳过`,
    )
    if (result.deferred > 0) {
      Modal.info({
        title: '部分设备未立即生效',
        content: (
          <div>
            {result.results
              .filter((item) => item.applied !== 'live')
              .map((item) => (
                <div key={item.deviceId}>
                  {item.deviceId}：{item.reason ?? item.applied}
                </div>
              ))}
          </div>
        ),
      })
    }
  }

  const onApply = async () => {
    try {
      const result = await apply.mutateAsync({})
      showApplyResult(result)
    } catch (err) {
      message.error(err instanceof Error ? err.message : '下发失败')
    }
  }

  const applyBlocked = isPending || dirty || save.isPending || apply.isPending
  const applyBlockedReason = isPending
    ? '正在读取当前配置'
    : dirty
      ? '有未保存的改动，先保存再下发'
      : undefined

  const applyButton = (
    <Popconfirm
      title="立即切换所有在线设备的语速？正在对话的设备会当场变化。"
      okText="确认"
      cancelText="取消"
      okButtonProps={{ loading: apply.isPending }}
      onConfirm={onApply}
      disabled={applyBlocked}
    >
      <Button disabled={applyBlocked} loading={apply.isPending}>
        立即下发到在线设备
      </Button>
    </Popconfirm>
  )

  return (
    <Card
      title="语速设置"
      extra={
        applyBlockedReason ? (
          <Tooltip title={applyBlockedReason}>
            <span>{applyButton}</span>
          </Tooltip>
        ) : (
          applyButton
        )
      }
    >
      <Form
        form={form}
        layout="vertical"
        disabled={isPending}
        onValuesChange={onValuesChange}
        onFinish={onFinish}
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          {SPD_HINT}
        </Typography.Paragraph>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              name="normalSpd"
              label="非哄睡语速"
              rules={[
                { required: true, message: '请输入非哄睡语速' },
                {
                  type: 'number',
                  min: SPD_MIN,
                  max: SPD_MAX,
                  message: '取值范围 0.5–2.0',
                },
              ]}
            >
              <InputNumber
                min={SPD_MIN}
                max={SPD_MAX}
                step={SPD_STEP}
                precision={2}
                suffix="倍"
                style={{ width: 160 }}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="sleepSpd"
              label="哄睡语速"
              rules={[
                { required: true, message: '请输入哄睡语速' },
                {
                  type: 'number',
                  min: SPD_MIN,
                  max: SPD_MAX,
                  message: '取值范围 0.5–2.0',
                },
              ]}
            >
              <InputNumber
                min={SPD_MIN}
                max={SPD_MAX}
                step={SPD_STEP}
                precision={2}
                suffix="倍"
                style={{ width: 160 }}
              />
            </Form.Item>
          </Col>
        </Row>
        <Space wrap>
          <Button
            type="primary"
            htmlType="submit"
            loading={save.isPending}
            disabled={!dirty || isPending || save.isPending}
          >
            保存
          </Button>
          <Typography.Text type="secondary">
            {isPending
              ? '正在读取当前配置…'
              : dirty
                ? '有未保存的改动，保存后下一轮对话生效'
                : '当前与服务端一致'}
          </Typography.Text>
        </Space>
      </Form>
    </Card>
  )
}
