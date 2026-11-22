import { useEffect, useState } from 'react'
import { Button, Form, InputNumber, Modal, Popconfirm, message } from 'antd'
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
const SPD_HINT = '取值范围 0.5–2.0 倍，步进 0.05'

/** 语速区块：全局两值 + 立即下发到在线实例 */
export default function SpeedSection() {
  const { data, isPending } = useVoiceSpeed()
  const save = useSaveVoiceSpeed()
  const apply = useApplyVoiceSpeed()
  const [form] = Form.useForm<VoiceSpeedConfig>()
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (data) form.setFieldsValue(data)
  }, [data, form])

  const onFinish = async (values: VoiceSpeedConfig) => {
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

  return (
    <Form
      form={form}
      layout="inline"
      disabled={isPending}
      onValuesChange={() => setDirty(true)}
      onFinish={onFinish}
    >
      <Form.Item
        name="normalSpd"
        label="非哄睡语速"
        extra={SPD_HINT}
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
        />
      </Form.Item>
      <Form.Item
        name="sleepSpd"
        label="哄睡语速"
        extra={SPD_HINT}
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
        />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" loading={save.isPending}>
          保存
        </Button>
      </Form.Item>
      <Form.Item>
        <Popconfirm
          title="立即切换所有在线设备的语速？正在对话的设备会当场变化。"
          okText="确认"
          cancelText="取消"
          okButtonProps={{ loading: apply.isPending }}
          onConfirm={onApply}
          disabled={dirty || save.isPending || apply.isPending}
        >
          <Button
            disabled={dirty || save.isPending || apply.isPending}
            loading={apply.isPending}
          >
            立即下发到在线设备
          </Button>
        </Popconfirm>
      </Form.Item>
    </Form>
  )
}
