/**
 * 抽屉/弹窗宽度：桌面保持设计宽度，手机上封顶到视口宽度。
 *
 * antd 的 Drawer 外层虽有 max-width:100vw 兜底，但宽度是按桌面值写死的，
 * 内容区（两列 Descriptions、定宽表格）仍会按 640/900 排版再被裁掉。
 * 用 min() 让宽度真正跟随视口，两个尺寸同时成立，不需要按断点切 JS 分支。
 */
export function drawerWidth(px: number): string {
  if (!(px > 0)) {
    throw new Error(`drawerWidth expects a positive number, got ${px}`)
  }
  return `min(${px}px, 100vw)`
}
