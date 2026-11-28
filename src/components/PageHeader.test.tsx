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

/**
 * 响应式骨架：间距与换行规则放 index.css 的 .page-header / .page-header-actions，
 * 组件只负责挂对 class。jsdom 不计算布局，测的是「哪个节点挂了哪个钩子」。
 */
describe('PageHeader 响应式骨架', () => {
  it('根节点与操作区挂全局 class，操作区包住 actions', () => {
    const { container } = render(
      <PageHeader
        title="标题"
        description="描述"
        actions={<button type="button">刷新</button>}
      />,
    )

    const root = container.firstElementChild as HTMLElement
    expect(root).toHaveClass('page-header')
    const actions = root.querySelector('.page-header-actions')
    expect(actions).not.toBeNull()
    expect(actions).toContainElement(
      screen.getByRole('button', { name: '刷新' }),
    )
  })

  it('标题容器允许收缩，长描述不会把标题顶成竖排', () => {
    const { container } = render(
      <PageHeader title="标题" description={'很长的说明'.repeat(60)} />,
    )

    expect(container.querySelector('.page-header-title')).toHaveStyle(
      'min-width: 0',
    )
  })

  it('无 actions 时不渲染空的操作区容器', () => {
    const { container } = render(<PageHeader title="标题" />)
    expect(container.querySelector('.page-header-actions')).toBeNull()
  })
})
