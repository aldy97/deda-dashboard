/**
 * 素材上传的前端校验与尺寸读取。
 *
 * 校验规则与服务端保持同一条口径（png/jpg/jpeg/webp、≤2MB），
 * 但服务端仍是最终裁决方：这里只负责在选文件那一刻把明显不合法的拦下来，
 * 减少一次注定 400 的往返。naturalWidth / naturalHeight 用浏览器 Image 读，
 * 上传前就把宽高填进 multipart，而不是交给服务端再去解一次图。
 */

export const ASSET_MAX_BYTES = 2 * 1024 * 1024
export const ASSET_ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
]
export const ASSET_ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp']

/** 文件不合法时返回中文原因；合法返回 null */
export function validateAssetFile(file: File): string | null {
  const mimeOk = ASSET_ALLOWED_MIME_TYPES.includes(file.type)
  const extOk = ASSET_ALLOWED_EXTENSIONS.some((ext) =>
    file.name.toLowerCase().endsWith(ext),
  )
  if (!mimeOk && !extOk) {
    return '仅支持 png / jpg / jpeg / webp 格式'
  }
  if (file.size > ASSET_MAX_BYTES) {
    return '图片不能超过 2MB'
  }
  return null
}

/** 读取图片的 naturalWidth / naturalHeight；读不出来（损坏文件）就 reject */
export function readImageDimensions(
  file: File,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () =>
        resolve({ width: img.naturalWidth, height: img.naturalHeight })
      img.onerror = () => reject(new Error('无法读取图片尺寸'))
      img.src = String(reader.result)
    }
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsDataURL(file)
  })
}
