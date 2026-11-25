/**
 * 复制文本到剪贴板。
 *
 * 优先用异步剪贴板 API；不可用（非 https / 权限被拒 / 老浏览器）时走
 * textarea + execCommand 的兜底。返回是否成功，由调用方决定提示文案。
 */
export async function copyText(text: string): Promise<boolean> {
  const clipboard =
    typeof navigator !== 'undefined' ? navigator.clipboard : undefined
  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(text)
      return true
    } catch {
      // 剪贴板 API 被拒，落回兜底
    }
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  try {
    return typeof document.execCommand === 'function'
      ? document.execCommand('copy')
      : false
  } catch {
    return false
  } finally {
    document.body.removeChild(textarea)
  }
}
