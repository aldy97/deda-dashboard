import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { setViewportWidth } from '../test/viewport'
import { useLayoutMode } from './use-layout-mode'

function Probe() {
  const mode = useLayoutMode()
  return <span data-testid="mode">{mode}</span>
}

/**
 * 三档布局口径（与 antd 默认断点对齐）：
 * mobile <768、tablet 768–991、desktop ≥992。
 * 这里只钉口径本身；壳层行为在 AdminLayout.test.tsx 里测。
 */
describe('useLayoutMode 断点口径', () => {
  it('默认 1280 是 desktop', () => {
    render(<Probe />)
    expect(screen.getByTestId('mode')).toHaveTextContent('desktop')
  })

  it('900 是 tablet（Sider 收起档）', () => {
    act(() => setViewportWidth(900))
    render(<Probe />)
    expect(screen.getByTestId('mode')).toHaveTextContent('tablet')
  })

  it('375 是 mobile', () => {
    act(() => setViewportWidth(375))
    render(<Probe />)
    expect(screen.getByTestId('mode')).toHaveTextContent('mobile')
  })

  it('运行中改变宽度会切换档位，不需要重新挂载', () => {
    render(<Probe />)
    expect(screen.getByTestId('mode')).toHaveTextContent('desktop')

    act(() => setViewportWidth(375))
    expect(screen.getByTestId('mode')).toHaveTextContent('mobile')

    act(() => setViewportWidth(900))
    expect(screen.getByTestId('mode')).toHaveTextContent('tablet')

    act(() => setViewportWidth(1280))
    expect(screen.getByTestId('mode')).toHaveTextContent('desktop')
  })

  it('767 与 768 的分界：落在 768 就是 tablet', () => {
    act(() => setViewportWidth(767))
    render(<Probe />)
    expect(screen.getByTestId('mode')).toHaveTextContent('mobile')

    act(() => setViewportWidth(768))
    expect(screen.getByTestId('mode')).toHaveTextContent('tablet')
  })
})
