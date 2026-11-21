import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import SpeedSection from './SpeedSection'
import { apiClient } from '../../api/client'

vi.mock('../../api/client', () => ({
  apiClient: { get: vi.fn(), patch: vi.fn() },
}))

const mockGet = apiClient.get as unknown as ReturnType<typeof vi.fn>
const mockPatch = apiClient.patch as unknown as ReturnType<typeof vi.fn>

function renderSection() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  })
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
  return render(<SpeedSection />, { wrapper: Wrapper })
}

function numberInputs(container: HTMLElement): HTMLInputElement[] {
  return Array.from(container.querySelectorAll('input')) as HTMLInputElement[]
}

describe('SpeedSection', () => {
  it('shows the two speed inputs and the save button', async () => {
    mockGet.mockResolvedValue({ data: { normalSpd: 0.7, sleepSpd: 0.5 } })
    renderSection()

    expect(await screen.findByText('非哄睡语速')).toBeInTheDocument()
    expect(screen.getByText('哄睡语速')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /保\s*存/ }),
    ).toBeInTheDocument()
  })

  it('fetches /analytics/voice-speed on mount and enables the form', async () => {
    mockGet.mockResolvedValue({ data: { normalSpd: 0.7, sleepSpd: 0.5 } })
    const { container } = renderSection()

    await waitFor(() => {
      const inputs = numberInputs(container)
      expect(inputs.length).toBeGreaterThanOrEqual(2)
      expect(inputs[0].disabled).toBe(false)
    })
    expect(mockGet).toHaveBeenCalledWith('/analytics/voice-speed')
  })

  it('saves through PATCH with the current form values', async () => {
    mockGet.mockResolvedValue({ data: { normalSpd: 0.7, sleepSpd: 0.5 } })
    mockPatch.mockResolvedValue({ data: { normalSpd: 0.7, sleepSpd: 0.5 } })
    const { container } = renderSection()

    await waitFor(() => {
      const inputs = numberInputs(container)
      expect(inputs.length).toBeGreaterThanOrEqual(2)
      expect(inputs[0].disabled).toBe(false)
    })

    fireEvent.submit(container.querySelector('form') as HTMLFormElement)

    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith('/analytics/voice-speed', {
        normalSpd: 0.7,
        sleepSpd: 0.5,
      }),
    )
  })
})
