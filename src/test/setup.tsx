import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { installMatchMedia, resetViewportWidth } from './viewport'

/**
 * jsdom 缺失的浏览器 API 补齐 + echarts 替身。
 * 原则：只补 antd/echarts 真正会调用的最小实现，不引入 polyfill 依赖。
 */

// antd 的响应式组件（Grid/Sider/Table 列/Modal）会读 matchMedia：
// 用按宽度回答的实现替代恒 false 的桩，断点相关代码才可测。
// 默认 1280（桌面），afterEach 复位，确保既有用例的渲染结果不变。
installMatchMedia()

// antd Table / Select 的虚拟滚动依赖 ResizeObserver
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver =
  ResizeObserverStub as unknown as typeof ResizeObserver

// jsdom 未实现 scrollTo，antd 锚定滚动会调用
window.scrollTo = (() => undefined) as unknown as typeof window.scrollTo

/**
 * echarts 依赖 canvas，jsdom 没有实现；全局替身渲染成带 option 的 div。
 * 图表组件的 option 计算逻辑照常执行且可断言（结构读 data-option，
 * tooltip.formatter 等函数字段读 src/test/echartsOptions 的活对象），
 * 只把「画布渲染」这一段不可测的部分换掉。
 */
vi.mock('echarts-for-react', async () => {
  const { createElement } = await import('react')
  const { chartOptions } = await import('./echartsOptions')
  return {
    default: (props: { option?: Record<string, unknown> }) => {
      // 函数字段过不了 JSON.stringify，额外留一份活对象给 tooltip 断言
      if (props.option) chartOptions.push(props.option)
      return createElement('div', {
        'data-testid': 'echarts-mock',
        'data-option': JSON.stringify(props.option ?? null),
      })
    },
  }
})

afterEach(async () => {
  cleanup()
  resetViewportWidth()
  const { resetChartOptions } = await import('./echartsOptions')
  resetChartOptions()
  vi.clearAllMocks()
})
