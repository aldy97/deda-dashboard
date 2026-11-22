import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Modal, message } from 'antd'
import type { ReactNode } from 'react'
import SpeedSection from './SpeedSection'
import { apiClient } from '../../api/client'

vi.mock('../../api/client', () => ({
  apiClient: { get: vi.fn(), patch: vi.fn(), post: vi.fn() },
}))

const mockGet = apiClient.get as unknown as ReturnType<typeof vi.fn>
const mockPatch = apiClient.patch as unknown as ReturnType<typeof vi.fn>
const mockPost = apiClient.post as unknown as ReturnType<typeof vi.fn>

let success: ReturnType<typeof vi.spyOn>
let error: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  success = vi
    .spyOn(message, 'success')
    .mockImplementation(() => undefined as never)
  error = vi.spyOn(message, 'error').mockImplementation(() => undefined as never)
  vi.spyOn(Modal, 'info').mockImplementation(
    () => ({ destroy: vi.fn(), update: vi.fn() }) as never,
  )
})

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

async function waitForForm(container: HTMLElement) {
  await waitFor(() => {
    const inputs = numberInputs(container)
    expect(inputs.length).toBeGreaterThanOrEqual(2)
    expect(inputs[0].disabled).toBe(false)
  })
  return numberInputs(container)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('SpeedSection', () => {
  it('shows the two speed inputs, range hint and the save button', async () => {
    mockGet.mockResolvedValue({ data: { normalSpd: 0.7, sleepSpd: 0.5 } })
    renderSection()

    expect(await screen.findByText('非哄睡语速')).toBeInTheDocument()
    expect(screen.getByText('哄睡语速')).toBeInTheDocument()
    expect(screen.getAllByText(/0\.5–2\.0/).length).toBeGreaterThanOrEqual(1)
    expect(
      screen.getByRole('button', { name: /保\s*存/ }),
    ).toBeInTheDocument()
  })

  it('fetches /analytics/voice-speed on mount and enables the form', async () => {
    mockGet.mockResolvedValue({ data: { normalSpd: 0.7, sleepSpd: 0.5 } })
    const { container } = renderSection()

    await waitForForm(container)
    expect(mockGet).toHaveBeenCalledWith('/analytics/voice-speed')
  })

  it('saves through PATCH with the current form values', async () => {
    mockGet.mockResolvedValue({ data: { normalSpd: 0.7, sleepSpd: 0.5 } })
    mockPatch.mockResolvedValue({ data: { normalSpd: 0.7, sleepSpd: 0.5 } })
    const { container } = renderSection()

    await waitForForm(container)
    fireEvent.submit(container.querySelector('form') as HTMLFormElement)

    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith('/analytics/voice-speed', {
        normalSpd: 0.7,
        sleepSpd: 0.5,
      }),
    )
    await waitFor(() =>
      expect(success).toHaveBeenCalledWith(
        '已保存；当前这轮不受影响，下一轮起生效',
      ),
    )
  })

  it('clamps out-of-range values to the marked bounds before PATCH', async () => {
    mockGet.mockResolvedValue({ data: { normalSpd: 0.7, sleepSpd: 0.5 } })
    mockPatch.mockResolvedValue({ data: { normalSpd: 2, sleepSpd: 0.5 } })
    const user = userEvent.setup()
    const { container } = renderSection()
    const inputs = await waitForForm(container)

    await user.clear(inputs[0])
    await user.type(inputs[0], '2.5')
    await user.tab()

    expect(inputs[0].value).toBe('2.00')
    fireEvent.submit(container.querySelector('form') as HTMLFormElement)

    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith('/analytics/voice-speed', {
        normalSpd: 2,
        sleepSpd: 0.5,
      }),
    )
  })

  it('shows the server error when saving fails', async () => {
    mockGet.mockResolvedValue({ data: { normalSpd: 0.7, sleepSpd: 0.5 } })
    mockPatch.mockRejectedValue(new Error('保存失败'))
    const { container } = renderSection()

    await waitForForm(container)
    fireEvent.submit(container.querySelector('form') as HTMLFormElement)

    await waitFor(() => expect(error).toHaveBeenCalledWith('保存失败'))
  })

  it('disables immediate apply while the form has unsaved changes', async () => {
    mockGet.mockResolvedValue({ data: { normalSpd: 0.7, sleepSpd: 0.5 } })
    const { container } = renderSection()
    const inputs = await waitForForm(container)

    fireEvent.change(inputs[0], { target: { value: '0.8' } })

    expect(
      screen.getByRole('button', { name: /立即下发到在线设备/ }),
    ).toBeDisabled()
  })

  it('applies the saved config and reports the summary', async () => {
    mockGet.mockResolvedValue({ data: { normalSpd: 0.7, sleepSpd: 0.5 } })
    mockPost.mockResolvedValue({
      data: {
        targeted: 2,
        live: 1,
        deferred: 1,
        skipped: 3,
        results: [],
      },
    })
    const { container } = renderSection()
    await waitForForm(container)

    fireEvent.click(
      screen.getByRole('button', { name: /立即下发到在线设备/ }),
    )
    fireEvent.click(await screen.findByRole('button', { name: /确\s*认/ }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        '/analytics/voice-speed/apply',
        {},
        { timeout: 30000 },
      ),
    )
    await waitFor(() =>
      expect(success).toHaveBeenCalledWith(
        '已下发：1 台生效，1 台延后，3 台跳过',
      ),
    )
  })

  it('shows deferred device details when any device did not apply', async () => {
    mockGet.mockResolvedValue({ data: { normalSpd: 0.7, sleepSpd: 0.5 } })
    mockPost.mockResolvedValue({
      data: {
        targeted: 1,
        live: 0,
        deferred: 1,
        skipped: 0,
        results: [
          {
            deviceId: 'dev-001',
            mac: 'aabbccddeeff',
            applied: 'deferred',
            reason: 'no_active_instance',
          },
        ],
      },
    })
    const { container } = renderSection()
    await waitForForm(container)

    fireEvent.click(
      screen.getByRole('button', { name: /立即下发到在线设备/ }),
    )
    fireEvent.click(await screen.findByRole('button', { name: /确\s*认/ }))

    await waitFor(() => expect(Modal.info).toHaveBeenCalled())
    expect(success).toHaveBeenCalledWith(
      '已下发：0 台生效，1 台延后，0 台跳过',
    )
  })

  it('shows an error when immediate apply fails', async () => {
    mockGet.mockResolvedValue({ data: { normalSpd: 0.7, sleepSpd: 0.5 } })
    mockPost.mockRejectedValue(new Error('下发失败'))
    const { container } = renderSection()
    await waitForForm(container)

    fireEvent.click(
      screen.getByRole('button', { name: /立即下发到在线设备/ }),
    )
    fireEvent.click(await screen.findByRole('button', { name: /确\s*认/ }))

    await waitFor(() => expect(error).toHaveBeenCalledWith('下发失败'))
  })
})
