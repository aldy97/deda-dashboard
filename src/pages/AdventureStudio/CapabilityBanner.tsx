import { Alert } from 'antd'
import type { ApiError } from '../../api/client'
import { useAdventureCapabilities } from '../../api/queries'

/**
 * 环境告警横幅。
 *
 * 环境标签（可写/只读）由页面 Header 展示；这里只负责进页面后真正需要
 * 打断注意力的异常：没权限（403）、能力清单加载失败、只读环境不能写。
 * 答案完全来自服务端 capabilities，不看前端猜测——因为能不能写由两道正交的闸决定
 * （人的 scope + 环境的 CONTENT_ADMIN_PROFILE），前端无从得知，尤其是 prod 即使把
 * 账号白名单误配成和 staging 一样，profile 不是 authoring 依然写不动。
 *
 * 403 在这里是**正常结果**而不是故障：看板管理员默认没有 adventure-content scope，
 * 对他们连读都是 403。src/api/client.ts 对这个前缀的 403 刻意不清 token 不跳登录，
 * 否则一个没权限的人点开菜单就会被踢下线。
 */
export default function CapabilityBanner() {
  const caps = useAdventureCapabilities()

  if (caps.isPending) return null

  if (caps.error) {
    const error = caps.error as ApiError
    if (error.status === 403) {
      return (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="你没有冒险内容管理权限"
          description="冒险内容管理台只对超级管理员（superadmin）开放。请联系超级管理员把 ANALYTICS_ADMIN_USERS 里该账号的 role 改为 superadmin，然后重新登录。"
        />
      )
    }
    return (
      <Alert
        type="error"
        showIcon
        style={{ marginBottom: 16 }}
        message="能力清单加载失败"
        description={error.message}
      />
    )
  }

  const data = caps.data
  if (!data || data.authoring) return null

  return (
    <Alert
      type="warning"
      showIcon
      style={{ marginBottom: 16 }}
      message={`当前环境只读（CONTENT_ADMIN_PROFILE=${data.profile}），所有写操作会被服务端拒绝`}
      description="这是设计如此，不是故障：内容请先在 staging 改好、验证过，再用「跨环境搬运」整包导入到这里（导入同样需要 authoring，所以 prod 的写入只能由部署侧显式开放）。校验、试播、导入预览、审计与自愈面板在只读环境照常可用。"
    />
  )
}
