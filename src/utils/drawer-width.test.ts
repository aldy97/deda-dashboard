import { describe, expect, it } from 'vitest'
import { drawerWidth } from './drawer-width'

/**
 * 抽屉宽度：桌面维持设计宽度，手机上封顶到视口宽度。
 * antd 的 Drawer 外层有 max-width:100vw 兜底，但内部两列布局仍按 640 排版，
 * 显式 min() 能让宽度真正跟随视口，内容不再按桌面宽度挤压。
 */
describe('drawerWidth', () => {
  it('常规宽度产出 min() 表达式', () => {
    expect(drawerWidth(640)).toBe('min(640px, 100vw)')
    expect(drawerWidth(900)).toBe('min(900px, 100vw)')
  })

  it('数字按 px 处理，不做四舍五入', () => {
    expect(drawerWidth(480.5)).toBe('min(480.5px, 100vw)')
  })

  it('非正数属于调用方错误，直接抛出而不是产出不可用的宽度', () => {
    expect(() => drawerWidth(0)).toThrow(/positive/i)
    expect(() => drawerWidth(-10)).toThrow(/positive/i)
  })
})
