/**
 * 把本地文件读成 base64（去掉 data: 前缀）。docx 转换接口要的是纯 base64 正文。
 * 纯函数独立成文件，供抽屉里的「从 docx 填充」按钮（DocxUploadButton）使用。
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string') {
        resolve(result.slice(result.indexOf(',') + 1))
      } else {
        reject(new Error('读取文件失败'))
      }
    }
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsDataURL(file)
  })
}
