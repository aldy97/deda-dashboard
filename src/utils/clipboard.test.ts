import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyText, readText } from './clipboard'

/**
 * 复制文本：优先剪贴板 API，不可用或失败时落回 textarea + execCommand。
 * jsdom 没有 document.execCommand，用 defineProperty 补一个替身覆盖两条路。
 */
describe('copyText', () => {
  const realClipboard = navigator.clipboard

  function stubClipboard(writeText: ((text: string) => Promise<void>) | undefined) {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: writeText ? { writeText } : undefined,
    })
  }

  function stubExecCommand(returns: boolean) {
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValue(returns),
    })
    return document.execCommand as ReturnType<typeof vi.fn>
  }

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: realClipboard,
    })
    delete (document as { execCommand?: unknown }).execCommand
  })

  it('剪贴板 API 可用时直接写并返回 true', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    stubClipboard(writeText)

    await expect(copyText('https://cdn.example.com/a.png')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('https://cdn.example.com/a.png')
  })

  it('剪贴板 API 不可用时落回 execCommand', async () => {
    stubClipboard(undefined)
    const exec = stubExecCommand(true)

    await expect(copyText('https://cdn.example.com/a.png')).resolves.toBe(true)
    expect(exec).toHaveBeenCalledWith('copy')
  })

  it('剪贴板 API 拒绝时也走兜底', async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error('denied')))
    const exec = stubExecCommand(true)

    await expect(copyText('url')).resolves.toBe(true)
    expect(exec).toHaveBeenCalledWith('copy')
  })

  it('两条路都失败时返回 false', async () => {
    stubClipboard(undefined)
    stubExecCommand(false)

    await expect(copyText('url')).resolves.toBe(false)
  })
})

/**
 * 读取剪贴板：浏览器没有同步兜底方案，API 不可用或被拒时返回 null，
 * 由调用方给出「请手动粘贴」的提示。
 */
describe('readText', () => {
  const realClipboard = navigator.clipboard

  function stubClipboard(readText: (() => Promise<string>) | undefined) {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: readText ? { readText } : undefined,
    })
  }

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: realClipboard,
    })
  })

  it('剪贴板 API 可用时原样返回文本', async () => {
    stubClipboard(vi.fn().mockResolvedValue('aa:bb:cc:dd:ee:ff'))

    await expect(readText()).resolves.toBe('aa:bb:cc:dd:ee:ff')
  })

  it('剪贴板 API 不可用时返回 null', async () => {
    stubClipboard(undefined)

    await expect(readText()).resolves.toBeNull()
  })

  it('剪贴板 API 拒绝时返回 null', async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error('denied')))

    await expect(readText()).resolves.toBeNull()
  })
})
