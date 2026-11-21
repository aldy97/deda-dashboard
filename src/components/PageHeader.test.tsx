import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import PageHeader from './PageHeader'

/**
 * 全站统一页面头部的渲染契约：标题永远 level 4、描述与操作都是可选插槽。
 * 目的不是复述 antd 的渲染，而是钉住「哪些是必填、哪些是可空」，
 * 避免某个页面漏传描述或操作导致结构漂移。
 */
describe('PageHeader 组件', () => {
  it('渲染 level 4 标题', () => {
    render(<PageHeader title="设备舰队" />)
    expect(
      screen.getByRole('heading', { level: 4, name: '设备舰队' }),
    ).toBeInTheDocument()
  })

  it('有描述时渲染描述', () => {
    render(<PageHeader title="标题" description="这是描述" />)
    expect(screen.getByText('这是描述')).toBeInTheDocument()
  })

  it('无描述时不渲染描述节点', () => {
    render(<PageHeader title="标题" />)
    const heading = screen.getByRole('heading', { level: 4 })
    // 描述文本应该完全不存在
    expect(screen.queryByText('这是描述')).not.toBeInTheDocument()
    expect(heading).toBeInTheDocument()
  })

  it('有 actions 时渲染操作区', () => {
    render(<PageHeader title="标题" actions={<button type="button">刷新</button>} />)
    expect(screen.getByRole('button', { name: '刷新' })).toBeInTheDocument()
  })

  it('无 actions 时不渲染操作区', () => {
    render(<PageHeader title="标题" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
