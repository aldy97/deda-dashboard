import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import RecentFailuresTable from './RecentFailuresTable'
import { useLlmRecentFailures } from '../../api/queries'
import type { LlmFailureItem } from '../../types/analytics'

vi.mock('../../api/queries', () => ({
  useLlmRecentFailures: vi.fn(),
}))

const mockFailures = useLlmRecentFailures as unknown as ReturnType<typeof vi.fn>

function item(overrides: Partial<LlmFailureItem> = {}): LlmFailureItem {
  return {
    id: 'fail-1',
    scene: 'chat_main',
    tier: 'main',
    model: 'deepseek-flash',
    failureReason: 'timeout',
    failureDetail: 'ECONNRESET: socket hang up',
    latencyMs: 30000,
    turnId: 'turn-1',
    deviceId: 'aa:bb:cc:dd:ee:ff',
    createdAt: '2026-11-20T10:00:00.000Z',
    ...overrides,
  }
}

function payload(items: LlmFailureItem[], total = items.length) {
  return { total, page: 1, pageSize: 20, items }
}

function mockResult(overrides: Record<string, unknown> = {}) {
  mockFailures.mockReturnValue({
    data: payload([item()]),
    isLoading: false,
    error: null,
    ...overrides,
  })
}

function renderTable(scene?: string) {
  return render(
    <MemoryRouter>
      <RecentFailuresTable scene={scene} />
    </MemoryRouter>,
  )
}

/** rc-pagination 的翻页按钮 aria-label 随 locale 变，用正则兼容英文/中文 */
function clickPage(user: ReturnType<typeof userEvent.setup>, page: number) {
  return user.click(
    screen.getByRole('button', { name: new RegExp(`(Page|第) ${page}`) }),
  )
}

describe('RecentFailuresTable 行内容', () => {
  it('场景翻译中文、层级 Tag、失败原因与细节、耗时与设备都按口径展示', () => {
    mockResult()
    renderTable()

    expect(screen.getByText('主对话回答')).toBeInTheDocument()
    expect(screen.queryByText('chat_main')).not.toBeInTheDocument()
    expect(screen.getByText('主')).toBeInTheDocument()
    expect(screen.getByText('超时')).toBeInTheDocument()
    expect(screen.getByText('ECONNRESET: socket hang up')).toBeInTheDocument()
    expect(screen.getByText('30000 ms')).toBeInTheDocument()
    expect(screen.getByText('aa:bb:cc:dd:ee:ff')).toBeInTheDocument()
    // 时间按格式渲染，不硬编码钟点（CI 跑 UTC）
    expect(screen.getByText(/^2026-11-20 \d{2}:00:00$/)).toBeInTheDocument()
    const link = screen.getByRole('link', { name: '查看链路' })
    expect(link.getAttribute('href')).toBe('/messages?turnId=turn-1')
  })

  it('小模型行用「小」Tag，未知场景与未知失败原因降级为原始值', () => {
    mockResult({
      data: payload([
        item({
          tier: 'small',
          model: 'qwen-flash',
          scene: 'future_scene',
          failureReason: 'future_reason',
          failureDetail: null,
          latencyMs: null,
          deviceId: null,
          turnId: null,
        }),
      ]),
    })
    renderTable()

    expect(screen.getByText('小')).toBeInTheDocument()
    expect(screen.getByText('future_scene')).toBeInTheDocument()
    expect(screen.getByText('future_reason')).toBeInTheDocument()
    // failureDetail / latencyMs / deviceId / turnId 全空 → 四个「—」
    expect(screen.getAllByText('—')).toHaveLength(4)
    expect(screen.queryByRole('link', { name: '查看链路' })).not.toBeInTheDocument()
  })

  it('failureReason 为 null 时显示「未知」而不是空白', () => {
    mockResult({ data: payload([item({ failureReason: null })]) })
    renderTable()

    expect(screen.getByText('未知')).toBeInTheDocument()
  })

  it('空态与加载中状态沿用 Table 默认行为', () => {
    mockResult({ data: null })
    renderTable()

    expect(screen.getAllByText(/No data|暂无数据/).length).toBeGreaterThan(0)
  })
})

describe('RecentFailuresTable 服务端分页', () => {
  it('翻页只改 page，pageSize 不变', async () => {
    const user = userEvent.setup()
    mockResult({ data: payload([item()], 45) })
    renderTable()

    await clickPage(user, 2)

    expect(mockFailures).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2, pageSize: 20 }),
    )
  })

  it('改每页条数时回到第 1 页', async () => {
    const user = userEvent.setup()
    mockResult({ data: payload([item()], 45) })
    renderTable()

    await clickPage(user, 2)
    expect(mockFailures).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2 }),
    )

    const sizeChanger = document.querySelector(
      '.ant-pagination-options .ant-select',
    )
    expect(sizeChanger).not.toBeNull()
    await user.click(sizeChanger as HTMLElement)
    await user.click(
      await screen.findByText(/^50/, {
        selector: '.ant-select-item-option-content',
      }),
    )

    expect(mockFailures).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, pageSize: 50 }),
    )
  })

  it('总条数文案由 showTotal 渲染', () => {
    mockResult({ data: payload([item()], 45) })
    renderTable()

    expect(screen.getByText('共 45 条')).toBeInTheDocument()
  })
})

describe('RecentFailuresTable 场景切换与异常', () => {
  it('场景切换时回到第 1 页，避免停在越界页码', async () => {
    const user = userEvent.setup()
    mockResult({ data: payload([item()], 45) })
    const { rerender } = renderTable()

    await clickPage(user, 2)
    mockResult({ data: payload([item({ scene: 'filler' })], 45) })
    rerender(
      <MemoryRouter>
        <RecentFailuresTable scene="filler" />
      </MemoryRouter>,
    )

    expect(mockFailures).toHaveBeenLastCalledWith(
      expect.objectContaining({ scene: 'filler', page: 1 }),
    )
  })

  it('场景参数只在有值时下发', () => {
    mockResult()
    renderTable()

    expect(mockFailures).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 20,
    })
  })

  it('Error 对象展示 message，非 Error 降级为「加载失败」', () => {
    mockResult({ data: null, error: new Error('failures down') })
    const { rerender } = renderTable()

    expect(screen.getByText('失败明细加载失败')).toBeInTheDocument()
    expect(screen.getByText('failures down')).toBeInTheDocument()

    mockFailures.mockReturnValue({ data: null, isLoading: false, error: 'boom' })
    rerender(
      <MemoryRouter>
        <RecentFailuresTable />
      </MemoryRouter>,
    )
    expect(screen.getByText('加载失败')).toBeInTheDocument()
  })
})
