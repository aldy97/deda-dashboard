import { Space } from 'antd'
import PageHeader from '../../components/PageHeader'
import SpeedSection from './SpeedSection'
import TimbreSection from './TimbreSection'

export default function Voice() {
  return (
    <>
      <PageHeader
        title="语速与音色"
        description="全局语速两个倍数，以及每个 IP/角色使用的音色。改完下一轮对话即生效，无需重启。"
      />
      <Space direction="vertical" size={24} style={{ width: '100%' }}>
        <SpeedSection />
        <TimbreSection />
      </Space>
    </>
  )
}
