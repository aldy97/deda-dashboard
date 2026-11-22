import { LockOutlined } from '@ant-design/icons'
import { Card, Skeleton, Space, Typography } from 'antd'
import type { ReactNode } from 'react'
import { useAnalyticsMeta } from '../../api/meta'
import PageHeader from '../PageHeader'
import { isSuperAdmin } from './role'

interface OpsGateProps {
  /** 页面标题。受限时也显示，让人知道自己点进了哪个 tab。 */
  title: string
  description?: ReactNode
  children: ReactNode
}

/**
 * 运维组（模型监控 / 冒险内容 / 提示词管理 / 语速设置）的路由级闸口。
 *
 * 为什么在路由层做，而不是每个页面自己判断：
 * 1. 受限时 **children 完全不挂载**。Prompt / LLM 页面一挂载就并发打出十几个请求，
 *    普通 admin 进来只会看到一片 403，白烧后端还污染监控。
 * 2. 四个页面零侵入，将来新增运维页只需在路由表里包一层，不会漏包。
 *
 * 判据只信服务端 `/analytics/meta` 的 `admin.role`（见 ./role）。meta 未就绪、
 * 请求失败、或老后端没有 admin 块时一律当普通 admin（fail-closed）——
 * 宁可短暂看不到，也不能把雾放走。
 *
 * 「薄雾」是静态骨架 + 半透明遮罩，不是把真实页面模糊掉：骨架不发任何请求。
 */
export default function OpsGate({ title, description, children }: OpsGateProps) {
  const metaQuery = useAnalyticsMeta()

  if (isSuperAdmin(metaQuery.data)) {
    return <>{children}</>
  }

  const reason = metaQuery.isPending
    ? '正在确认账号权限…'
    : metaQuery.isError
      ? '无法确认账号权限（/analytics/meta 不可用），已按无权限处理。请刷新或重新登录后再试。'
      : `当前账号是普通管理员（${
          metaQuery.data?.admin?.username ?? '未知账号'
        }），「${title}」只对超级管理员（superadmin）开放。请联系超级管理员把 ANALYTICS_ADMIN_USERS 里该账号的 role 改为 superadmin，然后重新登录。`

  return (
    <div>
      <PageHeader title={title} description={description} />
      <div style={{ position: 'relative' }}>
        <div aria-hidden data-testid="ops-skeleton">
          <Card>
            <Skeleton active paragraph={{ rows: 8 }} />
          </Card>
        </div>
        <div
          data-testid="ops-fog"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            background: 'rgba(255, 255, 255, 0.55)',
            backdropFilter: 'blur(3px)',
            WebkitBackdropFilter: 'blur(3px)',
          }}
        >
          <Card style={{ maxWidth: 560 }}>
            <Space direction="vertical" size={8}>
              <LockOutlined style={{ fontSize: 20 }} />
              <Typography.Title level={5} style={{ margin: 0 }}>
                仅超级管理员可访问
              </Typography.Title>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                {reason}
              </Typography.Paragraph>
            </Space>
          </Card>
        </div>
      </div>
    </div>
  )
}
