import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ASSET_MAX_BYTES,
  readImageDimensions,
  validateAssetFile,
} from './uploadRules'

/**
 * 前端上传校验与尺寸读取。
 * FileReader / Image 都是浏览器 API，jsdom 没有真实实现，这里用最小替身覆盖
 * onload / onerror 两条路径，只断言尺寸解析与错误兜底，不去测浏览器自己。
 */
class FakeFileReader {
  result: string | null = null
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  readAsDataURL(_file: File) {
    this.result = 'data:image/png;base64,xxx'
    queueMicrotask(() => this.onload?.())
  }
}

class FakeImage {
  naturalWidth = 800
  naturalHeight = 600
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  set src(_value: string) {
    queueMicrotask(() => this.onload?.())
  }
}

function file(name: string, size: number, type = 'image/png'): File {
  const content = new Uint8Array(size)
  return new File([content], name, { type })
}

describe('validateAssetFile', () => {
  it('png / jpg / jpeg / webp 合法文件返回 null', () => {
    expect(validateAssetFile(file('a.png', 100))).toBeNull()
    expect(validateAssetFile(file('a.jpg', 100, 'image/jpeg'))).toBeNull()
    expect(validateAssetFile(file('a.jpeg', 100, 'image/jpeg'))).toBeNull()
    expect(validateAssetFile(file('a.webp', 100, 'image/webp'))).toBeNull()
  })

  it('类型与扩展名都不匹配时给出格式错误', () => {
    expect(validateAssetFile(file('a.gif', 100, 'image/gif'))).toContain(
      '仅支持',
    )
  })

  it('mime 为空但扩展名合法时放行（浏览器偶发不报 type）', () => {
    expect(validateAssetFile(file('a.png', 100, ''))).toBeNull()
  })

  it('超过 2MB 给出大小错误', () => {
    expect(validateAssetFile(file('a.png', ASSET_MAX_BYTES + 1))).toContain(
      '2MB',
    )
  })

  it('恰好 2MB 不拦截', () => {
    expect(validateAssetFile(file('a.png', ASSET_MAX_BYTES))).toBeNull()
  })
})

describe('readImageDimensions', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('读得到 naturalWidth / naturalHeight', async () => {
    vi.stubGlobal('FileReader', FakeFileReader)
    vi.stubGlobal('Image', FakeImage)

    await expect(readImageDimensions(file('a.png', 10))).resolves.toEqual({
      width: 800,
      height: 600,
    })
  })

  it('图片损坏（Image onerror）时 reject 并给中文原因', async () => {
    vi.stubGlobal('FileReader', FakeFileReader)
    vi.stubGlobal(
      'Image',
      class extends FakeImage {
        override set src(_value: string) {
          queueMicrotask(() => this.onerror?.())
        }
      },
    )

    await expect(readImageDimensions(file('a.png', 10))).rejects.toThrow(
      '无法读取图片尺寸',
    )
  })

  it('文件读取失败（FileReader onerror）时 reject', async () => {
    vi.stubGlobal(
      'FileReader',
      class extends FakeFileReader {
        override readAsDataURL(_file: File) {
          queueMicrotask(() => this.onerror?.())
        }
      },
    )
    vi.stubGlobal('Image', FakeImage)

    await expect(readImageDimensions(file('a.png', 10))).rejects.toThrow(
      '读取文件失败',
    )
  })
})
