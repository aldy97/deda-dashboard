import { useState } from 'react'
import { Alert, Drawer, InputNumber, Space, Spin, Typography } from 'antd'
import { Link } from 'react-router-dom'
import { useFleetDeviceDetail } from '../../api/queries'
import DeviceProfile from '../../components/device/DeviceProfile'
import ChildProfileSection from './ChildProfileSection'
import { drawerWidth } from '../../utils/drawer-width'

interface Props {
  deviceId: string | null
  onClose: () => void
}

/**
 * 单设备明细抽屉：设备 360 的快速预览，正文与设备档案页共用 DeviceProfile。
 * days 控件（1–90，缺省 30）挂在抽屉 extra。设备不存在（404）时显示错误态。
 * 抽屉只是预览，完整档案（日报、记忆、反馈、消息）在设备档案页，出口链接置顶。
 */
export default function DeviceDetailDrawer({ deviceId, onClose }: Props) {
  const [days, setDays] = useState(30)
  const query = useFleetDeviceDetail(deviceId, days)
  const data = query.data ?? null
  const error = query.error
  const is404 =
    error instanceof Error &&
    (error as Error & { status?: number }).status === 404

  const open = deviceId !== null

  const handleDaysChange = (v: number | null) => {
    if (v !== null && v >= 1 && v <= 90) {
      setDays(v)
    }
  }

  return (
    <Drawer
      title={
        deviceId ? (
          <span>
            设备详情{' '}
            <Typography.Text code style={{ fontSize: 13 }}>
              {deviceId}
            </Typography.Text>
          </span>
        ) : undefined
      }
      open={open}
      onClose={onClose}
      width={drawerWidth(640)}
      destroyOnHidden
      extra={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#666' }}>回看天数：</span>
          <InputNumber
            min={1}
            max={90}
            value={days}
            onChange={handleDaysChange}
            style={{ width: 80 }}
          />
        </span>
      }
    >
      {is404 ? (
        <Alert
          type="error"
          showIcon
          message="设备不存在"
          description={`设备 ${deviceId} 在后端未找到（404），请确认设备 ID 是否正确。`}
        />
      ) : error ? (
        <Alert
          type="error"
          showIcon
          message="加载失败"
          description={error instanceof Error ? error.message : '未知错误'}
        />
      ) : (
        <Spin spinning={query.isLoading}>
          {data && (
            <>
              <ChildProfileSection deviceId={data.deviceId} />
              <DeviceProfile
                data={data}
                days={days}
                exitLinks={
                  <Space direction="vertical" size={4}>
                    <Typography.Text type="secondary">
                      这里是快速预览，完整设备 360 在设备档案页
                    </Typography.Text>
                    <Space wrap>
                      <Link to={`/users/${data.deviceId}`}>设备档案 →</Link>
                      <Link to={`/memories/${data.deviceId}`}>
                        记忆档案 →
                      </Link>
                      <Link
                        to={`/messages?deviceId=${encodeURIComponent(data.deviceId)}`}
                      >
                        消息明细 →
                      </Link>
                    </Space>
                  </Space>
                }
              />
            </>
          )}
        </Spin>
      )}
    </Drawer>
  )
}
