import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SlowCallsTable from './SlowCallsTable'
import { useLlmSlowCalls } from '../../api/queries'
import type { LlmSlowCallItem } from '../../types/analytics'

vi.mock('../../api/queries', () => ({
  useLlmSlowCalls: vi.fn(),
}))

const mockSlowCalls = useLlmSlowCalls as unknown as ReturnType<typeof vi.fn>

function item(overrides: Partial<LlmSlowCallItem> = {}): LlmSlowCallItem {
  return {
    id: 'call-1',
    scene: 'adventure_script_convert',
    tier: 'main',
    model: 'deepseek-flash',
    latencyMs: 9500,
    firstTokenMs: null,
    totalTokens: 4321,
    turnId: null,
    deviceId: 'aa:bb:cc:dd:ee:ff',
    createdAt: '2026-11-20T10:00:00.000Z',
    ...overrides,
  }
}

function mockResult(overrides: Record<string, unknown> = {}) {
  mockSlowCalls.mockReturnValue({
    data: { items: [item()] },
    isLoading: false,
    error: null,
    ...overrides,
  })
}

function renderTable() {
  return render(
    <MemoryRouter>
      <SlowCallsTable startDate="2026-11-01" endDate="2026-11-20" />
    </MemoryRouter>,
  )
}

describe('SlowCallsTable 场景翻译与说明', () => {
  it('adventure_script_convert 显示中文名，而不是原始 scene key', () => {
    mockResult()
    renderTable()

    expect(screen.getByText('故事稿转换')).toBeInTheDocument()
    expect(screen.queryByText('adventure_script_convert')).not.toBeInTheDocument()
  })

  it('场景列表头带 InfoTip，说明场景语义与表格口径', () => {
    mockResult()
    renderTable()

    const headers = document.querySelectorAll('th.ant-table-cell')
    const sceneHeader = Array.from(headers).find((th) =>
      th.textContent?.includes('场景'),
    )
    expect(sceneHeader).toBeDefined()
    expect(
      sceneHeader!.querySelector('[aria-label="question-circle"]'),
    ).not.toBeNull()
  })

  it('未知场景原样展示，不做兜底翻译', () => {
    mockResult({ data: { items: [item({ scene: 'future_scene' })] } })
    renderTable()

    expect(screen.getByText('future_scene')).toBeInTheDocument()
  })

  it('空值列与 turnId 链接保持既有行为', () => {
    mockResult({
      data: {
        items: [
          item({
            firstTokenMs: null,
            totalTokens: null,
            deviceId: null,
            turnId: 'turn-9',
          }),
        ],
      },
    })
    renderTable()

    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3)
    const link = screen.getByRole('link', { name: '查看链路' })
    expect(link.getAttribute('href')).toBe('/messages?turnId=turn-9')
  })

  it('接口报错时展示错误 Alert', () => {
    mockResult({
      data: null,
      error: new Error('slow calls down'),
    })
    renderTable()

    expect(screen.getByText('慢调用数据加载失败')).toBeInTheDocument()
    expect(screen.getByText('slow calls down')).toBeInTheDocument()
  })
})
