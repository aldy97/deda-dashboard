import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import dayjs from 'dayjs'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import Content from './index'

vi.mock('../../components/AnalyticsRangePicker', () => ({
  default: ({ onChange }: { onChange: (value: unknown) => void }) => (
    <div>
      <button onClick={() => onChange(null)}>清空区间</button>
      <button onClick={() => onChange([dayjs('2026-11-01'), dayjs('2026-11-28')])}>
        选择区间
      </button>
    </div>
  ),
}))

vi.mock('../../api/client', () => ({
  apiClient: { get: vi.fn().mockResolvedValue({ data: null }) },
  TOKEN_KEY: 'deda_dashboard_token',
}))

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Content />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('内容与质量页 · header 区间回调', () => {
  it('清空区间不写入 state，选择区间写入 state', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByText('清空区间'))
    expect(screen.getByText('内容与质量')).toBeTruthy()

    await user.click(screen.getByText('选择区间'))
    expect(screen.getByText('内容与质量')).toBeTruthy()
  })
})
