import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const read = (path: string) => readFileSync(resolve(root, path))

interface PngHeader {
  width: number
  height: number
  bitDepth: number
  colorType: number
}

function pngHeader(path: string): PngHeader {
  const buf = read(path)
  expect(buf.subarray(1, 4).toString('ascii')).toBe('PNG')
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    bitDepth: buf[24],
    colorType: buf[25],
  }
}

function icoSizes(path: string): number[] {
  const buf = read(path)
  expect(buf.readUInt16LE(0)).toBe(0)
  expect(buf.readUInt16LE(2)).toBe(1)
  const count = buf.readUInt16LE(4)
  const sizes: number[] = []
  for (let i = 0; i < count; i += 1) {
    const width = buf[6 + i * 16] || 256
    sizes.push(width)
  }
  return sizes
}

describe('favicon 资源', () => {
  it('index.html 用根路径引用新图标（Vite 会按 base 重写），不再引用旧 svg', () => {
    const html = read('index.html').toString('utf8')

    expect(html).toContain('href="/favicon.ico"')
    expect(html).toContain('href="/favicon-16x16.png?v=1"')
    expect(html).toContain('href="/favicon-32x32.png?v=1"')
    expect(html).toContain('href="/favicon-48x48.png?v=1"')
    expect(html).toContain('href="/apple-touch-icon.png?v=1"')
    expect(html).not.toContain('href="/favicon.svg"')
    // %BASE_URL% 在 dev 下会被 Vite 再补一次 base，产生 /dashboard/dashboard/。
    expect(html).not.toContain('%BASE_URL%')
  })

  it('不再保留旧的紫色 favicon.svg', () => {
    expect(existsSync(resolve(root, 'public/favicon.svg'))).toBe(false)
  })

  it('favicon.ico 存在且包含 16/32/48 三档', () => {
    const sizes = icoSizes('public/favicon.ico')
    expect(sizes).toEqual(expect.arrayContaining([16, 32, 48]))
  })

  it.each([
    ['public/favicon-16x16.png', 16],
    ['public/favicon-32x32.png', 32],
    ['public/favicon-48x48.png', 48],
  ])('%s 是带 alpha 的 8bit RGBA', (path, size) => {
    expect(pngHeader(path)).toEqual({
      width: size,
      height: size,
      bitDepth: 8,
      colorType: 6,
    })
  })

  it('apple-touch-icon 是 180x180', () => {
    const header = pngHeader('public/apple-touch-icon.png')
    expect(header.width).toBe(180)
    expect(header.height).toBe(180)
    expect([2, 6]).toContain(header.colorType)
  })
})
