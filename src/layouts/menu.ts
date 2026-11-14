/**
 * 菜单选中态推导。
 *
 * 详情页（/users/:deviceId、/memories/:deviceId）没有自己的菜单项，取路径首段
 * 回落到所属一级入口高亮，不再逐个特判——之前只特判了 /memories，
 * 结果用户详情页左侧一个选中项都没有。
 *
 * 单独成模块（而不是从 AdminLayout.tsx 导出）是为了不破坏 Fast Refresh：
 * 组件文件只导出组件。
 */
export function selectedMenuKey(pathname: string): string[] {
  const segment = pathname.split('/')[1]
  return segment ? [`/${segment}`] : []
}
