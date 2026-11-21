/**
 * 菜单选中态推导与运维组路径清单。
 *
 * 详情页（/users/:deviceId、/memories/:deviceId）没有自己的菜单项，取路径首段
 * 回落到所属一级入口高亮，不再逐个特判——之前只特判了 /memories，
 * 结果用户详情页左侧一个选中项都没有。
 *
 * 单独成模块（而不是从 AdminLayout.tsx 导出）是为了不破坏 Fast Refresh：
 * 组件文件只导出组件。运维组清单也放这里：路由表包 OpsGate 与菜单加锁标
 * 共用同一份定义，新增运维页不会只改一处。
 */
export function selectedMenuKey(pathname: string): string[] {
  const segment = pathname.split('/')[1]
  return segment ? [`/${segment}`] : []
}

/** 运维组 = 全部破坏性操作所在的 tab，只对 superadmin 开放。顺序即菜单顺序。 */
export const OPS_PATHS = ['/llm', '/adventure', '/prompts', '/voice'] as const

export type OpsPath = (typeof OPS_PATHS)[number]

/**
 * 受限时雾层上显示的标题。
 *
 * 只放标题、不放描述：描述与页面自己的 PageHeader 会各存一份，长文案必然漂移；
 * 标题短、且是用户识别 tab 的最小信息。
 */
export const OPS_ROUTE_META: Record<OpsPath, { title: string }> = {
  '/llm': { title: '模型监控' },
  '/adventure': { title: '冒险内容' },
  '/prompts': { title: 'Prompt 管理' },
  '/voice': { title: '语速与音色' },
}

export function isOpsPath(pathname: string): boolean {
  return (OPS_PATHS as readonly string[]).includes(pathname)
}
