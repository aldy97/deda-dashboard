import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import LlmMonitor from './index'

// 四个 tab 各自有独立测试；这里替身掉，只验证「挂载哪一个」与 URL 同步
vi.mock('./tabs/PerfTab', () => ({
  default: () => <div data-testid="perf-tab" />,
}))
vi.mock('./tabs/CostTab', () => ({
  default: () => <div data-testid="cost-tab" />,
}))
vi.mock('./tabs/SafetyTab', () => ({
  default: () => <div data-testid="safety-tab" />,
}))
vi.mock('./tabs/IntentTab', () => ({
  default: () => <div data-testid="intent-tab" />,
}))

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location-search">{location.search}</div>
}

function renderAt(entry = '/llm') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <LocationProbe />
      <LlmMonitor />
    </MemoryRouter>,
  )
}

const TAB_TESTIDS = ['perf-tab', 'cost-tab', 'safety-tab', 'intent-tab'] as const

function mountedTabs(): string[] {
  return TAB_TESTIDS.filter((id) => screen.queryByTestId(id) !== null)
}

describe('LlmMonitor 四个 tab', () => {
  it('性能 / 价格 / 安全 / 意图四个 tab 都在，且不新开路由', () => {
    renderAt()

    expect(screen.getByRole('tab', { name: '性能监控' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '价格监控' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '安全监控' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '意图监控' })).toBeInTheDocument()
  })

  it('默认落在性能监控，其余三个不挂载（避免一进页面并发打十几个接口）', () => {
    renderAt()

    expect(mountedTabs()).toEqual(['perf-tab'])
  })

  it.each([
    ['cost', 'cost-tab'],
    ['safety', 'safety-tab'],
    ['intent', 'intent-tab'],
    ['perf', 'perf-tab'],
  ])('?tab=%s 只挂载对应 tab', (tab, testId) => {
    renderAt(`/llm?tab=${tab}`)

    expect(mountedTabs()).toEqual([testId])
  })

  it('?tab 非法时回退到性能监控，不渲染空白页', () => {
    renderAt('/llm?tab=nonsense')

    expect(mountedTabs()).toEqual(['perf-tab'])
  })

  it('点击 tab 切换挂载内容并把 tab 写进 URL（方便运营分享链接）', async () => {
    const user = userEvent.setup()
    renderAt()

    await user.click(screen.getByRole('tab', { name: '安全监控' }))
    expect(mountedTabs()).toEqual(['safety-tab'])
    expect(screen.getByTestId('location-search').textContent).toBe('?tab=safety')

    await user.click(screen.getByRole('tab', { name: '意图监控' }))
    expect(mountedTabs()).toEqual(['intent-tab'])
    expect(screen.getByTestId('location-search').textContent).toBe('?tab=intent')

    await user.click(screen.getByRole('tab', { name: '性能监控' }))
    expect(mountedTabs()).toEqual(['perf-tab'])
    expect(screen.getByTestId('location-search').textContent).toBe('?tab=perf')
  })

  it('保留页面标题与副标题', () => {
    renderAt()

    expect(screen.getByText('模型监控')).toBeInTheDocument()
    expect(screen.getByText(/首包时间仅流式场景有值/)).toBeInTheDocument()
  })

  it('标题下给出四个 tab 的分工说明，避免运营走错页', () => {
    renderAt()

    expect(screen.getByText(/调用健康度/)).toBeInTheDocument()
    expect(screen.getByText(/判定可信度/)).toBeInTheDocument()
  })
})
