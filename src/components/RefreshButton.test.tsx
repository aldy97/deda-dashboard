import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RefreshButton from './RefreshButton'

/**
 * 全站统一「刷新」按钮的渲染契约：点击回调与 loading 透传。
 * antd 两字按钮的可访问名会被插空格（「刷 新」），所以用正则匹配。
 */
describe('RefreshButton 组件', () => {
  it('点击触发 onClick', async () => {
    const onClick = vi.fn()
    render(<RefreshButton onClick={onClick} />)

    await userEvent.click(screen.getByRole('button', { name: /刷\s*新/ }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('loading 透传给按钮进入加载态', () => {
    render(<RefreshButton loading />)
    expect(screen.getByRole('button', { name: /刷\s*新/ })).toHaveClass(
      'ant-btn-loading',
    )
  })

  it('未传 loading 时按钮非加载态', () => {
    render(<RefreshButton />)
    expect(screen.getByRole('button', { name: /刷\s*新/ })).not.toHaveClass(
      'ant-btn-loading',
    )
  })
})
