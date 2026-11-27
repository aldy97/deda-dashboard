import {
  Alert,
  Card,
  Descriptions,
  Empty,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Link, useParams } from 'react-router-dom'
import dayjs from 'dayjs'
import PageHeader from '../../components/PageHeader'
import { useParentDetail } from '../../api/queries'
import type { ParentDevice } from '../../types/analytics'

const fmtTime = (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm')

const GENDER_LABEL: Record<'male' | 'female', string> = {
  male: '男',
  female: '女',
}

/**
 * 家长档案：以家长为锚（一个家长可绑定多台设备）。
 *
 * 与设备档案（/users/:deviceId）互补：那边回答「这台设备被谁用」，
 * 这边回答「这位家长在用什么」。设备表与孩子档案表都由同一份
 * /analytics/parents/:userId 响应驱动，不再逐台设备 backfill。
 *
 * 产品已定家长不支持自定义头像，因此身份卡不展示任何头像区块。
 */
export default function ParentDetail() {
  const { userId = '' } = useParams<{ userId: string }>()
  const query = useParentDetail(userId)
  const data = query.data ?? null
  const err = query.error as (Error & { status?: number }) | null
  const notFound = err?.status === 404
  const errorText = err
    ? err instanceof Error
      ? err.message
      : '加载失败'
    : null

  const header = (
    <PageHeader
      title="家长档案"
      description="以家长为锚：一个家长可绑定多台设备"
      actions={<Link to="/users">← 返回用户画像</Link>}
    />
  )

  if (notFound) {
    return (
      <div>
        {header}
        <Card>
          <Empty description="家长不存在">
            <Link to="/users">返回用户画像</Link>
          </Empty>
        </Card>
      </div>
    )
  }

  if (query.isLoading) {
    return (
      <div>
        {header}
        <Spin />
      </div>
    )
  }

  if (errorText || !data) {
    return (
      <div>
        {header}
        <Alert
          type="error"
          showIcon
          message="家长档案加载失败"
          description={errorText ?? '未知错误'}
        />
      </div>
    )
  }

  const { user, summary, devices } = data

  if (devices.length === 0) {
    return (
      <div>
        {header}
        <Card>
          <Empty description="该家长尚未绑定设备" />
        </Card>
      </div>
    )
  }

  return (
    <div>
      {header}

      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Card size="small" title="身份信息">
          <Descriptions column={2} size="small" colon={false}>
            <Descriptions.Item label="昵称">
              {user.nickname ?? <Tag>未设置昵称</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="手机号">
              {user.phone ?? '未绑定'}
            </Descriptions.Item>
            <Descriptions.Item label="手机厂商">
              {user.phoneMaker ?? '—'}
            </Descriptions.Item>
            <Descriptions.Item label="注册时间">
              {fmtTime(user.registeredAt)}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Card size="small" title="资料完整度">
          <Space size={8}>
            <Tag color={user.nickname ? 'success' : 'default'}>
              昵称：{user.nickname ? '已填' : '未填'}
            </Tag>
            <Tag color={user.phone ? 'success' : 'default'}>
              手机号：{user.phone ? '已填' : '未填'}
            </Tag>
          </Space>
        </Card>

        <Card size="small" title="概览">
          <Typography.Text>
            设备 {summary.deviceCount} 台 · 孩子 {summary.childCount} 位 ·
            反馈 {summary.feedbackCount} 条
          </Typography.Text>
        </Card>

        <Card size="small" title="绑定设备">
          <Table<ParentDevice>
            columns={deviceColumns}
            dataSource={devices}
            rowKey="deviceId"
            size="small"
            pagination={false}
          />
        </Card>

        <Card size="small" title="孩子档案">
          <Table<ParentDevice>
            columns={childColumns}
            dataSource={devices}
            rowKey="deviceId"
            size="small"
            pagination={false}
          />
        </Card>
      </Space>
    </div>
  )
}

const deviceColumns: ColumnsType<ParentDevice> = [
  {
    title: '设备 ID',
    dataIndex: 'deviceId',
    key: 'deviceId',
    render: (v: string) => <Link to={`/users/${encodeURIComponent(v)}`}>{v}</Link>,
  },
  {
    // 契约字段名是 characterKey（角色 key），沿用现有表把这一列标为 IP
    title: 'IP',
    dataIndex: 'characterKey',
    key: 'characterKey',
  },
  {
    title: '固件',
    dataIndex: 'firmwareVersion',
    key: 'firmwareVersion',
    render: (v: string | null) => v ?? '—',
  },
  {
    title: '角色',
    dataIndex: 'isOwner',
    key: 'isOwner',
    render: (v: boolean) => (v ? <Tag color="blue">主账号</Tag> : <Tag>绑定</Tag>),
  },
  {
    title: '绑定时间',
    dataIndex: 'boundAt',
    key: 'boundAt',
    render: (v: string) => fmtTime(v),
  },
  {
    title: '共享',
    dataIndex: 'boundUserCount',
    key: 'boundUserCount',
    render: (v: number) => (v > 1 ? <Tag color="blue">{v} 位家长</Tag> : '—'),
  },
  {
    title: '最近开机日',
    dataIndex: 'lastPresenceDate',
    key: 'lastPresenceDate',
    render: (v: string | null) => v ?? '—',
  },
]

const childColumns: ColumnsType<ParentDevice> = [
  {
    title: '设备 ID',
    dataIndex: 'deviceId',
    key: 'deviceId',
  },
  {
    title: '昵称',
    key: 'name',
    render: (_, r) => (r.childProfile ? (r.childProfile.name ?? '—') : '未录入'),
  },
  {
    title: '英文名',
    key: 'englishName',
    render: (_, r) => (r.childProfile ? (r.childProfile.englishName ?? '—') : '—'),
  },
  {
    title: '性别',
    key: 'gender',
    render: (_, r) =>
      r.childProfile?.gender ? GENDER_LABEL[r.childProfile.gender] : '—',
  },
  {
    title: '生日',
    key: 'birthday',
    render: (_, r) => (r.childProfile ? (r.childProfile.birthday ?? '—') : '—'),
  },
]
