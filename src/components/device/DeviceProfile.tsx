import type { ReactNode } from 'react'
import { Card, Descriptions, Empty, Table, Tag, Typography } from 'antd'
import dayjs from 'dayjs'
import CopyableText from '../CopyableText'
import InfoTip from '../InfoTip'
import type { BoundUser, FleetDeviceDetailResponse } from '../../types/analytics'
import DailyTurnsChart from './DailyTurnsChart'
import PresenceCalendar from './PresenceCalendar'

interface Props {
  data: FleetDeviceDetailResponse
  /** 与 presence / dailyTurns 的回看天数一致，只用于卡片标题 */
  days: number
  /** 跨页出口链接，渲染在最上方一张卡里；不传则整张卡不渲染 */
  exitLinks?: ReactNode
}

/**
 * 设备 360 主体：静态信息 + realtime + 绑定用户 + 近 N 天汇总 + 开机日历 + 对话趋势。
 *
 * 设备舰队页的详情抽屉与用户详情页共用这一份。两处曾经各写一遍，后端加一个 realtime
 * 字段就只会出现在其中一侧；字段契约的唯一真相应该只有一份。
 * days 控件属于各自的容器（抽屉 extra / 页面标题行），不进这里。
 *
 * boundUsers 只展示 userId / isOwner / boundAt，禁止展示任何 PII。
 */
export default function DeviceProfile({ data, days, exitLinks }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {exitLinks && <Card size="small">{exitLinks}</Card>}

      {/* 静态信息 */}
      <Card size="small" title="设备信息">
        <Descriptions column={2} size="small" colon={false}>
          <Descriptions.Item label="设备 ID">{data.deviceId}</Descriptions.Item>
          <Descriptions.Item label="UUID">
            <CopyableText text={data.deviceUuid} ellipsis style={{ maxWidth: 200 }}>
              {data.deviceUuid}
            </CopyableText>
          </Descriptions.Item>
          <Descriptions.Item label="角色">
            {data.characterKey}
          </Descriptions.Item>
          <Descriptions.Item label="设备编码">
            {data.deviceCode ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="固件版本">
            {data.firmwareVersion ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="MAC">
            {data.macAddress ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="WiFi">
            {data.wifiName ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="IP">
            {data.ipAddress ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="网络类型">
            {data.networkType ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="时区">
            {data.timezone ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="入库时间">
            {dayjs(data.createdAt).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* realtime */}
      <Card
        size="small"
        title={
          <>
            实时状态
            <InfoTip title="15 秒窗口；无 Redis 记录时整组显示 -。" />
          </>
        }
      >
        {data.realtime ? (
          <Descriptions column={3} size="small" colon={false}>
            <Descriptions.Item label="在线">
              <Tag color={data.realtime.online ? 'green' : 'default'}>
                {data.realtime.online ? '在线' : '离线'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="电量">
              {data.realtime.battery !== null ? (
                <Typography.Text
                  type={data.realtime.battery <= 20 ? 'danger' : undefined}
                >
                  {data.realtime.battery}%
                </Typography.Text>
              ) : (
                '-'
              )}
            </Descriptions.Item>
            <Descriptions.Item label="音量">
              {data.realtime.volume !== null ? `${data.realtime.volume}%` : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="固件">
              {data.realtime.version ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label="充电">
              {data.realtime.charging !== null
                ? data.realtime.charging
                  ? '是'
                  : '否'
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="最后心跳">
              {data.realtime.lastSeenAt !== null
                ? dayjs(data.realtime.lastSeenAt).format('YYYY-MM-DD HH:mm:ss')
                : '-'}
            </Descriptions.Item>
          </Descriptions>
        ) : (
          <Typography.Text type="secondary">无 Redis 记录</Typography.Text>
        )}
      </Card>

      {/* boundUsers */}
      <Card
        size="small"
        title={
          <>
            绑定用户
            <InfoTip title="只展示 userId + isOwner + boundAt，不暴露昵称、openid、手机号等任何 PII。" />
          </>
        }
      >
        {data.boundUsers.length > 0 ? (
          <BoundUsersTable users={data.boundUsers} />
        ) : (
          <Empty
            description="暂无绑定用户"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
      </Card>

      {/* totals */}
      <Card size="small" title="近 N 天汇总">
        <Descriptions column={2} size="small" colon={false}>
          <Descriptions.Item label="开机天数">
            {data.totals.presenceDays}
          </Descriptions.Item>
          <Descriptions.Item label="对话轮次">
            {data.totals.turns}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* presence calendar */}
      <Card
        size="small"
        title={
          <>
            近 {days} 天开机日历
            <InfoTip title="蓝色 = 当日有 presence 行（开机），白色 = 当日无数据（未开机或尚未落库）。后端不补无数据的日期，前端按区间补齐。" />
          </>
        }
      >
        <PresenceCalendar presence={data.presence} days={days} />
      </Card>

      {/* dailyTurns chart */}
      <Card size="small" title={`近 ${days} 天对话趋势`}>
        <DailyTurnsChart dailyTurns={data.dailyTurns} />
      </Card>
    </div>
  )
}

function BoundUsersTable({ users }: { users: BoundUser[] }) {
  const columns = [
    {
      title: '用户 ID',
      dataIndex: 'userId',
      key: 'userId',
      ellipsis: true,
      width: 280,
    },
    {
      title: '角色',
      dataIndex: 'isOwner',
      key: 'isOwner',
      width: 80,
      render: (v: boolean) =>
        v ? <Tag color="blue">主账号</Tag> : <Tag>绑定</Tag>,
    },
    {
      title: '绑定时间',
      dataIndex: 'boundAt',
      key: 'boundAt',
      width: 180,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss'),
    },
  ]

  return (
    <Table
      columns={columns}
      dataSource={users}
      rowKey="userId"
      size="small"
      pagination={false}
    />
  )
}
