import { Grid } from 'antd'

export type LayoutMode = 'mobile' | 'tablet' | 'desktop'

/**
 * 布局档位，只此一处定义断点口径（antd 默认 token 的 md=768 / lg=992）：
 *
 * - mobile（<768）：没有 Sider，导航进抽屉；表格改卡片；内容区 padding 收紧
 * - tablet（768–991）：Sider 收成 64px 图标栏，内容区仍在右侧
 * - desktop（≥992）：维持 240px 侧栏
 *
 * 判定读 Grid.useBreakpoint 而不是自建 matchMedia：antd 的首帧快照同步读
 * matchMedia，不会先渲染成桌面再闪一下；测试里也因此能靠改视口宽度驱动。
 */
export function useLayoutMode(): LayoutMode {
  const screens = Grid.useBreakpoint()
  if (!screens.md) return 'mobile'
  if (!screens.lg) return 'tablet'
  return 'desktop'
}

/** 手机档：表格卡片化等「整块换形态」的判定都用它，避免各页面各写一套条件。 */
export function useIsMobile(): boolean {
  return useLayoutMode() === 'mobile'
}
