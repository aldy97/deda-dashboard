/**
 * 测试视口控制：让 matchMedia 按可控的窗口宽度回答。
 *
 * antd 的响应式能力（Grid.useBreakpoint、Sider 的 breakpoint、Table 列的
 * responsive、Modal 的窄屏样式）全部走 matchMedia；jsdom 没有布局引擎，
 * 只补一个恒返回 false 的桩，断点相关代码在测试里就永远只能走一条分支。
 *
 * 默认宽度 1280（桌面）：既有测试的渲染结果保持不变；要测手机/平板，
 * 在用例里 `act(() => setViewportWidth(375))`，afterEach 由 setup.tsx 复位。
 */

interface MediaRecord {
  query: string
  listeners: Set<(event: MediaQueryListEvent) => void>
  legacyListeners: Set<(event: MediaQueryListEvent) => void>
}

const DEFAULT_WIDTH = 1280

let width = DEFAULT_WIDTH
const records = new Set<MediaRecord>()

export function currentViewportWidth(): number {
  return width
}

function matchesQuery(query: string): boolean {
  const min = /min-width:\s*(\d+)px/.exec(query)
  const max = /max-width:\s*(\d+)px/.exec(query)
  // 只认宽度查询；颜色方案等其它媒体特性一律不匹配，避免「碰巧 true」误导断言
  if (!min && !max) return false
  if (min && width < Number(min[1])) return false
  if (max && width > Number(max[1])) return false
  return true
}

function notify(record: MediaRecord) {
  const event = {
    matches: matchesQuery(record.query),
    media: record.query,
  } as MediaQueryListEvent
  record.listeners.forEach((listener) => listener(event))
  record.legacyListeners.forEach((listener) => listener(event))
}

export function setViewportWidth(next: number) {
  width = next
  // antd 的部分组件直接读 innerWidth 兜底，两边必须同步
  window.innerWidth = next
  window.dispatchEvent(new Event('resize'))
  for (const record of records) notify(record)
}

export function resetViewportWidth() {
  width = DEFAULT_WIDTH
  window.innerWidth = DEFAULT_WIDTH
}

export function installMatchMedia() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string): MediaQueryList => {
      const record: MediaRecord = {
        query,
        listeners: new Set(),
        legacyListeners: new Set(),
      }
      records.add(record)
      return {
        get matches() {
          return matchesQuery(query)
        },
        media: query,
        onchange: null,
        addListener: (listener: (event: MediaQueryListEvent) => void) =>
          record.legacyListeners.add(listener),
        removeListener: (listener: (event: MediaQueryListEvent) => void) =>
          record.legacyListeners.delete(listener),
        addEventListener: (
          _type: string,
          listener: (event: MediaQueryListEvent) => void,
        ) => record.listeners.add(listener),
        removeEventListener: (
          _type: string,
          listener: (event: MediaQueryListEvent) => void,
        ) => record.listeners.delete(listener),
        dispatchEvent: () => false,
      } as unknown as MediaQueryList
    },
  })
}
