import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Retention from './index'
import {
  useActivationFunnel,
  useRetentionCohorts,
  useRetentionCurve,
} from '../../api/queries'

vi.mock('../../api/queries', () => ({
  useRetentionCohorts: vi.fn(),
  useRetentionCurve: vi.fn(),
  useActivationFunnel: vi.fn(),
}))

const mockCohorts = useRetentionCohorts as unknown as ReturnType<typeof vi.fn>
const mockCurve = useRetentionCurve as unknown as ReturnType<typeof vi.fn>
const mockFunnel = useActivationFunnel as unknown as ReturnType<typeof vi.fn>

function idle(overrides: Record<string, unknown> = {}) {
  return {
    data: undefined,
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <Retention />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCohorts.mockReturnValue(idle())
  mockCurve.mockReturnValue(idle())
  mockFunnel.mockReturnValue(idle())
})

describe('留存与激活 · 页面刷新', () => {
  it('Header 右侧刷新按钮同时刷新三组查询', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /刷\s*新/ }))

    expect(mockCohorts.mock.results[0].value.refetch).toHaveBeenCalledTimes(1)
    expect(mockCurve.mock.results[0].value.refetch).toHaveBeenCalledTimes(1)
    expect(mockFunnel.mock.results[0].value.refetch).toHaveBeenCalledTimes(1)
  })

  it('任一查询在飞时刷新按钮显示 loading', () => {
    mockCohorts.mockReturnValue(idle({ isFetching: true }))
    renderPage()

    expect(
      screen.getByRole('button', { name: /刷\s*新/ }).className,
    ).toContain('ant-btn-loading')
  })
})
