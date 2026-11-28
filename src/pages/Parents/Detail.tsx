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
import CopyableText from '../../components/CopyableText'
import InfoTip from '../../components/InfoTip'
import PhoneDuplicateTag from '../../components/PhoneDuplicateTag'
import RefreshButton from '../../components/RefreshButton'
import { usePageRefresh } from '../../api/refresh'
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
 * 这边回答「这位家长在用什么」。设备信息与孩子档案是同一行设备的两个面
 * （同一份 /analytics/parents/:userId 响应、同一个 rowKey），因此合并成
 * 一张表；概览摘要挂在这张表的卡片表头，不再单独占一个区块。
 *
 * 产品已定家长不支持自定义头像，因此身份卡不展示任何头像区块。
 */
export default function ParentDetail() {
  const { userId = '' } = useParams<{ userId: string }>()
  const query = useParentDetail(userId)
  const { refresh, isRefreshing } = usePageRefresh('parent')
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
      actions={
        <>
          <RefreshButton loading={isRefreshing} onClick={refresh} />
          <Link to="/users">← 返回用户画像</Link>
        </>
      }
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
              {user.phone ? (
                <Space size={8}>
                  <span>{user.phone}</span>
                  <CopyableText text={user.phone} tip="复制手机号" />
                  <PhoneDuplicateTag duplicate={user.phoneDuplicate} />
                </Space>
              ) : (
                '未绑定'
              )}
            </Descriptions.Item>
            <Descriptions.Item label="性别">
              {user.gender ? (
                GENDER_LABEL[user.gender]
              ) : (
                <Tag>未设置</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="生日">
              {user.birthday ?? '未设置'}
            </Descriptions.Item>
            <Descriptions.Item label="手机厂商">
              {user.phoneMaker ?? '—'}
            </Descriptions.Item>
            <Descriptions.Item label="注册时间">
              {fmtTime(user.registeredAt)}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {/*
          资料完整度：按 2026-11-28 口径整段下线，保留代码待恢复。
          恢复时把这段注释解开即可（依赖 user.nickname / phone / gender / birthday）。
          <Card size="small" title="资料完整度">
            <Space size={8}>
              <Tag color={user.nickname ? 'success' : 'default'}>
                昵称：{user.nickname ? '已填' : '未填'}
              </Tag>
              <Tag color={user.phone ? 'success' : 'default'}>
                手机号：{user.phone ? '已填' : '未填'}
              </Tag>
              <Tag color={user.gender ? 'success' : 'default'}>
                性别：{user.gender ? '已填' : '未填'}
              </Tag>
              <Tag color={user.birthday ? 'success' : 'default'}>
                生日：{user.birthday ? '已填' : '未填'}
              </Tag>
            </Space>
          </Card>
        */}

        <Card
          size="small"
          title="绑定设备与孩子档案"
          extra={
            <Typography.Text type="secondary">
              设备 {summary.deviceCount} 台 · 孩子 {summary.childCount} 位 ·
              反馈 {summary.feedbackCount} 条
            </Typography.Text>
          }
        >
          <Table<ParentDevice>
            columns={mergedColumns}
            dataSource={devices}
            rowKey="deviceId"
            size="small"
            pagination={false}
            scroll={{ x: 'max-content' }}
          />
        </Card>
      </Space>
    </div>
  )
}

const mergedColumns: ColumnsType<ParentDevice> = [
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
  {
    title: '孩子昵称',
    key: 'childName',
    render: (_, r) => (r.childProfile ? (r.childProfile.name ?? '—') : '未录入'),
  },
  {
    title: '英文名',
    key: 'englishName',
    render: (_, r) => (r.childProfile ? (r.childProfile.englishName ?? '—') : '—'),
  },
  {
    title: '性别',
    key: 'childGender',
    render: (_, r) =>
      r.childProfile?.gender ? GENDER_LABEL[r.childProfile.gender] : '—',
  },
  {
    title: '生日',
    key: 'childBirthday',
    render: (_, r) => (r.childProfile ? (r.childProfile.birthday ?? '—') : '—'),
  },
  {
    title: (
      <>
        操作
        <InfoTip title="消息＝该设备的对话明细；反馈＝该设备全部绑定账号提交的反馈（经绑定关系反查），不等于当前这位家长本人的反馈" />
      </>
    ),
    key: 'actions',
    render: (_, r) => (
      <Space size={12}>
        <Link to={`/messages?deviceId=${encodeURIComponent(r.deviceId)}`}>消息</Link>
        <Link
          to={`/feedback?tab=user&deviceId=${encodeURIComponent(r.deviceId)}`}
        >
          反馈
        </Link>
      </Space>
    ),
  },
]
