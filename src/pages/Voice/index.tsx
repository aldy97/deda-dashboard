import { Space } from 'antd'
import PageHeader from '../../components/PageHeader'
import SpeedSection from './SpeedSection'
import TimbreSection from './TimbreSection'

export default function Voice() {
  return (
    <>
      <PageHeader
        title="语速与音色"
        description="全局语速两个倍数，以及每个 IP/角色使用的音色。保存后下一轮对话生效；可立即下发到在线设备。"
      />
      <Space direction="vertical" size={24} style={{ width: '100%' }}>
        <SpeedSection />
        <TimbreSection />
      </Space>
    </>
  )
}
