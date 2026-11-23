import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import SegmentDiffList from './SegmentDiffList'
import type { SegmentDiff } from '../../types/adventureAdmin'

function diff(overrides: Partial<SegmentDiff> = {}): SegmentDiff {
  return { order: 0, change: 'added', ...overrides }
}

describe('SegmentDiffList', () => {
  it('没有差异时显示默认空态文案', () => {
    render(<SegmentDiffList diffs={[]} />)
    expect(screen.getByText('两个版本逐段一致，没有任何差异')).toBeInTheDocument()
  })

  it('支持自定义空态文案（导入预览用「逐段一致」）', () => {
    render(<SegmentDiffList diffs={[]} emptyText="逐段一致" />)
    expect(screen.getByText('逐段一致')).toBeInTheDocument()
  })

  it('新增段显示段号与新增内容，字段名翻译成中文', () => {
    render(
      <SegmentDiffList
        diffs={[
          diff({
            order: 2,
            change: 'added',
            field: 'text',
            after: '新加的一段旁白',
          }),
        ]}
      />,
    )
    expect(screen.getByText('新增段')).toBeInTheDocument()
    expect(screen.getByText('#2')).toBeInTheDocument()
    expect(screen.getByText('文本')).toBeInTheDocument()
    expect(screen.getByText('新加的一段旁白')).toBeInTheDocument()
  })

  it('删除段只渲染改动前的内容，对象值兜底成 JSON', () => {
    render(
      <SegmentDiffList
        diffs={[
          diff({
            order: 1,
            change: 'removed',
            field: 'options',
            before: { choices: [{ text: '往左' }] },
          }),
        ]}
      />,
    )
    expect(screen.getByText('删除段')).toBeInTheDocument()
    expect(screen.getByText('选项 / 接话')).toBeInTheDocument()
    expect(
      screen.getByText('{"choices":[{"text":"往左"}]}'),
    ).toBeInTheDocument()
  })

  it('修改段并排显示前后值，null / 空串 / 布尔各有可读兜底', () => {
    render(
      <SegmentDiffList
        diffs={[
          diff({
            order: 3,
            change: 'modified',
            field: 'text',
            before: null,
            after: '',
          }),
          diff({
            order: 4,
            change: 'modified',
            field: 'rewardStar',
            before: true,
            after: false,
          }),
          diff({
            order: 5,
            change: 'modified',
            field: 'fallbackText',
            before: '旧兜底',
            after: '新兜底',
          }),
        ]}
      />,
    )
    expect(screen.getAllByText('修改')).toHaveLength(3)
    expect(screen.getByText('（空）')).toBeInTheDocument()
    expect(screen.getByText('（空字符串）')).toBeInTheDocument()
    expect(screen.getByText('是')).toBeInTheDocument()
    expect(screen.getByText('否')).toBeInTheDocument()
    expect(screen.getByText('奖励星光')).toBeInTheDocument()
    expect(screen.getByText('旧兜底')).toBeInTheDocument()
    expect(screen.getByText('新兜底')).toBeInTheDocument()
  })

  it('未知字段与未知变更类型原样透出，不静默吞掉服务端新值', () => {
    render(
      <SegmentDiffList
        diffs={[
          diff({
            order: 6,
            change: 'renamed' as SegmentDiff['change'],
            field: 'brandNewField',
            after: 42,
          }),
        ]}
      />,
    )
    expect(screen.getByText('renamed')).toBeInTheDocument()
    expect(screen.getByText('brandNewField')).toBeInTheDocument()
  })

  it('跨段差异按 order 顺序全部列出', () => {
    render(
      <SegmentDiffList
        diffs={[
          diff({ order: 0, change: 'added', after: '第一段' }),
          diff({ order: 1, change: 'removed', before: '第二段' }),
        ]}
      />,
    )
    expect(screen.getByText('第一段')).toBeInTheDocument()
    expect(screen.getByText('第二段')).toBeInTheDocument()
  })
})
