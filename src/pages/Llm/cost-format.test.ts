import { describe, expect, it } from 'vitest'
import { formatCny } from './cost-format'

describe('formatCny 金额格式化', () => {
  it('null 渲染「—」，不能当 0', () => {
    expect(formatCny(null)).toBe('—')
  })

  it('|v| >= 1 保留两位小数', () => {
    expect(formatCny(1)).toBe('¥1.00')
    expect(formatCny(12.345)).toBe('¥12.35')
    expect(formatCny(100)).toBe('¥100.00')
  })

  it('|v| < 1 保留四位小数，避免小额被抹成 0.00', () => {
    expect(formatCny(0)).toBe('¥0.0000')
    expect(formatCny(0.0123)).toBe('¥0.0123')
    expect(formatCny(0.9999)).toBe('¥0.9999')
  })

  it('负数保留负号，且按绝对值决定小数位', () => {
    expect(formatCny(-1)).toBe('¥-1.00')
    expect(formatCny(-0.5)).toBe('¥-0.5000')
    expect(formatCny(-1234.5)).toBe('¥-1234.50')
  })
})
