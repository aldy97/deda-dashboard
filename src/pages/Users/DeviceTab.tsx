import { Alert, Card, Spin, Typography } from 'antd'
import { useUsersDemographics } from '../../api/queries'
import Demographics from './Demographics'

/**
 * 孩子 / 设备画像 tab：统计单位是设备与孩子档案（一台设备一份孩子档案），
 * 不等于家长账号数，与「家长画像」严格区分。
 */
export default function DeviceTab() {
  const query = useUsersDemographics()
  const data = query.data ?? null
  const error = query.error
    ? query.error instanceof Error
      ? query.error.message
      : '加载失败'
    : null

  return (
    <div>
      <Alert
        type="info"
        showIcon
        message="统计单位：设备与孩子档案"
        description="一个家长可绑定多台设备；一台设备对应一份孩子档案。这里的数量不能当作家长账号数使用。"
        style={{ marginBottom: 16 }}
      />

      {error && (
        <Alert
          type="error"
          showIcon
          message="设备画像加载失败"
          description={error}
          style={{ marginBottom: 16 }}
        />
      )}

      <Card title="孩子 / 设备画像分布">
        <Spin spinning={query.isLoading}>
          {data && <Demographics data={data} />}
        </Spin>
        <Typography.Paragraph
          type="secondary"
          style={{ marginTop: 12, marginBottom: 0 }}
        >
          孩子年龄段与性别来自孩子档案；IP 型号与绑定家庭数按设备统计。
        </Typography.Paragraph>
      </Card>
    </div>
  )
}
