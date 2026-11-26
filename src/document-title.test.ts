import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('index.html 文档标题', () => {
  it('浏览器页签展示 Deda Dashboard', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')

    expect(html).toMatch(/<title>Deda Dashboard<\/title>/)
  })
})
