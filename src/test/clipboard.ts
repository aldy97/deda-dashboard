import { afterEach, vi } from 'vitest'

/**
 * 注入 navigator.clipboard.writeText 替身，用来断言「真实复制到剪贴板的内容」。
 *
 * 页面上的复制图标走 antd copyable，它优先调用 navigator.clipboard.writeText，
 * 不看 execCommand 兜底；jsdom 里没有 clipboard 时复制静默失败但提示照样变「已复制」，
 * 所以只看提示状态不足以证明复制内容正确。
 *
 * 必须在 userEvent.setup() 之后调用：setup 会挂自己的 clipboard stub 覆盖之前的值；
 * 直接 userEvent.click(...)（direct API）不挂 stub，顺序无要求。
 * 每个用例结束后自动拆除。
 */
export function stubClipboard() {
  const writeText = vi
    .fn<(text: string) => Promise<void>>()
    .mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  })
  return writeText
}

afterEach(() => {
  delete (navigator as { clipboard?: unknown }).clipboard
})
