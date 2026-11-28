import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import AccessLink from './AccessLink'
import type { LinkHintTarget } from './link-hints'

const mockUseAnalyticsMeta = vi.fn()
vi.mock('../../api/meta', () => ({
  useAnalyticsMeta: () => mockUseAnalyticsMeta(),
}))

function renderLink(
  props: {
    to?: string
    hint?: LinkHintTarget
    detail?: string
    carries?: readonly string[]
    arrow?: boolean
    children?: ReactNode
    meta?: unknown
    className?: string
    style?: React.CSSProperties
    title?: string
    onClick?: (e: React.MouseEvent) => void
  } = {},
) {
  const { meta, ...linkProps } = props
  if (meta !== undefined) {
    mockUseAnalyticsMeta.mockReturnValue(meta)
  }
  return render(
    <MemoryRouter>
      <AccessLink
        to={linkProps.to ?? '/users/dev-1'}
        hint={linkProps.hint ?? 'device-profile'}
        detail={linkProps.detail}
        carries={linkProps.carries}
        arrow={linkProps.arrow}
        style={linkProps.style}
        title={linkProps.title}
        onClick={linkProps.onClick}
        data-testid="target"
      >
        {linkProps.children ?? 'dev-1'}
      </AccessLink>
    </MemoryRouter>,
  )
}

const SUPERADMIN = {
  data: { admin: { role: 'superadmin' } },
  isPending: false,
  isError: false,
}
const RESTRICTED = {
  data: { admin: { role: 'admin' } },
  isPending: false,
  isError: false,
}

describe('AccessLink · 非专属目标', () => {
  beforeEach(() => {
    mockUseAnalyticsMeta.mockReset()
  })

  it('渲染正常链接，不订阅 meta（无 QueryClientProvider 也能用）', () => {
    mockUseAnalyticsMeta.mockImplementation(() => {
      throw new Error('非专属目标不应读取权限')
    })

    renderLink()

    const link = screen.getByTestId('target')
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('href', '/users/dev-1')
    expect(link).toHaveAttribute('data-hint', 'device-profile')
    expect(mockUseAnalyticsMeta).not.toHaveBeenCalled()
  })

  it('悬停显示目的地；原生 title 合并进提示并移除双浮层', async () => {
    const user = userEvent.setup()
    renderLink({ title: 'dev-1-full', carries: ['deviceId'] })

    const link = screen.getByTestId('target')
    expect(link).not.toHaveAttribute('title')
    await user.hover(link)

    expect(
      await screen.findByText(
        '点击前往「设备档案」，会带上 deviceId（dev-1-full）',
      ),
    ).toBeInTheDocument()
  })

  it('透传 onClick / style / data-testid', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn((e: React.MouseEvent) => e.stopPropagation())
    renderLink({ onClick, style: { fontFamily: 'monospace' } })

    const link = screen.getByTestId('target')
    expect(link.style.fontFamily).toBe('monospace')
    await user.click(link)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe('AccessLink · 超管专属目标', () => {
  beforeEach(() => {
    mockUseAnalyticsMeta.mockReset()
  })

  it('superadmin：渲染链接、箭头与「超级管理员专属」提示', async () => {
    const user = userEvent.setup()
    renderLink({
      to: '/prompts?scene=daily_chat',
      hint: 'prompts',
      detail: '该场景',
      arrow: true,
      children: '日常闲聊',
      meta: SUPERADMIN,
    })

    const link = screen.getByTestId('target')
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('href', '/prompts?scene=daily_chat')
    expect(link.textContent).toBe('日常闲聊 →')

    await user.hover(link)
    expect(
      await screen.findByText(
        '点击前往「提示词管理 · 该场景」（超级管理员专属）',
      ),
    ).toBeInTheDocument()
  })

  it('普通 admin：退化为灰色纯文本，无链接、无箭头、无提示', async () => {
    const user = userEvent.setup()
    renderLink({
      to: '/prompts?scene=daily_chat',
      hint: 'prompts',
      arrow: true,
      children: '日常闲聊',
      meta: RESTRICTED,
    })

    const text = screen.getByTestId('target')
    expect(text.tagName).toBe('SPAN')
    expect(text).not.toHaveAttribute('href')
    expect(text).toHaveAttribute('data-access', 'restricted')
    expect(text.textContent).toBe('日常闲聊')
    expect(text.style.color).toBe('rgba(0, 0, 0, 0.45)')

    await user.hover(text)
    await waitFor(() =>
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument(),
    )
  })

  it('meta 未就绪：同样按纯文本渲染（fail-closed）', () => {
    renderLink({
      to: '/llm?tab=perf',
      hint: 'llm-perf',
      children: '模型监控',
      meta: { data: undefined, isPending: true, isError: false },
    })

    const text = screen.getByTestId('target')
    expect(text.tagName).toBe('SPAN')
    expect(text).toHaveAttribute('data-access', 'restricted')
  })

  it('meta 失败：按无权限处理，不渲染死链', () => {
    renderLink({
      to: '/llm?tab=perf',
      hint: 'llm-perf',
      children: '模型监控',
      meta: { data: undefined, isPending: false, isError: true },
    })

    expect(screen.getByTestId('target').tagName).toBe('SPAN')
  })

  it('普通 admin 保留原生 title（截断值仍可看全）', () => {
    renderLink({
      to: '/prompts?key=persona_elly',
      hint: 'prompts',
      children: 'elly',
      meta: RESTRICTED,
      title: 'elly-full',
    })

    expect(screen.getByTestId('target')).toHaveAttribute('title', 'elly-full')
  })
})
