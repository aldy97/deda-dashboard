import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import Voice from './index'
import { apiClient } from '../../api/client'

vi.mock('../../api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

const mockGet = apiClient.get as unknown as ReturnType<typeof vi.fn>

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  })
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
  return render(<Voice />, { wrapper: Wrapper })
}

describe('Voice 页面', () => {
  it('renders the combined page with both sections', async () => {
    mockGet.mockImplementation((url: string) =>
      url === '/analytics/voice-speed'
        ? Promise.resolve({ data: { normalSpd: 0.7, sleepSpd: 0.5 } })
        : Promise.resolve({ data: [] }),
    )
    renderPage()

    expect(screen.getByText('语速与音色')).toBeInTheDocument()
    expect(await screen.findByText('非哄睡语速')).toBeInTheDocument()
    expect(screen.getByText('音色管理')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /新增角色/ }),
    ).toBeInTheDocument()
  })
})
