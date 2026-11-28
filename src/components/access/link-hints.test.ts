import { describe, expect, it } from 'vitest'
import { OPS_ROUTE_META } from '../../layouts/menu'
import { isOpsTarget, linkHintTitle, TARGETS } from './link-hints'

describe('link-hints', () => {
  it('当前有链接的运维页都有对应目标（/voice、/app-assets 暂无站内链接）', () => {
    for (const path of ['/llm', '/prompts', '/adventure', '/test-devices']) {
      const matched = Object.entries(TARGETS).filter(([, def]) =>
        def.path.startsWith(path),
      )
      expect(matched.length, path).toBeGreaterThan(0)
    }
  })

  it('专属目标的文案前缀与菜单标题一致', () => {
    for (const target of Object.values(TARGETS)) {
      const path = target.path.split('?')[0]
      const menuTitle = OPS_ROUTE_META[path as keyof typeof OPS_ROUTE_META]?.title
      if (!menuTitle) continue
      expect(target.label.startsWith(menuTitle), `${path} → ${target.label}`).toBe(
        true,
      )
    }
  })

  it('非专属目标不算运维组，专属目标算', () => {
    expect(isOpsTarget('device-profile')).toBe(false)
    expect(isOpsTarget('message-list')).toBe(false)
    expect(isOpsTarget('prompts')).toBe(true)
    expect(isOpsTarget('llm-perf')).toBe(true)
    expect(isOpsTarget('adventure')).toBe(true)
    expect(isOpsTarget('test-devices')).toBe(true)
  })

  it('普通目标：说明目的地与要带过去的上下文', () => {
    expect(linkHintTitle('device-profile', { carries: ['deviceId'] })).toBe(
      '点击前往「设备档案」，会带上 deviceId',
    )
    expect(linkHintTitle('message-detail')).toBe('点击前往「消息明细 · 该轮问答」')
  })

  it('目标页内的具体位置拼在书名号里', () => {
    expect(linkHintTitle('adventure', { detail: '该集版本快照' })).toBe(
      '点击前往「冒险内容工作台 · 该集版本快照」',
    )
  })

  it('专属目标带「超级管理员专属」标记', () => {
    expect(
      linkHintTitle('prompts', { detail: '该场景', exclusive: true }),
    ).toBe('点击前往「提示词管理 · 该场景」（超级管理员专属）')
  })
})
