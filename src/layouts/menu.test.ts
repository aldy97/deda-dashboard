import { describe, expect, it } from 'vitest'
import { OPS_PATHS, OPS_ROUTE_META, isOpsPath } from './menu'

/**
 * 运维组的路径清单是「雾」与菜单锁标的唯一来源，路由表与测试都从这里取，
 * 避免在两处各写一份、新增运维页时漏一处。
 */
describe('运维组路径', () => {
  it('六个 tab 都在清单里，顺序与菜单一致', () => {
    expect(OPS_PATHS).toEqual([
      '/llm',
      '/adventure',
      '/test-devices',
      '/prompts',
      '/voice',
      '/app-assets',
    ])
  })

  it('每个运维路径都有标题', () => {
    for (const path of OPS_PATHS) {
      expect(OPS_ROUTE_META[path].title.trim().length).toBeGreaterThan(0)
    }
    expect(OPS_ROUTE_META['/voice'].title).toBe('语速与音色')
    expect(OPS_ROUTE_META['/test-devices'].title).toBe('测试设备白名单')
    expect(OPS_ROUTE_META['/app-assets'].title).toBe('Elly 素材')
  })

  it('isOpsPath 只认精确一级路径', () => {
    expect(isOpsPath('/llm')).toBe(true)
    expect(isOpsPath('/prompts')).toBe(true)
    expect(isOpsPath('/test-devices')).toBe(true)
    expect(isOpsPath('/app-assets')).toBe(true)
    // 详情页与非运维页不误判
    expect(isOpsPath('/users/dev-001')).toBe(false)
    expect(isOpsPath('/memories/dev-001')).toBe(false)
    expect(isOpsPath('/overview')).toBe(false)
    expect(isOpsPath('/llmxyz')).toBe(false)
  })
})
