import { useAnalyticsMeta } from '../../api/meta'
import { isSuperAdmin } from './role'

/**
 * 当前账号的访问级别，供 AccessLink 决定「链接」还是「纯文本」。
 *
 * 与 OpsGate 同一判据与同一 fail-closed 口径：meta 未就绪、请求失败、或老后端
 * 没有 admin 块时都不放行，宁可短暂把专属入口显示成文本，也不让普通 admin
 * 先看到一个点进去只有雾的链接。
 */
export type ViewerRole = 'superadmin' | 'restricted' | 'pending' | 'unknown'

export function useViewerRole(): ViewerRole {
  const query = useAnalyticsMeta()
  if (query.isPending) return 'pending'
  if (query.isError) return 'unknown'
  return isSuperAdmin(query.data) ? 'superadmin' : 'restricted'
}
