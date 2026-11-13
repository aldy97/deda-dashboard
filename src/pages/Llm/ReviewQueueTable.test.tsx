import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ReviewQueueTable from './ReviewQueueTable'
import { useReviewQueue } from '../../api/queries'
import type { ReviewQueueResponse } from '../../types/analytics'

vi.mock('../../api/queries', () => ({
  useReviewQueue: vi.fn(),
}))

const mockQueue = useReviewQueue as unknown as ReturnType<typeof vi.fn>

const payload: ReviewQueueResponse = {
  total: 2,
  page: 1,
  pageSize: 20,
  items: [
    {
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
    },
    {
      turnId: 'turn-bbbb2222',
      deviceId: null,
      channel: 'baidu-rtc',
      createdAt: '2026-11-12T09:00:00.000Z',
      safetyLayer: 'L2',
      safetyCategory: 'emotional_harm',
      safetySource: 'l2_model',
      safetyMatched: null,
      asrText: '我不想活了',
      intent: 'free_chat',
      intentSource: 'model',
    },
  ],
}

function renderTable() {
  return render(
    <MemoryRouter>
      <ReviewQueueTable startDate="2026-11-06" endDate="2026-11-12" />
    </MemoryRouter>,
  )
}

/**
 * rc-pagination 把点击处理挂到页码内层的 <a> 上，外层 <li title="2"> 只是壳，
 * 直接点 <li> 不会翻页；<a> 的 aria-label 随 antd locale 变（英文 Page 2 / 中文 第 2 页），
 * 故用正则同时兼容。
 */
function clickPage(user: ReturnType<typeof userEvent.setup>, page: number) {
  return user.click(
    screen.getByRole('button', { name: new RegExp(`(Page|第) ${page}`) }),
  )
}

describe('ReviewQueueTable 儿童语料打码', () => {
  it('asrText 默认打码，不直接出现在 DOM 里', () => {
    mockQueue.mockReturnValue({ data: payload, isLoading: false, error: null })
    renderTable()

    expect(screen.queryByText('我要打死你')).not.toBeInTheDocument()
    expect(screen.queryByText('我不想活了')).not.toBeInTheDocument()
    expect(screen.getAllByText('••••••')).toHaveLength(2)
  })

  it('点击「查看」展开原文，再点「隐藏」重新打码', async () => {
    const user = userEvent.setup()
    mockQueue.mockReturnValue({ data: payload, isLoading: false, error: null })
    renderTable()

    const revealButtons = screen.getAllByRole('button', { name: '查看' })
    await user.click(revealButtons[0])
    expect(screen.getByText('我要打死你')).toBeInTheDocument()
    // 只展开被点的那一行
    expect(screen.queryByText('我不想活了')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '隐藏' }))
    expect(screen.queryByText('我要打死你')).not.toBeInTheDocument()
  })

  it('页面写明原文只覆盖拦截与非 safe 类别，正常轮次不留语料', () => {
    mockQueue.mockReturnValue({ data: payload, isLoading: false, error: null })
    renderTable()

    expect(screen.getByText(/只有「拦了」或「判成非 safe 类别」的轮次才留原文/)).toBeInTheDocument()
    expect(screen.getByText(/禁止直接投屏/)).toBeInTheDocument()
  })
})

describe('ReviewQueueTable 行内容', () => {
  it('展示来源中文名、命中关键词、层级与意图，turnId 可跳消息明细', () => {
    mockQueue.mockReturnValue({ data: payload, isLoading: false, error: null })
    renderTable()

    expect(screen.getByText('L1 正则命中')).toBeInTheDocument()
    expect(screen.queryByText('未做 L2（冒险接管）')).not.toBeInTheDocument()
    expect(screen.getByText('打死你')).toBeInTheDocument()
    expect(screen.getByText('暴力')).toBeInTheDocument()
    expect(screen.getByText('情绪伤害')).toBeInTheDocument()
    expect(screen.getByText('未走到路由')).toBeInTheDocument()
    expect(screen.getByText('小模型判定')).toBeInTheDocument()

    const link = screen.getByRole('link', { name: /turn-aaa/ })
    // 应用路由带 basename='/dashboard'，测试用 MemoryRouter 不带，故只断言路径尾段
    expect(link.getAttribute('href')).toContain('/messages?turnId=turn-aaaa1111')
  })

  it('匿名链路 deviceId 为 null 时显示「匿名」而非空白', () => {
    mockQueue.mockReturnValue({ data: payload, isLoading: false, error: null })
    renderTable()

    expect(screen.getByText('匿名')).toBeInTheDocument()
    expect(screen.getByText('dev-uuid…')).toBeInTheDocument()
  })

  it('safetyMatched 为 null 显示「—」', () => {
    mockQueue.mockReturnValue({ data: payload, isLoading: false, error: null })
    renderTable()

    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })
})

describe('ReviewQueueTable 查询参数', () => {
  it('默认按 createdAt 倒序、第 1 页 20 条', () => {
    mockQueue.mockReturnValue({ data: payload, isLoading: false, error: null })
    renderTable()

    expect(mockQueue).toHaveBeenLastCalledWith({
      startDate: '2026-11-06',
      endDate: '2026-11-12',
      page: 1,
      pageSize: 20,
      sort: 'createdAt_desc',
    })
  })

  it('翻页把 page 传给后端（服务端分页，不是前端切片）', async () => {
    const user = userEvent.setup()
    mockQueue.mockReturnValue({
      data: { ...payload, total: 45 },
      isLoading: false,
      error: null,
    })
    renderTable()

    await clickPage(user, 2)
    expect(mockQueue).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2, pageSize: 20 }),
    )
  })

  it('切换排序方向后回到第 1 页', async () => {
    const user = userEvent.setup()
    mockQueue.mockReturnValue({
      data: { ...payload, total: 45 },
      isLoading: false,
      error: null,
    })
    renderTable()

    await clickPage(user, 2)
    // 先确认确实翻到了第 2 页，否则「回到第 1 页」这条断言恒真
    expect(mockQueue).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }))

    await user.click(screen.getByRole('button', { name: '时间正序' }))
    expect(mockQueue).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, sort: 'createdAt_asc' }),
    )
  })

  it('类别过滤走白名单值，全部类别时不下发 category', async () => {
    const user = userEvent.setup()
    mockQueue.mockReturnValue({ data: payload, isLoading: false, error: null })
    renderTable()

    expect(mockQueue).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ category: expect.anything() }),
    )

    // pagination.showSizeChanger 会多渲染一个「每页条数」Select，同样是 combobox，
    // 故按 aria-label 精确定位类别过滤
    await user.click(screen.getByRole('combobox', { name: '类别过滤' }))
    await user.click(await screen.findByText('自伤', { selector: '.ant-select-item-option-content' }))
    expect(mockQueue).toHaveBeenLastCalledWith(
      expect.objectContaining({ category: 'self_harm', page: 1 }),
    )
  })

  it('按内部设备 UUID 过滤，回车后才生效（不逐字符发请求）', async () => {
    const user = userEvent.setup()
    mockQueue.mockReturnValue({ data: payload, isLoading: false, error: null })
    renderTable()

    await user.type(screen.getByPlaceholderText('内部设备 UUID'), 'dev-uuid{Enter}')
    expect(mockQueue).toHaveBeenLastCalledWith(
      expect.objectContaining({ deviceId: 'dev-uuid', page: 1 }),
    )
    // 输入过程中不得把半截 UUID 发出去（hook 每次渲染都会被调，故检查全部入参）
    const partialLeaks = mockQueue.mock.calls
      .map((call) => call[0] as { deviceId?: string })
      .filter((params) => params.deviceId !== undefined && params.deviceId !== 'dev-uuid')
    expect(partialLeaks).toEqual([])
  })

  it('清空设备过滤后不再下发 deviceId', async () => {
    const user = userEvent.setup()
    mockQueue.mockReturnValue({ data: payload, isLoading: false, error: null })
    renderTable()

    await user.type(screen.getByPlaceholderText('内部设备 UUID'), 'dev-uuid{Enter}')
    const input = screen.getByPlaceholderText('内部设备 UUID')
    await user.clear(input)
    expect(mockQueue).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ deviceId: expect.anything() }),
    )
  })

  it('空结果显示空态文案', () => {
    mockQueue.mockReturnValue({
      data: { total: 0, page: 1, pageSize: 20, items: [] },
      isLoading: false,
      error: null,
    })
    renderTable()

    expect(screen.getByText('所选区间暂无可复核轮次')).toBeInTheDocument()
  })

  it('接口报错时展示错误 Alert', () => {
    mockQueue.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('queue down'),
    })
    renderTable()

    expect(screen.getByText('复核队列加载失败')).toBeInTheDocument()
    expect(screen.getByText('queue down')).toBeInTheDocument()
  })
})
