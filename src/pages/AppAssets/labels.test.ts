import { describe, expect, it } from 'vitest'
import {
  assetStatusLabel,
  formatBytes,
  formatDims,
  formatTime,
} from './labels'

describe('素材展示口径', () => {
  it('状态标签三态齐全', () => {
    expect(assetStatusLabel('published')).toEqual({
      text: '已发布',
      color: 'green',
    })
    expect(assetStatusLabel('draft')).toEqual({ text: '草稿', color: 'gold' })
    expect(assetStatusLabel('archived')).toEqual({
      text: '已下架',
      color: 'default',
    })
  })

  it('文件大小按 B / KB / MB 分级，KB、MB 保留一位小数', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1023)).toBe('1023 B')
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(2 * 1024 * 1024)).toBe('2.0 MB')
  })

  it('尺寸用 × 连接宽高', () => {
    expect(formatDims(800, 600)).toBe('800 × 600')
  })

  it('时间为 ISO 串时格式化成 YYYY-MM-DD HH:mm，空值回退为 —', () => {
    // 不硬编码钟点：换时区断言格式而非具体时刻
    expect(formatTime('2026-11-25T10:30:00+08:00')).toMatch(
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/,
    )
    expect(formatTime(null)).toBe('—')
  })
})
