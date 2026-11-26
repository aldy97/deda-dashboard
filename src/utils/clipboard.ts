/**
 * 读取剪贴板文本。
 *
 * 浏览器没有同步读取的兜底方案（execCommand 只有 copy 没有 paste），
 * 非 https / 权限被拒 / 老浏览器一律返回 null，由调用方提示手动粘贴。
 */
export async function readText(): Promise<string | null> {
  const clipboard =
    typeof navigator !== 'undefined' ? navigator.clipboard : undefined
  if (!clipboard?.readText) return null
  try {
    return await clipboard.readText()
  } catch {
    return null
  }
}

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
