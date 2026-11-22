import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import DocxFormatHint from './DocxFormatHint'

describe('DocxFormatHint', () => {
  it('把四种交互点的标注格式都摊开给创作者', () => {
    render(<DocxFormatHint />)

    expect(screen.getByText(/正文第一个非空行 = 这一集的标题/)).toBeTruthy()
    expect(screen.getByText('【互动·二选一】引导词')).toBeTruthy()
    expect(screen.getByText('【互动·开放问答】引导词')).toBeTruthy()
    expect(screen.getByText('【互动·跟我念】要念的句子')).toBeTruthy()
    expect(screen.getByText('【互动·奖励】引导词')).toBeTruthy()
    expect(screen.getByText(/这一整段过完发一颗星，不需要兜底/)).toBeTruthy()
  })
})
