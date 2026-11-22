import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useAnalyticsMeta } from '../../api/meta'
import OpsGate from './OpsGate'

vi.mock('../../api/meta', () => ({
  useAnalyticsMeta: vi.fn(),
}))

const mockMeta = useAnalyticsMeta as unknown as ReturnType<typeof vi.fn>

function metaState(
  state: 'pending' | 'error' | 'superadmin' | 'admin' | 'legacy',
) {
  const base = {
    nodeEnv: 'staging',
    promptWriteEnabled: true,
    publishConfirmCode: 'DEDA2025',
  }
  if (state === 'pending') {
    mockMeta.mockReturnValue({ data: undefined, isPending: true, isError: false })
  } else if (state === 'error') {
    mockMeta.mockReturnValue({ data: undefined, isPending: false, isError: true })
  } else if (state === 'superadmin') {
    mockMeta.mockReturnValue({
      data: {
        ...base,
        admin: { username: 'superadmin', displayName: '超管', role: 'superadmin' },
      },
      isPending: false,
      isError: false,
    })
  } else if (state === 'admin') {
    mockMeta.mockReturnValue({
      data: {
        ...base,
        admin: { username: 'ops', displayName: '运营', role: 'admin' },
      },
      isPending: false,
      isError: false,
    })
  } else {
    mockMeta.mockReturnValue({ data: base, isPending: false, isError: false })
  }
}

const child = () => <div data-testid="ops-child">真实页面</div>

function renderGate() {
  return render(
    <OpsGate title="提示词管理" description="线上 prompt 的草稿与发布">
      {child()}
    </OpsGate>,
  )
}

/**
 * 运维组的路由级闸口。
 *
 * 最关键的一条不是文案，而是「受限时 children 一次都不挂载」：Prompt / LLM 页面
 * 一挂载就会并发打出十几个请求，admin 进来只会看到一片 403，还会污染监控与日志。
 */
describe('OpsGate', () => {
  it('superadmin 直接渲染真实页面，不出雾', () => {
    metaState('superadmin')
    renderGate()

    expect(screen.getByTestId('ops-child')).toBeInTheDocument()
    expect(screen.queryByTestId('ops-fog')).toBeNull()
  })

  it('普通 admin 看到雾与原因，真实页面不挂载', () => {
    metaState('admin')
    renderGate()

    expect(screen.queryByTestId('ops-child')).toBeNull()
    expect(screen.getByTestId('ops-fog')).toBeInTheDocument()
    expect(screen.getByText(/仅超级管理员可访问/)).toBeInTheDocument()
    // 原因必须点名账号与角色，否则运营不知道该找谁
    expect(screen.getByText(/ops/)).toBeInTheDocument()
    expect(screen.getByText(/superadmin/)).toBeInTheDocument()
    // 标题仍然显示，admin 知道自己点进了哪个 tab
    expect(screen.getByText('提示词管理')).toBeInTheDocument()
  })

  it('meta 加载中：显示确认中，不渲染真实页面', () => {
    metaState('pending')
    renderGate()

    expect(screen.queryByTestId('ops-child')).toBeNull()
    expect(screen.getByText(/正在确认账号权限/)).toBeInTheDocument()
  })

  it('meta 失败：按无权限处理（fail-closed），不渲染真实页面', () => {
    metaState('error')
    renderGate()

    expect(screen.queryByTestId('ops-child')).toBeNull()
    expect(screen.getByText(/无法确认账号权限/)).toBeInTheDocument()
  })

  it('老后端没有 admin 块：按普通管理员处理', () => {
    metaState('legacy')
    renderGate()

    expect(screen.queryByTestId('ops-child')).toBeNull()
    expect(screen.getByTestId('ops-fog')).toBeInTheDocument()
  })
})
