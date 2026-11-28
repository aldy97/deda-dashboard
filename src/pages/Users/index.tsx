import { useState } from 'react'
import { Input, Tabs } from 'antd'
import { useNavigate } from 'react-router-dom'
import AnalyticsRangePicker from '../../components/AnalyticsRangePicker'
import PageHeader from '../../components/PageHeader'
import RefreshButton from '../../components/RefreshButton'
import { usePageRefresh } from '../../api/refresh'
import { defaultRange } from '../../utils/date-range'
import type { DayRange } from '../../utils/date-range'
import DeviceTab from './DeviceTab'
import ParentTab from './ParentTab'

/** 家长 ID 是数据库 UUID；业务设备 ID 不是 UUID。搜索框按此分流两个详情页。 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type TabKey = 'parents' | 'devices'

/**
 * 用户画像页（P5）：家长画像与孩子/设备画像分两个 tab，口径不同不混算。
 * - 家长画像：统计单位是家长账号（users）。
 * - 孩子 / 设备画像：统计单位是设备与孩子档案。
 * 区间控件只影响「区间新增家长」，放在家长 tab 内。
 */
export default function Users() {
  const navigate = useNavigate()
  const [range, setRange] = useState<DayRange>(defaultRange(30))
  const [activeKey, setActiveKey] = useState<TabKey>('parents')
  const { refresh, isRefreshing } = usePageRefresh('users')

  return (
    <div>
      <PageHeader
        title="用户画像"
        description="聚合数据，不出 PII。家长画像按账号统计；孩子/设备画像按设备与孩子档案统计，两者口径不同。"
        actions={
          <>
            <AnalyticsRangePicker
              value={range}
              onChange={(next) => {
                if (next) setRange(next)
              }}
            />
            <RefreshButton loading={isRefreshing} onClick={refresh} />
          </>
        }
      />

      {/* 两个锚点共用一条搜索框：UUID = 家长档案，业务设备 ID = 设备档案 */}
      <Input.Search
        allowClear
        placeholder="输入设备 ID 或家长 ID 查看详情"
        style={{ maxWidth: 420, marginBottom: 16 }}
        onSearch={(v) => {
          const id = v.trim()
          if (!id) return
          if (UUID_RE.test(id)) {
            navigate(`/parents/${encodeURIComponent(id)}`)
          } else {
            navigate(`/users/${encodeURIComponent(id)}`)
          }
        }}
      />

      <Tabs
        activeKey={activeKey}
        onChange={(key) => setActiveKey(key as TabKey)}
        items={[
          {
            key: 'parents',
            label: '家长画像',
            children:
              activeKey === 'parents' ? (
                <ParentTab range={range} />
              ) : null,
          },
          {
            key: 'devices',
            label: '孩子 / 设备画像',
            children: activeKey === 'devices' ? <DeviceTab /> : null,
          },
        ]}
      />
    </div>
  )
}
