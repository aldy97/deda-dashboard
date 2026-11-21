import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import TimbreSection from './TimbreSection'
import { apiClient } from '../../api/client'

vi.mock('../../api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

const mockGet = apiClient.get as unknown as ReturnType<typeof vi.fn>
const mockPost = apiClient.post as unknown as ReturnType<typeof vi.fn>
const mockPut = apiClient.put as unknown as ReturnType<typeof vi.fn>
const mockDelete = apiClient.delete as unknown as ReturnType<typeof vi.fn>

const elly = {
  characterKey: 'elly',
  timbreId: '1000957',
  updatedAt: '2026-11-21T00:00:00.000Z',
  personaConfigured: true,
  devicesInUse: 0,
}
const polly = {
  characterKey: 'polly',
  timbreId: '1001022',
  updatedAt: '2026-11-21T00:00:00.000Z',
  personaConfigured: false,
  devicesInUse: 2,
}

function renderSection() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
  return render(<TimbreSection />, { wrapper: Wrapper })
}

describe('TimbreSection', () => {
  it('renders rows and flags characters without a persona', async () => {
    mockGet.mockResolvedValue({ data: [elly, polly] })
    renderSection()

    expect(await screen.findByText('1000957')).toBeInTheDocument()
    expect(screen.getByText('1001022')).toBeInTheDocument()
    expect(screen.getByText('已配置')).toBeInTheDocument()
    expect(screen.getByText('未配置，对话将回落 Elly')).toBeInTheDocument()
    expect(screen.getByText('2 台')).toBeInTheDocument()
  })

  it('creates a character through the modal', async () => {
    mockGet.mockResolvedValue({ data: [elly] })
    mockPost.mockResolvedValue({ data: { ...elly, characterKey: 'nemo' } })
    renderSection()

    fireEvent.click(await screen.findByRole('button', { name: /新增角色/ }))
    fireEvent.change(await screen.findByLabelText('角色标识'), {
      target: { value: ' Nemo ' },
    })
    fireEvent.change(screen.getByLabelText('音色 ID'), {
      target: { value: '1009999' },
    })
    fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/analytics/voice-timbres', {
        characterKey: 'nemo',
        timbreId: '1009999',
      }),
    )
  })

  it('edits only the timbre id and keeps the key read-only', async () => {
    mockGet.mockResolvedValue({ data: [elly] })
    mockPut.mockResolvedValue({ data: { ...elly, timbreId: '1000958' } })
    renderSection()

    const row = (await screen.findByText('elly')).closest('tr') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: '编辑' }))

    const keyInput = await screen.findByLabelText('角色标识')
    expect(keyInput).toBeDisabled()
    fireEvent.change(screen.getByLabelText('音色 ID'), {
      target: { value: '1000958' },
    })
    fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }))

    await waitFor(() =>
      expect(mockPut).toHaveBeenCalledWith('/analytics/voice-timbres/elly', {
        timbreId: '1000958',
      }),
    )
  })

  it('deletes an unused character without force', async () => {
    mockGet.mockResolvedValue({ data: [elly] })
    mockDelete.mockResolvedValue({ data: undefined })
    renderSection()

    const row = (await screen.findByText('elly')).closest('tr') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: '删除' }))
    fireEvent.click(await screen.findByRole('button', { name: /确认删除/ }))

    await waitFor(() =>
      expect(mockDelete).toHaveBeenCalledWith('/analytics/voice-timbres/elly'),
    )
  })

  it('shows a load error without crashing the section', async () => {
    mockGet.mockRejectedValue(new Error('boom'))
    renderSection()

    expect(await screen.findByText('音色列表加载失败')).toBeInTheDocument()
  })

  it('surfaces a delete failure and keeps the in-use modal open', async () => {
    mockGet.mockResolvedValue({ data: [polly] })
    mockDelete.mockRejectedValue(new Error('角色仍有设备在用'))
    renderSection()

    const row = (await screen.findByText('polly')).closest('tr') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: '删除' }))
    fireEvent.click(await screen.findByRole('button', { name: /仍然删除/ }))

    expect(await screen.findByText('角色仍有设备在用')).toBeInTheDocument()
    expect(
      screen.getByText('角色 polly 仍有 2 台设备在用'),
    ).toBeInTheDocument()
  })

  it('warns and requires a second confirmation before deleting an in-use character', async () => {
    mockGet.mockResolvedValue({ data: [polly] })
    mockDelete.mockResolvedValue({ data: undefined })
    renderSection()

    const row = (await screen.findByText('polly')).closest('tr') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: '删除' }))

    expect(
      await screen.findByText('角色 polly 仍有 2 台设备在用'),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /仍然删除/ }))

    await waitFor(() =>
      expect(mockDelete).toHaveBeenCalledWith(
        '/analytics/voice-timbres/polly',
        { params: { force: true } },
      ),
    )
  })
})
