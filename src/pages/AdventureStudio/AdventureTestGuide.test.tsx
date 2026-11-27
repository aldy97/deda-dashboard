import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdventureTestGuide from './AdventureTestGuide'
import { useAdventureCapabilities } from '../../api/queries'
import { useAnalyticsMeta } from '../../api/meta'

vi.mock('../../api/queries', () => ({
  useAdventureCapabilities: vi.fn(),
}))

vi.mock('../../api/meta', () => ({
  useAnalyticsMeta: vi.fn(),
}))

const mockCapabilities = vi.mocked(useAdventureCapabilities)
const mockMeta = vi.mocked(useAnalyticsMeta)

beforeEach(() => {
  mockMeta.mockReturnValue({
    data: { admin: { role: 'superadmin' } },
  } as never)
  mockCapabilities.mockReturnValue({
    data: { fixedExitText: '好的，那么我们之后再一起继续冒险吧' },
  } as never)
})

describe('AdventureTestGuide', () => {
  it('opens the test guidance drawer with the staging and main-chain boundaries', async () => {
    const user = userEvent.setup()
    render(<AdventureTestGuide />)

    expect(mockCapabilities).toHaveBeenCalledWith({ enabled: true })
    await user.click(screen.getByRole('button', { name: '测试指引' }))

    expect(await screen.findByText('冒险故事测试指引')).toBeTruthy()
    expect(screen.getByText(/互动点没有 10 秒沉默兜底/)).toBeTruthy()
    expect(
      screen.getByText(/「测试冒险故事」每次从第 0 段重开/),
    ).toBeTruthy()
  })

  it('states the daily gate and the cross-day resume rules', async () => {
    const user = userEvent.setup()
    render(<AdventureTestGuide />)

    await user.click(screen.getByRole('button', { name: '测试指引' }))

    expect(
      (await screen.findAllByText(/每日完成后，正常故事请求被门禁挡住/)).length,
    ).toBeGreaterThan(0)
    expect(screen.getByText(/跨天未完成会继续原集/)).toBeTruthy()
  })

  it('does not request capabilities for an ordinary admin and keeps the guide readable', async () => {
    mockMeta.mockReturnValue({
      data: { admin: { role: 'admin' } },
    } as never)
    mockCapabilities.mockReturnValue({ data: undefined } as never)
    const user = userEvent.setup()
    render(<AdventureTestGuide />)

    expect(mockCapabilities).toHaveBeenCalledWith({ enabled: false })
    await user.click(screen.getByRole('button', { name: '测试指引' }))

    expect(await screen.findByText('冒险故事测试指引')).toBeTruthy()
    expect(
      (await screen.findAllByText(/以 capabilities.fixedExitText 为准/)).length,
    ).toBeGreaterThan(0)
  })

  it('falls back to the capabilities source when the exit text is not loaded', async () => {
    mockCapabilities.mockReturnValue({ data: undefined } as never)
    const user = userEvent.setup()
    render(<AdventureTestGuide />)

    await user.click(screen.getByRole('button', { name: '测试指引' }))

    expect(
      (await screen.findAllByText(/以 capabilities.fixedExitText 为准/)).length,
    ).toBeGreaterThan(0)
  })

  it('closes the drawer from the close control', async () => {
    const user = userEvent.setup()
    render(<AdventureTestGuide />)

    await user.click(screen.getByRole('button', { name: '测试指引' }))
    await user.click(screen.getByRole('button', { name: /close/i }))

    await waitFor(() =>
      expect(screen.queryByText('冒险故事测试指引')).toBeNull(),
    )
  })
})
