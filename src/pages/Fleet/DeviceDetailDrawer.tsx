import { useState } from 'react'
import {
  Alert,
  Card,
  Descriptions,
  Drawer,
  Empty,
  InputNumber,
  Popover,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd'
import dayjs from 'dayjs'
import ReactECharts from 'echarts-for-react'
import type { Dayjs } from 'dayjs'
import { useFleetDeviceDetail } from '../../api/queries'
import type {
  BoundUser,
  FleetDeviceDetailResponse,
} from '../../types/analytics'
import InfoTip from '../../components/InfoTip'

interface Props {
  deviceId: string | null
  onClose: () => void
}

/**
 * 单设备明细抽屉：静态信息 + realtime + boundUsers + presence 日历 + dailyTurns 折线 + totals。
 * days 控件（1–90，缺省 30）。设备不存在（404）时显示错误态。
 * boundUsers 只展示 userId / isOwner / boundAt，禁止展示任何 PII。
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

  const close = () => {
    onClose()
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
      onClose={close}
      width={640}
      destroyOnClose
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
          {data && <DeviceDetailContent data={data} days={days} />}
        </Spin>
      )}
    </Drawer>
  )
}

/** 抽屉内容：拆分子组件避免 Drawer 本体过长 */
function DeviceDetailContent({
  data,
  days,
}: {
  data: FleetDeviceDetailResponse
  days: number
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 静态信息 */}
      <Card size="small" title="设备信息">
        <Descriptions column={2} size="small" colon={false}>
          <Descriptions.Item label="设备 ID">{data.deviceId}</Descriptions.Item>
          <Descriptions.Item label="UUID">
            <Typography.Text copyable ellipsis style={{ maxWidth: 200 }}>
              {data.deviceUuid}
            </Typography.Text>
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

/** 填补无数据的日期，用浅色块表示未开机 */
function PresenceCalendar({
  presence,
  days,
}: {
  presence: FleetDeviceDetailResponse['presence']
  days: number
}) {
  const endDate = dayjs().startOf('day')
  const startDate = endDate.subtract(days - 1, 'day')

  const presenceMap = new Map<string, boolean>()
  for (const p of presence) {
    presenceMap.set(p.date, true)
  }

  const cells: { date: Dayjs; hasData: boolean }[] = []
  let cursor = startDate
  while (cursor.isBefore(endDate) || cursor.isSame(endDate, 'day')) {
    cells.push({
      date: cursor,
      hasData: presenceMap.has(cursor.format('YYYY-MM-DD')),
    })
    cursor = cursor.add(1, 'day')
  }

  // 按周一对齐切周：先用 null 补齐首行前导与末行尾部，否则最后一周的日期会
  // 落在错误的星期列下（dayjs.day()：0=周日 … 6=周六）
  type Cell = { date: Dayjs; hasData: boolean } | null
  const leading = cells.length > 0 ? (cells[0].date.day() + 6) % 7 : 0
  const padded: Cell[] = [
    ...Array.from({ length: leading }, () => null),
    ...cells,
  ]
  while (padded.length % 7 !== 0) padded.push(null)
  const weeks: Cell[][] = []
  for (let i = 0; i < padded.length; i += 7) {
    weeks.push(padded.slice(i, i + 7))
  }

  const dayNames = ['一', '二', '三', '四', '五', '六', '日']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {dayNames.map((n) => (
          <div
            key={n}
            style={{
              width: 28,
              textAlign: 'center',
              fontSize: 11,
              color: '#999',
            }}
          >
            {n}
          </div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} style={{ display: 'flex', gap: 4 }}>
          {week.map((cell, ci) =>
            cell === null ? (
              <div key={`pad-${ci}`} style={{ width: 28, height: 24 }} />
            ) : (
              <Popover
                key={cell.date.format('YYYY-MM-DD')}
                content={
                  <div style={{ fontSize: 12 }}>
                    <div>{cell.date.format('YYYY-MM-DD')}</div>
                    <div>{cell.hasData ? '已开机' : '无数据'}</div>
                  </div>
                }
              >
                <div
                  style={{
                    width: 28,
                    height: 24,
                    borderRadius: 3,
                    backgroundColor: cell.hasData ? '#1677ff' : '#f5f5f5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    color: cell.hasData ? '#fff' : '#bbb',
                    cursor: 'pointer',
                  }}
                >
                  {cell.date.date()}
                </div>
              </Popover>
            ),
          )}
        </div>
      ))}
    </div>
  )
}

/** dailyTurns 折线，后端已补 0 */
function DailyTurnsChart({
  dailyTurns,
}: {
  dailyTurns: FleetDeviceDetailResponse['dailyTurns']
}) {
  if (dailyTurns.length === 0) {
    return (
      <Empty description="暂无对话数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
    )
  }

  const dates = dailyTurns.map((p) => p.date.slice(5))

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: Array<{ value: number; dataIndex: number }>) => {
        const idx = params[0]?.dataIndex ?? 0
        const point = dailyTurns[idx]
        return `${point.date}<br/>对话轮次：${point.turns} 轮`
      },
    },
    grid: { left: 48, right: 24, top: 16, bottom: 32 },
    xAxis: { type: 'category', data: dates, boundaryGap: false },
    yAxis: { type: 'value', name: '轮', minInterval: 1, min: 0 },
    series: [
      {
        type: 'line',
        smooth: true,
        showSymbol: false,
        itemStyle: { color: '#1677ff' },
        areaStyle: { color: 'rgba(22, 119, 255, 0.08)' },
        data: dailyTurns.map((p) => p.turns),
      },
    ],
  }

  return <ReactECharts option={option} style={{ height: 240 }} notMerge />
}
