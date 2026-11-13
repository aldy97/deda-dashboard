import { describe, expect, it } from 'vitest'
import { diffLines, diffStat, isSameContent } from './diff'

describe('diffLines', () => {
  it('完全一致：全部 same，行号一一对应', () => {
    const lines = diffLines('a\nb\nc', 'a\nb\nc')

    expect(lines.map((l) => l.type)).toEqual(['same', 'same', 'same'])
    expect(lines[1]).toEqual({ type: 'same', oldNo: 2, newNo: 2, text: 'b' })
  })

  it('末尾换行不算改动（服务端正文常带一个换行结尾）', () => {
    expect(isSameContent('a\nb\n', 'a\nb')).toBe(true)
    expect(diffStat(diffLines('a\nb\n', 'a\nb'))).toEqual({
      added: 0,
      removed: 0,
      unchanged: 2,
    })
  })

  it('新增一行：标 add，oldNo 为 null，后续行号各自递进', () => {
    const lines = diffLines('a\nc', 'a\nb\nc')

    expect(lines.map((l) => [l.type, l.text])).toEqual([
      ['same', 'a'],
      ['add', 'b'],
      ['same', 'c'],
    ])
    expect(lines[1]).toEqual({ type: 'add', oldNo: null, newNo: 2, text: 'b' })
    expect(lines[2]).toEqual({ type: 'same', oldNo: 2, newNo: 3, text: 'c' })
  })

  it('删除一行：标 del，newNo 为 null', () => {
    const lines = diffLines('a\nb\nc', 'a\nc')

    expect(lines.map((l) => [l.type, l.text])).toEqual([
      ['same', 'a'],
      ['del', 'b'],
      ['same', 'c'],
    ])
    expect(lines[1]).toEqual({ type: 'del', oldNo: 2, newNo: null, text: 'b' })
  })

  it('改一行：先 del 旧行再 add 新行，不吞掉上下文', () => {
    const lines = diffLines('你是小象 Elly。\n要温柔。', '你是小象 Elly！\n要温柔。')

    expect(lines.map((l) => l.type)).toEqual(['del', 'add', 'same'])
    expect(lines[0].text).toBe('你是小象 Elly。')
    expect(lines[1].text).toBe('你是小象 Elly！')
    expect(diffStat(lines)).toEqual({ added: 1, removed: 1, unchanged: 1 })
  })

  it('从空到有：全部 add；从有到空：全部 del', () => {
    expect(diffLines('', 'a\nb').map((l) => l.type)).toEqual(['add', 'add'])
    expect(diffLines('a\nb', '').map((l) => l.type)).toEqual(['del', 'del'])
    expect(diffLines('', '')).toEqual([])
  })

  it('只有末尾空行差异时不当成改动，但中间空行算内容', () => {
    expect(diffStat(diffLines('a\n\nb', 'a\n\nb'))).toEqual({
      added: 0,
      removed: 0,
      unchanged: 3,
    })
    expect(diffStat(diffLines('a\nb', 'a\n\nb')).added).toBe(1)
  })

  it('保留 {{变量}} 占位符原样：diff 不做任何插值', () => {
    const lines = diffLines(
      '孩子叫 {{childName}}。',
      '孩子叫 {{childName}}，今年 {{age}} 岁。',
    )

    expect(lines.map((l) => l.type)).toEqual(['del', 'add'])
    expect(lines[1].text).toContain('{{childName}}')
    expect(lines[1].text).toContain('{{age}}')
  })

  it('重复行不会被错配（LCS 而非按行号硬对）', () => {
    const lines = diffLines('x\nx\ny', 'x\ny')

    expect(diffStat(lines)).toEqual({ added: 0, removed: 1, unchanged: 2 })
    expect(lines.filter((l) => l.type === 'same').map((l) => l.text)).toEqual([
      'x',
      'y',
    ])
  })

  it('长文本可用：500 行里改 1 行只报 1 增 1 删', () => {
    const before = Array.from({ length: 500 }, (_, i) => `第 ${i} 行`)
    const after = [...before]
    after[250] = '第 250 行（改过）'

    const stat = diffStat(diffLines(before.join('\n'), after.join('\n')))
    expect(stat).toEqual({ added: 1, removed: 1, unchanged: 499 })
  })
})

describe('isSameContent', () => {
  it('对增删敏感，对末尾换行不敏感', () => {
    expect(isSameContent('a', 'a')).toBe(true)
    expect(isSameContent('a', 'a\n')).toBe(true)
    expect(isSameContent('a', 'b')).toBe(false)
    expect(isSameContent('a', 'a\nb')).toBe(false)
    expect(isSameContent('', '')).toBe(true)
  })
})
