import { afterEach, describe, expect, it, vi } from 'vitest'
import { fileToBase64 } from './docxUpload'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fileToBase64', () => {
  it('把文件读成去掉 data: 前缀的纯 base64', async () => {
    const file = new File(['hello'], 'a.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })
    await expect(fileToBase64(file)).resolves.toBe('aGVsbG8=')
  })

  it('读到的不是字符串时拒绝，而不是把 ArrayBuffer 当 base64 交出去', async () => {
    class ArrayBufferReader {
      result: ArrayBuffer | null = null
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      readAsDataURL() {
        this.result = new ArrayBuffer(4)
        this.onload?.()
      }
    }
    vi.stubGlobal('FileReader', ArrayBufferReader)

    await expect(fileToBase64(new File(['x'], 'x.docx'))).rejects.toThrow('读取文件失败')
  })

  it('读文件本身报错时拒绝', async () => {
    class FailingReader {
      result: string | null = null
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      readAsDataURL() {
        this.onerror?.()
      }
    }
    vi.stubGlobal('FileReader', FailingReader)

    await expect(fileToBase64(new File(['x'], 'x.docx'))).rejects.toThrow('读取文件失败')
  })
})
