import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { apiClient } from '../../api/client'
import ReportFeedbackPanel from './ReportFeedbackPanel'
import type {
  ContentParentReportResponse,
  ReportFeedbackListResponse,
} from '../../types/analytics'

vi.mock('../../api/client', () => ({
  apiClient: { get: vi.fn() },
  TOKEN_KEY: 'deda_dashboard_token',
}))

const mockGet = apiClient.get as unknown as ReturnType<typeof vi.fn>

const EMPTY_RESPONSE: ReportFeedbackListResponse = {
  total: 0,
  page: 1,
  pageSize: 20,
  summary: { usefulCount: 0, notUsefulCount: 0, usefulRate: 0 },
  items: [],
}

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="search">{location.search}</div>
}

function renderPanel(entry = '/feedback?tab=report') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <ReportFeedbackPanel />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function search(): string {
  return screen.getByTestId('search').textContent ?? ''
}

/** 最后一次 /analytics/feedback/parent-reports 调用的查询参数 */
function lastReportParams(): Record<string, unknown> | undefined {
  const calls = mockGet.mock.calls.filter(
    (call: unknown[]) => call[0] === '/analytics/feedback/parent-reports',
  )
  if (calls.length === 0) return undefined
  return (calls[calls.length - 1][1] as { params?: Record<string, unknown> })?.params
}

const REPORT_ROW = {
  id: 'f1',
  isUseful: true,
  feedbackAt: '2026-11-26T09:00:00.000Z',
  reportDate: '2026-11-25',
  device: { deviceId: 'DEV-001', deviceCode: 'SN-1', characterKey: 'elly' },
  user: { nickname: '小满妈妈', phone: '13800138000' },
  report: {
    reportDate: '2026-11-25',
    generationStatus: 'completed',
    expressionObservation: '表达流畅',
    emotionObservation: '情绪稳定',
    thinkingObservation: '思维活跃',
    suggestion: '多陪聊',
  },
}

const SUMMARY_RESPONSE: ReportFeedbackListResponse = {
  total: 2,
  page: 1,
  pageSize: 20,
  summary: { usefulCount: 7, notUsefulCount: 3, usefulRate: 0.7 },
  items: [],
}

const QUALITY: ContentParentReportResponse = {
  generated: 120,
  failed: 8,
  successRate: 0.9375,
  feedbackTotal: 45,
  usefulRate: 0.822,
}

/** 一次请求按 URL 分派：两个面板共用同一区间，但打的是不同端点 */
function mockPanelData() {
  mockGet.mockImplementation((url: string) => {
    if (url === '/analytics/feedback/parent-reports')
      return Promise.resolve({ data: SUMMARY_RESPONSE })
    if (url === '/analytics/content/parent-report')
      return Promise.resolve({ data: QUALITY })
    return Promise.resolve({ data: null })
  })
}

function lastParamsOf(url: string): Record<string, unknown> | undefined {
  const calls = mockGet.mock.calls.filter((call: unknown[]) => call[0] === url)
  if (calls.length === 0) return undefined
  return (calls[calls.length - 1][1] as { params?: Record<string, unknown> })?.params
}

describe('ReportFeedbackPanel · 家长报告生成质量并入日报反馈', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockPanelData()
  })

  it('同一区间内同时给出生成质量与反馈有用率六个指标', async () => {
    renderPanel()

    // 标题先渲染、数值随查询回来，等数值出现再断言
    expect(await screen.findByText('120')).toBeTruthy()
    // 「有用」同时是统计卡标题与上方筛选按钮，必须限定在统计卡里查
    const stats = within(
      screen.getByText('生成报告数').closest('.ant-card') as HTMLElement,
    )
    expect(stats.getByText('生成失败数')).toBeTruthy()
    expect(stats.getByText('8')).toBeTruthy()
    expect(stats.getByText('生成成功率')).toBeTruthy()
    expect(stats.getByText('93.8%')).toBeTruthy()
    // antd 把 70.0 拆成整数/小数两个 span，按统计卡整体取文本
    const usefulRate = stats
      .getByText('区间有用率')
      .closest('.ant-statistic') as HTMLElement
    expect(usefulRate.textContent).toContain('70.0')
    expect(usefulRate.textContent).toContain('%')
    expect(stats.getByText('有用')).toBeTruthy()
    expect(stats.getByText('7')).toBeTruthy()
    expect(stats.getByText('无用')).toBeTruthy()
    expect(stats.getByText('3')).toBeTruthy()

    // 两个端点必须吃同一个日期区间，否则生成量与有用率对不上
    const report = lastParamsOf('/analytics/feedback/parent-reports')
    const quality = lastParamsOf('/analytics/content/parent-report')
    expect(quality).toEqual({
      startDate: report?.startDate,
      endDate: report?.endDate,
    })
  })

  it('null 率值渲染为 —，不显示 NaN', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/analytics/content/parent-report')
        return Promise.resolve({
          data: { ...QUALITY, successRate: null },
        })
      return Promise.resolve({ data: SUMMARY_RESPONSE })
    })

    renderPanel()

    expect(await screen.findByText('生成成功率')).toBeTruthy()
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('NaN%')).toBeNull()
  })

  it('生成质量请求失败只报它自己的错，明细表照常渲染', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/analytics/content/parent-report')
        return Promise.reject(new Error('quality boom'))
      return Promise.resolve({ data: SUMMARY_RESPONSE })
    })

    renderPanel()

    expect(await screen.findByText('家长报告数据加载失败')).toBeTruthy()
    expect(screen.getByText('quality boom')).toBeTruthy()
  })

  it('保留「生成失败排查」的模型监控深链，不再指向已合并的 tab', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/analytics/meta')
        return Promise.resolve({
          data: {
            nodeEnv: 'staging',
            promptWriteEnabled: true,
            publishConfirmCode: 'DEDA2025',
            admin: { username: 'root', displayName: '超管', role: 'superadmin' },
          },
        })
      return Promise.resolve({ data: SUMMARY_RESPONSE })
    })

    renderPanel()

    expect(await screen.findByText(/生成失败排查/)).toBeTruthy()
    const link = await screen.findByRole('link', { name: /生成失败排查/ })
    expect(link.getAttribute('href')).toBe('/llm?tab=perf&scene=parent_report')
    expect(screen.queryByText(/看日报反馈明细/)).toBeNull()
  })
})

describe('ReportFeedbackPanel · 明细表', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockGet.mockImplementation((url: string) => {
      if (url === '/analytics/content/parent-report')
        return Promise.resolve({ data: QUALITY })
      return Promise.resolve({
        data: {
          ...SUMMARY_RESPONSE,
          total: 2,
          items: [
            REPORT_ROW,
            {
              ...REPORT_ROW,
              id: 'f2',
              isUseful: false,
              device: { ...REPORT_ROW.device, deviceCode: null },
              user: { nickname: null, phone: null },
              report: {
                ...REPORT_ROW.report,
                suggestion: null,
                generationStatus: 'failed',
              },
            },
          ],
        },
      })
    })
  })

  it('渲染设备/家长/反馈列，缺值给占位，设备可点进设备档案', async () => {
    renderPanel()

    expect(await screen.findByText('SN-1')).toBeTruthy()
    expect(screen.getAllByText('DEV-001')[0]).toBeTruthy()
    expect(screen.getAllByText('elly').length).toBe(2)
    expect(screen.getByText('小满妈妈')).toBeTruthy()
    expect(screen.getByText('13800138000')).toBeTruthy()
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2)
    // 「有用 / 无用」同时是筛选按钮与表格 Tag，限定在表格里查
    const table = within(document.querySelector('.ant-table') as HTMLElement)
    expect(table.getByText('有用')).toBeTruthy()
    expect(table.getByText('无用')).toBeTruthy()

    const link = screen.getByRole('link', { name: 'SN-1' })
    expect(link.getAttribute('href')).toBe('/users/DEV-001')
    expect(screen.getByText('共 2 条')).toBeTruthy()
  })

  it('展开行展示日报正文，null 字段回落 —', async () => {
    renderPanel()

    await screen.findByText('SN-1')
    expect(screen.getAllByRole('row').length).toBeGreaterThan(2)
    const expandButtons = document.querySelectorAll('.ant-table-row-expand-icon')
    expect(expandButtons.length).toBe(2)
    fireEvent.click(expandButtons[0])

    expect(await screen.findByText('表达观察：')).toBeTruthy()
    expect(screen.getByText('表达流畅')).toBeTruthy()
    expect(screen.getByText('多陪聊')).toBeTruthy()

    fireEvent.click(document.querySelectorAll('.ant-table-row-expand-icon')[1])
    expect(await screen.findByText(/状态：failed/)).toBeTruthy()
  })

  it('切预设区间与翻页都会重新发请求，生成质量跟着同一区间走', async () => {
    // 这一例要翻页：给足 25 条，否则只有一页没有页码可点
    mockGet.mockImplementation((url: string) => {
      if (url === '/analytics/content/parent-report')
        return Promise.resolve({ data: QUALITY })
      return Promise.resolve({
        data: { ...SUMMARY_RESPONSE, total: 25, items: [REPORT_ROW] },
      })
    })
    renderPanel()

    await screen.findByText('SN-1')
    const picker = document.querySelector('.ant-picker input') as HTMLElement
    fireEvent.click(picker)
    fireEvent.mouseDown(picker)
    // 预设项是 li，文案节点被拆过，按位置取「近 7 天」
    const presets = await waitFor(() => {
      const items = document.querySelectorAll('.ant-picker-presets li')
      expect(items.length).toBeGreaterThan(2)
      return items
    })
    fireEvent.click(presets[2])

    await waitFor(() => {
      const report = lastParamsOf('/analytics/feedback/parent-reports')
      const quality = lastParamsOf('/analytics/content/parent-report')
      expect(quality?.startDate).toBe(report?.startDate)
      expect(quality?.endDate).toBe(report?.endDate)
    })

    // 翻页：page=2 只影响明细，生成质量不接收 page 参数
    // antd 6 没配 locale，分页按钮的可访问名是英文 "Page 2"
    fireEvent.click(await screen.findByRole('button', { name: 'Page 2' }))
    await waitFor(() => {
      expect(lastReportParams()?.page).toBe(2)
    })
  })

  it('切「无用」只把 isUseful=false 传给服务端', async () => {
    renderPanel()

    await screen.findByText('SN-1')
    fireEvent.click(screen.getByRole('radio', { name: '无用' }))

    await waitFor(() => {
      expect(lastReportParams()?.isUseful).toBe(false)
    })
  })
})

describe('ReportFeedbackPanel · deviceId 预筛', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockGet.mockResolvedValue({ data: EMPTY_RESPONSE })
  })

  it('?deviceId= 传入后 API 请求带 deviceId 参数', async () => {
    renderPanel('/feedback?tab=report&deviceId=dev-abc')

    await waitFor(() => {
      const params = lastReportParams()
      expect(params?.deviceId).toBe('dev-abc')
    })
  })

  it('无 ?deviceId= 时 API 请求不带 deviceId', async () => {
    renderPanel('/feedback?tab=report')

    // 先确认请求真的发出去了，否则「deviceId 是 undefined」会因为根本没调用而假通过
    await waitFor(() => {
      expect(lastReportParams()).toBeDefined()
    })
    expect(lastReportParams()?.deviceId).toBeUndefined()
  })

  it('渲染可关闭 Tag「设备：X」', async () => {
    renderPanel('/feedback?tab=report&deviceId=dev-abc')

    expect(await screen.findByText(/设备：dev-abc/)).toBeTruthy()
  })

  it('关闭 Tag 后清掉 deviceId 并恢复全量', async () => {
    renderPanel('/feedback?tab=report&deviceId=dev-abc')

    const tag = await screen.findByText(/设备：dev-abc/)
    // antd Tag 的关闭按钮在 tag 内部
    const closeBtn = tag.querySelector('.ant-tag-close-icon')
    expect(closeBtn).not.toBeNull()
    fireEvent.click(closeBtn as Element)

    // URL 不再有 deviceId
    await waitFor(() => {
      expect(search()).not.toContain('deviceId')
    })

    // API 请求也不带 deviceId
    const params = lastReportParams()
    expect(params?.deviceId).toBeUndefined()
  })
})
