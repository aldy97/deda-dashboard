import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ReviewQueueTable from './ReviewQueueTable'
import { useReviewQueue } from '../../api/queries'
import type { ReviewQueueItem, ReviewQueueResponse } from '../../types/analytics'

vi.mock('../../api/queries', () => ({
  useReviewQueue: vi.fn(),
}))

const mockQueue = useReviewQueue as unknown as ReturnType<typeof vi.fn>

function item(overrides: Partial<ReviewQueueItem> = {}): ReviewQueueItem {
  return {
    turnId: 'turn-aaaa1111',
    deviceId: 'dev-uuid-1',
    channel: 'baidu-rtc',
    createdAt: '2026-11-12T08:30:00.000Z',
    safetyLayer: 'L1',
    safetyCategory: 'violence',
    safetySource: 'l1_regex',
    safetyMatched: '打死你',
    asrText: '我要打死你',
    intent: null,
    intentSource: 'not_routed',
    ...overrides,
  }
}

function payload(items: ReviewQueueItem[], total = items.length): ReviewQueueResponse {
  return { total, page: 1, pageSize: 20, items }
}

function renderTable() {
  return render(
    <MemoryRouter>
      <ReviewQueueTable startDate="2026-11-06" endDate="2026-11-12" />
    </MemoryRouter>,
  )
}

function clickPage(user: ReturnType<typeof userEvent.setup>, page: number) {
  return user.click(
    screen.getByRole('button', { name: new RegExp(`(Page|第) ${page}`) }),
  )
}

describe('ReviewQueueTable 空值与未知枚举', () => {
  it('asrText 为 null 时不渲染「查看」按钮，只显示「—」', () => {
    mockQueue.mockReturnValue({
      data: payload([
        item({ asrText: null, safetyMatched: null, deviceId: null }),
      ]),
      isLoading: false,
      error: null,
    })
    renderTable()

    expect(screen.queryByRole('button', { name: '查看' })).not.toBeInTheDocument()
    // asrText / safetyMatched / intent 三处都可能是「—」
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2)
  })

  it('safetyLayer 为 null 显示「—」而不是空白', () => {
    mockQueue.mockReturnValue({
      data: payload([item({ safetyLayer: null })]),
      isLoading: false,
      error: null,
    })
    renderTable()

    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('safetyCategory 为 null 显示「未能判定」，未知类别降级为原始 key', () => {
    mockQueue.mockReturnValue({
      data: payload([
        item({ turnId: 'turn-null1', safetyCategory: null }),
        item({ turnId: 'turn-fut11', safetyCategory: 'future_category' }),
      ]),
      isLoading: false,
      error: null,
    })
    renderTable()

    expect(screen.getByText('未能判定')).toBeInTheDocument()
    expect(screen.getByText('future_category')).toBeInTheDocument()
  })
})

describe('ReviewQueueTable 儿童语料打码与筛选联动', () => {
  it('点击「查看」展开原文，再点「隐藏」重新打码', async () => {
    const user = userEvent.setup()
    mockQueue.mockReturnValue({
      data: payload([item()]),
      isLoading: false,
      error: null,
    })
    renderTable()

    expect(screen.queryByText('我要打死你')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '查看' }))
    expect(screen.getByText('我要打死你')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '隐藏' }))
    expect(screen.queryByText('我要打死你')).not.toBeInTheDocument()
  })

  it('切换类别过滤回到第 1 页并下发白名单值', async () => {
    const user = userEvent.setup()
    mockQueue.mockReturnValue({
      data: payload([item()], 45),
      isLoading: false,
      error: null,
    })
    renderTable()

    await clickPage(user, 2)
    await user.click(screen.getByRole('combobox', { name: '类别过滤' }))
    await user.click(
      await screen.findByText('自伤', {
        selector: '.ant-select-item-option-content',
      }),
    )

    expect(mockQueue).toHaveBeenLastCalledWith(
      expect.objectContaining({ category: 'self_harm', page: 1 }),
    )
  })

  it('设备 UUID 回车后才生效，清空输入立即移除过滤', async () => {
    const user = userEvent.setup()
    mockQueue.mockReturnValue({
      data: payload([item()]),
      isLoading: false,
      error: null,
    })
    renderTable()

    await user.type(screen.getByPlaceholderText('内部设备 UUID'), 'dev-uuid{Enter}')
    expect(mockQueue).toHaveBeenLastCalledWith(
      expect.objectContaining({ deviceId: 'dev-uuid', page: 1 }),
    )

    await user.clear(screen.getByPlaceholderText('内部设备 UUID'))
    expect(mockQueue).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ deviceId: expect.anything() }),
    )
  })
})

describe('ReviewQueueTable 排序与分页', () => {
  it('切换排序后按钮文案翻转为「时间倒序」', async () => {
    const user = userEvent.setup()
    mockQueue.mockReturnValue({
      data: payload([item()], 45),
      isLoading: false,
      error: null,
    })
    renderTable()

    expect(screen.getByRole('button', { name: '时间正序' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '时间正序' }))

    expect(screen.getByRole('button', { name: '时间倒序' })).toBeInTheDocument()
    expect(mockQueue).toHaveBeenLastCalledWith(
      expect.objectContaining({ sort: 'createdAt_asc' }),
    )

    // 再点一次切回倒序
    await user.click(screen.getByRole('button', { name: '时间倒序' }))
    expect(screen.getByRole('button', { name: '时间正序' })).toBeInTheDocument()
    expect(mockQueue).toHaveBeenLastCalledWith(
      expect.objectContaining({ sort: 'createdAt_desc' }),
    )
  })

  it('改每页条数时回到第 1 页', async () => {
    const user = userEvent.setup()
    mockQueue.mockReturnValue({
      data: payload([item()], 45),
      isLoading: false,
      error: null,
    })
    renderTable()

    await clickPage(user, 2)
    expect(mockQueue).toHaveBeenLastCalledWith(
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

    expect(mockQueue).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, pageSize: 50 }),
    )
  })
})

describe('ReviewQueueTable 异常兜底', () => {
  it('非 Error 异常降级为「加载失败」，Error 对象展示 message', () => {
    mockQueue.mockReturnValue({ data: null, isLoading: false, error: 'boom' })
    const { unmount } = renderTable()

    expect(screen.getByText('复核队列加载失败')).toBeInTheDocument()
    expect(screen.getByText('加载失败')).toBeInTheDocument()

    unmount()
    mockQueue.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('queue down'),
    })
    renderTable()
    expect(screen.getByText('queue down')).toBeInTheDocument()
  })
})
