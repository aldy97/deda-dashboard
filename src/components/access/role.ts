import type { AnalyticsMeta } from '../../types/analytics'

/**
 * 运维组权限的唯一判据：服务端 `/analytics/meta` 下发的 `admin.role`。
 *
 * 前端不解析 JWT——客户端读 token 内容迟早会与「权限只信服务端结论」的口径打架。
 * meta 未就绪、请求失败、或老后端没有 admin 块时一律返回 false（fail-closed）：
 * 宁可短暂看不到运维页，也不能把雾放走。
 */
export function isSuperAdmin(meta?: AnalyticsMeta | null): boolean {
  return meta?.admin?.role === 'superadmin'
}
