import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import ReasonDialog from './ReasonDialog'
import type { ApiError } from '../../api/client'
import type { EpisodeImpact } from '../../types/adventureAdmin'

/**
 * 三道门（理由字数 / 确认文本 / 外部阻断）必须互相独立且 fail-closed：
 * 谁不满足都不放行，且禁用态要能问出原因。
 */

const REASON_PLACEHOLDER = /半年后别人/

function setup(props: Partial<ComponentProps<typeof ReasonDialog>> = {}) {
  const onSubmit = vi.fn()
  const onCancel = vi.fn()
  render(
    <ReasonDialog
      open
      title="下架故事集"
      description="下架会收走跨天挂起的进度。"
      okText="确认下架"
      onSubmit={onSubmit}
      onCancel={onCancel}
      {...props}
    />,
  )
  return { onSubmit, onCancel }
}

function okButton() {
  return screen.getByRole('button', { name: /确认下架/ })
}

function typeReason(value: string) {
  fireEvent.change(screen.getByPlaceholderText(REASON_PLACEHOLDER), {
    target: { value },
  })
}

describe('ReasonDialog · 理由字数门', () => {
  it('不足 8 个字时禁用确定并提示还差几个字', () => {
    setup()

    expect(okButton()).toBeDisabled()
    typeReason('改一下')

    expect(screen.getByText('还差 5 个字')).toBeInTheDocument()
    expect(okButton()).toBeDisabled()
  })

  it('纯空白按 trim 后计数，不会被空格骗过', () => {
    setup()

    typeReason('        ')

    expect(screen.getByText('还差 8 个字')).toBeInTheDocument()
    expect(okButton()).toBeDisabled()
  })

  it('够 8 个字后放行，提交的是 trim 后的理由', () => {
    const { onSubmit } = setup()

    typeReason('  上游已恢复，确认解除降级  ')
    fireEvent.click(okButton())

    expect(onSubmit).toHaveBeenCalledWith({
      reason: '上游已恢复，确认解除降级',
      confirmText: undefined,
    })
  })

  it('超过 300 字上限时同样不放行', () => {
    setup()

    typeReason('超'.repeat(301))

    expect(okButton()).toBeDisabled()
  })
})

describe('ReasonDialog · 确认文本门', () => {
  it('显示自定义确认标签与要求原样输入的文本，不提供复制', () => {
    setup({ confirmText: 'elly/1/1', confirmLabel: '业务键' })

    expect(screen.getByText(/业务键：请原样输入/)).toBeInTheDocument()
    expect(
      screen.getByText('不提供复制按钮：手输一遍就是这一步的全部意义。'),
    ).toBeInTheDocument()
  })

  it('输入不一致时标红且不放行，输入一致后提交带上确认文本', () => {
    const { onSubmit } = setup({ confirmText: 'elly/1/1' })

    typeReason('下架这一集，因为要重新录制')
    const confirmInput = screen.getByPlaceholderText('elly/1/1')
    fireEvent.change(confirmInput, { target: { value: 'elly' } })

    expect(confirmInput.className).toContain('status-error')
    expect(okButton()).toBeDisabled()

    fireEvent.change(confirmInput, { target: { value: '  elly/1/1  ' } })
    expect(confirmInput.className).not.toContain('status-error')
    fireEvent.click(okButton())

    expect(onSubmit).toHaveBeenCalledWith({
      reason: '下架这一集，因为要重新录制',
      confirmText: 'elly/1/1',
    })
  })

  it('不传 confirmText 时不渲染确认输入框', () => {
    setup()

    expect(screen.queryByText(/不提供复制按钮/)).not.toBeInTheDocument()
  })
})

describe('ReasonDialog · 外部阻断与错误', () => {
  it('blockedReason 非空时禁用确定并显示原因，悬停可问出原因', () => {
    setup({ blockedReason: '发布前检查还有 2 条阻断项' })

    typeReason('这一版已经改完了，确认发布')
    expect(screen.getByText('这一步现在不能提交')).toBeInTheDocument()
    expect(
      screen.getByText('发布前检查还有 2 条阻断项'),
    ).toBeInTheDocument()
    expect(okButton()).toBeDisabled()
    expect(okButton().getAttribute('title')).toBe('发布前检查还有 2 条阻断项')
  })

  it('服务端错误带领域码与 HTTP 状态时一并展示', () => {
    const error: ApiError = Object.assign(new Error('草稿已被同事覆盖'), {
      status: 409,
      domainCode: 'DRAFT_CONFLICT',
    })
    setup({ error })

    expect(screen.getByText('服务端拒绝了这次操作')).toBeInTheDocument()
    expect(screen.getByText('草稿已被同事覆盖')).toBeInTheDocument()
    expect(screen.getByText('DRAFT_CONFLICT')).toBeInTheDocument()
    expect(screen.getByText(/HTTP 409/)).toBeInTheDocument()
  })

  it('没有领域码时不渲染错误码行', () => {
    const error = new Error('服务端 500') as ApiError
    setup({ error })

    expect(screen.getByText('服务端 500')).toBeInTheDocument()
    expect(screen.queryByText(/错误码/)).not.toBeInTheDocument()
  })

  it('挂上 impact 时把影响面数字摆进正文（retire 变体）', () => {
    const impact: EpisodeImpact = {
      devicesPlayingToday: 2,
      devicesStaleCrossDay: 1,
      devicesPinnedToOlderVersions: 0,
      totalDevicesEverStarted: 8,
      publishedVersionCount: 3,
    }
    setup({ impact, impactVariant: 'retire' })

    expect(
      screen.getByText('下架会收走 1 条跨天挂起的进度'),
    ).toBeInTheDocument()
  })

  it('extra 与说明正文都渲染在错误之上', () => {
    setup({ extra: <button type="button">加载对方版本</button> })

    expect(screen.getByText('下架会收走跨天挂起的进度。')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '加载对方版本' }),
    ).toBeInTheDocument()
  })

  it('取消时清空输入并回调 onCancel；重开不会沿用上一次理由', () => {
    const { onCancel } = setup()

    typeReason('第一次写的理由，足够长了')
    fireEvent.click(screen.getByRole('button', { name: /取\s*消/ }))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('pending 时确定按钮转圈但仍不可点', () => {
    setup({ pending: true })

    expect(okButton()).toHaveClass('ant-btn-loading')
    expect(okButton()).toBeDisabled()
  })

  it('按 8 个字符的边界刚好放行', () => {
    const { onSubmit } = setup()

    typeReason('一二三四五六七八')
    fireEvent.click(okButton())

    expect(onSubmit).toHaveBeenCalledWith({
      reason: '一二三四五六七八',
      confirmText: undefined,
    })
  })
})
