import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CopyableText from './CopyableText'
import { stubClipboard } from '../test/clipboard'

describe('CopyableText', () => {
  it('只渲染图标时，按钮可访问名是复制提示', () => {
    render(<CopyableText text="dev-1" tip="复制设备 ID" />)

    expect(
      screen.getByRole('button', { name: '复制设备 ID' }),
    ).toBeInTheDocument()
  })

  it('传 children 时文本与复制图标一起渲染', () => {
    render(
      <CopyableText text="dev-1" tip="复制设备 ID">
        {'dev-1'}
      </CopyableText>,
    )

    expect(screen.getByText('dev-1')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '复制设备 ID' }),
    ).toBeInTheDocument()
  })

  it('未传 tip 时默认提示「复制」', () => {
    render(<CopyableText text="x" />)

    expect(screen.getByRole('button', { name: '复制' })).toBeInTheDocument()
  })

  it('点击把 text 原样写入剪贴板，按钮提示切到「已复制」', async () => {
    const writeText = stubClipboard()

    render(<CopyableText text="dev-123" tip="复制设备 ID" />)
    await userEvent.click(
      screen.getByRole('button', { name: '复制设备 ID' }),
    )

    expect(writeText).toHaveBeenCalledWith('dev-123')
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '已复制' })).toBeInTheDocument(),
    )
  })
})
