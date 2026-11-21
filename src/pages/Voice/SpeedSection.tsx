import { useEffect } from 'react'
import { Button, Form, InputNumber, message } from 'antd'
import { useSaveVoiceSpeed, useVoiceSpeed } from '../../api/voiceSpeed'
import type { VoiceSpeedConfig } from '../../api/voiceSpeed'

const SPD_MIN = 0.5
const SPD_MAX = 2
const SPD_STEP = 0.05

/** 语速区块：只搬不改，字段名、范围、接口路径与改造前逐字一致 */
export default function SpeedSection() {
  const { data, isPending } = useVoiceSpeed()
  const save = useSaveVoiceSpeed()
  const [form] = Form.useForm<VoiceSpeedConfig>()

  useEffect(() => {
    if (data) form.setFieldsValue(data)
  }, [data, form])

  const onFinish = async (values: VoiceSpeedConfig) => {
    await save.mutateAsync(values)
    message.success('语速已保存，下一轮对话生效')
  }

  return (
    <Form form={form} layout="inline" disabled={isPending} onFinish={onFinish}>
      <Form.Item
        name="normalSpd"
        label="非哄睡语速"
        rules={[{ required: true, message: '请输入非哄睡语速' }]}
      >
        <InputNumber min={SPD_MIN} max={SPD_MAX} step={SPD_STEP} />
      </Form.Item>
      <Form.Item
        name="sleepSpd"
        label="哄睡语速"
        rules={[{ required: true, message: '请输入哄睡语速' }]}
      >
        <InputNumber min={SPD_MIN} max={SPD_MAX} step={SPD_STEP} />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" loading={save.isPending}>
          保存
        </Button>
      </Form.Item>
    </Form>
  )
}
