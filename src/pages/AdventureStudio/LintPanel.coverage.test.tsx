import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import LintPanel from './LintPanel'
import type { LintIssue, LintReport } from '../../types/adventureAdmin'

function issue(overrides: Partial<LintIssue> = {}): LintIssue {
  return {
    severity: 'error',
    code: 'TEXT_TOO_LONG',
    message: '旁白超长',
    businessKey: 'elly/1/1',
    ...overrides,
  }
}

function report(errors: LintIssue[], warnings: LintIssue[]): LintReport {
  return { ok: errors.length === 0, issues: [...errors, ...warnings], errors, warnings }
}

describe('LintPanel', () => {
  it('没有报告时什么都不渲染', () => {
    const { container } = render(<LintPanel report={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('无阻断项也无提醒项时给一条通过提示', () => {
    render(<LintPanel report={report([], [])} title="校验结果" />)
    expect(screen.getByText('校验结果')).toBeTruthy()
    expect(screen.getByText('校验通过，没有阻断项也没有提醒项')).toBeTruthy()
  })

  it('只有提醒项时说明不影响发布，并接上自定义补充说明', () => {
    render(
      <LintPanel
        report={report([], [issue({ severity: 'warning', code: 'FORBIDDEN_WORD', message: '注意禁用词' })])}
        warningsNote="（草稿标准，发布时会重算）"
      />,
    )
    expect(screen.getByText('没有阻断项，可以发布')).toBeTruthy()
    expect(screen.getByText('1 条提醒（草稿标准，发布时会重算）')).toBeTruthy()
    expect(screen.getByText('注意禁用词')).toBeTruthy()
  })

  it('提醒项未传补充说明时用默认「不影响发布」', () => {
    render(
      <LintPanel
        report={report([], [issue({ severity: 'warning', message: '小提醒' })])}
      />,
    )
    expect(screen.getByText('1 条提醒（不影响发布）')).toBeTruthy()
  })

  it('有阻断项时列出条数与每一条的定位：path 优先、其次段号', () => {
    render(
      <LintPanel
        report={report(
          [
            issue({
              code: 'CHOICE_MISSING_REPLY',
              message: '选项缺接话',
              path: 'segments[1].options.choices[0].text',
            }),
            issue({ code: 'NO_SEGMENTS', message: '一集没有任何段落' }),
            issue({
              code: 'SEGMENT_ORDER',
              message: '段号断档',
              segmentOrder: 2,
            }),
          ],
          [],
        )}
      />,
    )

    expect(screen.getByText('3 个阻断项，全部修掉才能发布')).toBeTruthy()
    expect(screen.getByText('选项缺接话')).toBeTruthy()
    expect(screen.getByText('@ segments[1].options.choices[0].text')).toBeTruthy()
    expect(screen.getByText('一集没有任何段落')).toBeTruthy()
    expect(screen.getByText('段号断档')).toBeTruthy()
    expect(screen.getByText('@ segments[2]')).toBeTruthy()
  })

  it('标记过期时结论保留，并解释为什么还在屏幕上', () => {
    render(<LintPanel report={report([], [])} stale />)
    expect(
      screen.getByText('这份校验结果已经对不上屏幕上的内容了'),
    ).toBeTruthy()
    expect(screen.getByText(/点「校验」按当前内容重新算一次/)).toBeTruthy()
  })

  it('不传标题时不渲染标题行', () => {
    render(<LintPanel report={report([], [])} />)
    expect(screen.queryByText('校验结果')).toBeNull()
  })
})
