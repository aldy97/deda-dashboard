import { useEffect } from 'react'
import { Button, Form, InputNumber, message } from 'antd'
import PageHeader from '../../components/PageHeader'
import { useSaveVoiceSpeed, useVoiceSpeed } from '../../api/voiceSpeed'
import type { VoiceSpeedConfig } from '../../api/voiceSpeed'

const SPD_MIN = 0.5
const SPD_MAX = 2
const SPD_STEP = 0.05

export default function VoiceSpeed() {
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
    <>
      <PageHeader
        title="语速设置"
        description="全局语速两个倍数：非哄睡与哄睡。改完下一轮对话即生效，无需重启。"
      />
      <Form
        form={form}
        layout="inline"
        disabled={isPending}
        onFinish={onFinish}
      >
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
    </>
  )
}
