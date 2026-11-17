import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import EnvTag from './EnvTag'

/**
 * 组件只考核渲染口径；环境判定本身在 env.test.ts。
 * 重点是 fail-closed 的两个态（请求中 / 请求失败）都不许退回上一个已知值。
 */
describe('EnvTag 组件', () => {
  it.each([
    ['development', '本地', 'local'],
    ['staging', '测试', 'staging'],
    ['production', '生产', 'production'],
  ] as const)('nodeEnv=%s 渲染「%s」', (nodeEnv, text, tone) => {
    render(<EnvTag nodeEnv={nodeEnv} />)

    const tag = screen.getByTestId('env-tag')
    expect(tag).toHaveTextContent(text)
    expect(tag.getAttribute('data-tone')).toBe(tone)
  })

  it('生产标签加粗，其余不加粗', () => {
    const { unmount } = render(<EnvTag nodeEnv="production" />)
    expect(screen.getByTestId('env-tag')).toHaveStyle('font-weight: 700')
    unmount()

    render(<EnvTag nodeEnv="staging" />)
    expect(screen.getByTestId('env-tag')).toHaveStyle('font-weight: 400')
  })

  it('请求中：显示「环境识别中」且按未知环境处理（fail-closed）', () => {
    render(<EnvTag loading />)

    const tag = screen.getByTestId('env-tag')
    expect(tag).toHaveTextContent('环境识别中')
    expect(tag.getAttribute('data-tone')).toBe('unknown')
  })

  it('请求失败：显示「未知环境」，不退回上一个已知值', () => {
    render(<EnvTag nodeEnv="production" failed />)

    const tag = screen.getByTestId('env-tag')
    expect(tag).toHaveTextContent('未知环境')
    expect(tag.getAttribute('data-tone')).toBe('unknown')
  })

  it('没传 nodeEnv 也是「未知环境」，不渲染空标签', () => {
    render(<EnvTag />)

    expect(screen.getByTestId('env-tag')).toHaveTextContent('未知环境')
  })
})
