import {
  Alert,
  Button,
  Descriptions,
  Popconfirm,
  Typography,
  message,
} from 'antd'
import {
  useDeleteDeviceChildProfile,
  useDeviceChildProfile,
} from '../../api/queries'
import type { DeviceChildProfile } from '../../types/analytics'
import { calcAge } from './child-profile-age'

interface Props {
  /** 设备业务 ID；仅当抽屉确认设备存在后才挂载（设备 404 时本 section 不渲染） */
  deviceId: string
}

function genderLabel(gender: DeviceChildProfile['gender']): string {
  if (gender === 'male') return '男'
  if (gender === 'female') return '女'
  return '—'
}

function birthdayLabel(birthday: string | null): string {
  if (!birthday) return '—'
  const age = calcAge(birthday, new Date())
  return age === null ? birthday : `${birthday}（${age}岁）`
}

/**
 * 设备详情抽屉的孩子信息 section：展示档案四字段（后端 PII 最小化，无 userId），
 * superadmin 可通过 Popconfirm 二次确认清空。清空成功后缓存失效回到「未设置」空态。
 */
export default function ChildProfileSection({ deviceId }: Props) {
  const query = useDeviceChildProfile(deviceId)
  const clear = useDeleteDeviceChildProfile()
  const profile = query.data?.profile ?? null

  const handleClear = async () => {
    try {
      await clear.mutateAsync(deviceId)
      message.success('孩子档案已清空')
    } catch {
      message.error('清空失败，请确认账号权限后重试')
    }
  }

  return (
    <section style={{ marginBottom: 24 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <Typography.Title level={5} style={{ margin: 0 }}>
          孩子信息
        </Typography.Title>
        {profile && (
          <Popconfirm
            title="清空后不可恢复，确认清空该设备的孩子信息？"
            okText="确认"
            cancelText="取消"
            okButtonProps={{ danger: true, loading: clear.isPending }}
            onConfirm={handleClear}
          >
            <Button danger size="small">
              清空
            </Button>
          </Popconfirm>
        )}
      </div>

      {query.isLoading ? (
        <Typography.Text type="secondary">加载中…</Typography.Text>
      ) : query.isError ? (
        <Alert
          type="error"
          showIcon
          message="加载失败"
          description={
            query.error instanceof Error ? query.error.message : '未知错误'
          }
        />
      ) : profile === null ? (
        <Typography.Text type="secondary">未设置孩子档案</Typography.Text>
      ) : (
        <Descriptions
          size="small"
          column={{ xs: 1, md: 2 }}
          items={[
            { key: 'name', label: '姓名', children: profile.name ?? '—' },
            {
              key: 'englishName',
              label: '英文名',
              children: profile.englishName ?? '—',
            },
            {
              key: 'gender',
              label: '性别',
              children: genderLabel(profile.gender),
            },
            {
              key: 'birthday',
              label: '生日',
              children: birthdayLabel(profile.birthday),
            },
          ]}
        />
      )}
    </section>
  )
}
