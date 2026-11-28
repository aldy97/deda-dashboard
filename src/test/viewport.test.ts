import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  currentViewportWidth,
  resetViewportWidth,
  setViewportWidth,
} from './viewport'

/**
 * 测试视口：antd 的响应式全部走 matchMedia，jsdom 没有真实布局，
 * 所以必须让 matchMedia 按可控宽度回答，否则断点相关组件在测试里
 * 只能拿到「全部 false」这一种答案。
 */
describe('viewport 测试基建', () => {
  afterEach(() => {
    resetViewportWidth()
  })

  it('默认 1280：桌面断点成立，手机断点不成立', () => {
    expect(currentViewportWidth()).toBe(1280)
    expect(window.matchMedia('(min-width: 768px)').matches).toBe(true)
    expect(window.matchMedia('(min-width: 992px)').matches).toBe(true)
    expect(window.matchMedia('(max-width: 575px)').matches).toBe(false)
  })

  it('切到 375：md/lg 不成立，xs 成立', () => {
    setViewportWidth(375)
    expect(window.matchMedia('(min-width: 768px)').matches).toBe(false)
    expect(window.matchMedia('(min-width: 992px)').matches).toBe(false)
    expect(window.matchMedia('(max-width: 575px)').matches).toBe(true)
    expect(window.innerWidth).toBe(375)
  })

  it('切到 900：md 成立、lg 不成立（平板档）', () => {
    setViewportWidth(900)
    expect(window.matchMedia('(min-width: 768px)').matches).toBe(true)
    expect(window.matchMedia('(min-width: 992px)').matches).toBe(false)
  })

  it('宽度变化时通知订阅者，附带新的 matches', () => {
    const listener = vi.fn()
    const mql = window.matchMedia('(min-width: 768px)')
    mql.addEventListener('change', listener)

    setViewportWidth(375)

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0][0]).toMatchObject({
      matches: false,
      media: '(min-width: 768px)',
    })

    mql.removeEventListener('change', listener)
    setViewportWidth(1280)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('兼容旧的 addListener/removeListener', () => {
    const listener = vi.fn()
    const mql = window.matchMedia('(min-width: 992px)')
    mql.addListener(listener)

    setViewportWidth(900)

    expect(listener).toHaveBeenCalledTimes(1)
    mql.removeListener(listener)
  })

  it('无法识别宽度的查询一律不匹配', () => {
    expect(window.matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(
      false,
    )
  })
})
