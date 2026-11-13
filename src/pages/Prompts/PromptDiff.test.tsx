import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import PromptDiff from './PromptDiff'
import { diffLines } from './diff'

describe('PromptDiff', () => {
  it('两侧都空时给明确提示，不渲染空框', () => {
    render(<PromptDiff lines={diffLines('', '')} />)

    expect(screen.getByTestId('diff-empty')).toHaveTextContent('两侧正文都为空')
    expect(screen.queryByTestId('prompt-diff')).not.toBeInTheDocument()
  })

  it('无变化时说明「两侧一致」，不显示 +0 / -0 这种噪音', () => {
    render(<PromptDiff lines={diffLines('a\nb', 'a\nb')} />)

    expect(screen.getByTestId('diff-stat')).toHaveTextContent(
      '两侧正文一致（2 行）',
    )
  })

  it('有变化时给出增删行数，并逐行标记类型', () => {
    const { container } = render(
      <PromptDiff lines={diffLines('a\nb\nc', 'a\nB\nc\nd')} />,
    )

    expect(screen.getByTestId('diff-stat')).toHaveTextContent(
      '+2 行 / -1 行，未变 2 行',
    )
    const rows = container.querySelectorAll('[data-type]')
    expect([...rows].map((r) => r.getAttribute('data-type'))).toEqual([
      'same',
      'del',
      'add',
      'same',
      'add',
    ])
  })

  it('原样展示 {{变量}} 占位符与中文标点，不做转义或插值', () => {
    render(
      <PromptDiff lines={diffLines('', '孩子叫 {{childName}}，要温柔。')} />,
    )

    expect(screen.getByText('孩子叫 {{childName}}，要温柔。')).toBeInTheDocument()
  })

  it('行号栏同时给出原文行号与新文行号，删除行新行号为空', () => {
    const { container } = render(<PromptDiff lines={diffLines('a\nb', 'a')} />)

    const delRow = container.querySelector('[data-type="del"]')
    expect(delRow?.textContent).toContain('2')
    expect(delRow?.textContent).toContain('b')
  })
})
