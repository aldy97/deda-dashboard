import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import dayjs from 'dayjs'
import AdventureChoicesSection from './AdventureChoicesSection'
import type { ContentAdventureChoicesResponse } from '../../types/analytics'
import type { DayRange } from '../../utils/date-range'

const mockUseContentAdventureChoices = vi.fn()
vi.mock('../../api/queries', () => ({
  useContentAdventureChoices: () => mockUseContentAdventureChoices(),
}))

/**
 * 完整数据——所有字段均合法非空。
 * 二选一选项命中事件：2 集、共 4 个选项被命中。
 */
const FULL_DATA: ContentAdventureChoicesResponse = {
  totalInteractions: 100,
  outcomeCounts: {
    answered: 70,
    off_topic: 10,
    fallback: 15,
    timeout: 5,
  },
  fallbackRate: 0.15,
  matchedTotal: 85,
  sourceCounts: {
    deterministic: 60,
    llm: 25,
  },
  llmShare: 0.294,
  byEpisode: [
    {
      episodeId: 'ep-001',
      title: '森林冒险',
      matchedTotal: 40,
      fallbackRate: 0.1,
      choices: [
        { segmentOrder: 0, index: 0, key: 'left_path', text: '走左边', hits: 25 },
        { segmentOrder: 0, index: 1, key: 'right_path', text: '走右边', hits: 15 },
      ],
    },
    {
      episodeId: 'ep-002',
      title: '海底世界',
      matchedTotal: 45,
      fallbackRate: 0.05,
      choices: [
        { segmentOrder: 1, index: 0, key: 'swim_up', text: '向上游', hits: 20 },
        { segmentOrder: 1, index: 1, key: 'swim_deep', text: '游向深处', hits: 25 },
      ],
    },
  ],
}

/**
 * 零数据空态——choice_matched 事件当前无任何记录（该事件刚上线）。
 * 这是最重要的测试场景：比率字段全部为 null，byEpisode 为空数组。
 * 前端必须显示空态，禁止出现 NaN / Infinity / null 字符串。
 */
const ZERO_DATA: ContentAdventureChoicesResponse = {
  totalInteractions: 0,
  outcomeCounts: {
    answered: 0,
    off_topic: 0,
    fallback: 0,
    timeout: 0,
  },
  fallbackRate: null,
  matchedTotal: 0,
  sourceCounts: {
    deterministic: 0,
    llm: 0,
  },
  llmShare: null,
  byEpisode: [],
}

/**
 * 部分 null——byEpisode 里某集 fallbackRate 为 null，
 * 某个 choice 的 text / key / segmentOrder 为 null。
 * 前端必须显示占位符（如「—」或「（文案已变更）」），
 * 不能渲染字符串 "null"。
 */
const PARTIAL_NULL_DATA: ContentAdventureChoicesResponse = {
  totalInteractions: 50,
  outcomeCounts: {
    answered: 30,
    off_topic: 5,
    fallback: 10,
    timeout: 5,
  },
  fallbackRate: 0.2,
  matchedTotal: 35,
  sourceCounts: {
    deterministic: 20,
    llm: 15,
  },
  llmShare: 0.429,
  byEpisode: [
    {
      episodeId: 'ep-003',
      title: '荒岛求生',
      matchedTotal: 35,
      fallbackRate: null,
      choices: [
        { segmentOrder: null, index: 0, key: null, text: null, hits: 20 },
        { segmentOrder: 1, index: 1, key: 'build_fire', text: '生火取暖', hits: 15 },
      ],
    },
  ],
}

const RANGE: DayRange = [dayjs('2026-11-01'), dayjs('2026-11-14')]

function renderSection(data: ContentAdventureChoicesResponse = FULL_DATA) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdventureChoicesSection data={data} range={RANGE} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AdventureChoicesSection · 选项命中报表', () => {
  beforeEach(() => {
    mockUseContentAdventureChoices.mockReset()
    mockUseContentAdventureChoices.mockReturnValue({
      data: FULL_DATA,
      isLoading: false,
      error: null,
    })
  })

  // ===== 有数据场景 =====

  it('渲染汇总卡片：总互动数、命中总数、兜底率、LLM占比', () => {
    renderSection()

    expect(screen.getByText('100')).toBeTruthy()
    expect(screen.getByText('85')).toBeTruthy()
    // fallbackRate = 0.15 → "15.0%"
    expect(screen.getByText('15.0%')).toBeTruthy()
    // llmShare = 0.294 → "29.4%"
    expect(screen.getByText('29.4%')).toBeTruthy()
  })

  /**
   * 四张汇总卡片里，「兜底率」「LLM 占比」「总互动数」三个数的分母各不相同，
   * 且与 Adventure Studio 单集视图的兜底率分母也不一样（那边不含超时）。
   * 光看数字必然误读，所以口径必须常驻在 InfoTip 里。
   * 这里断言的是**悬浮后的正文**而不只是图标存在——图标断言抓不到文案写错。
   */
  const hoverCardTip = async (cardTitle: string) => {
    // 「兜底率」在汇总卡片与下方表格列头各出现一次，这里要的是汇总卡片那一个
    const statistic = screen
      .getAllByText(cardTitle)
      .map((el) => el.closest('.ant-statistic'))
      .find((el): el is HTMLElement => el !== null)
    expect(statistic).toBeTruthy()
    const icon = statistic!.querySelector('[aria-label="question-circle"]')
    expect(icon).toBeTruthy()
    fireEvent.mouseEnter(icon!)
  }

  it('总互动数的 InfoTip 说清了不含 off_topic（跑题是中间态，计入会重复）', async () => {
    renderSection()
    await hoverCardTip('总互动数')

    expect(
      await screen.findByText(/已应答\s*\+\s*兜底\s*\+\s*超时/),
    ).toBeTruthy()
    expect(screen.getByText(/不含跑题/)).toBeTruthy()
  })

  it('兜底率的 InfoTip 说清了分母是总互动数，并提示与单集视图口径不同', async () => {
    renderSection()
    await hoverCardTip('兜底率')

    expect(await screen.findByText(/兜底\s*\/\s*总互动数/)).toBeTruthy()
    expect(screen.getByText(/冒险内容工作台.*分母不含超时/)).toBeTruthy()
  })

  it('LLM 占比的 InfoTip 说清了分母是命中总数', async () => {
    renderSection()
    await hoverCardTip('LLM 占比')

    expect(await screen.findByText(/LLM 判定命中数\s*\/\s*命中总数/)).toBeTruthy()
  })

  it('渲染互动结果分布（outcomeCounts 四个数）', () => {
    renderSection()

    expect(screen.getByText('70')).toBeTruthy() // answered
    expect(screen.getByText('10')).toBeTruthy() // off_topic
    expect(screen.getAllByText('15')[0]).toBeTruthy() // fallback
    expect(screen.getByText('5')).toBeTruthy()  // timeout
  })

  it('渲染判定来源分布（确定性 / LLM）', () => {
    renderSection()

    expect(screen.getAllByText('60')[0]).toBeTruthy() // deterministic
    expect(screen.getAllByText('25')[0]).toBeTruthy() // llm
  })

  it('渲染 byEpisode 表格：两集各行可见', () => {
    renderSection()

    expect(screen.getByText('森林冒险')).toBeTruthy()
    expect(screen.getByText('海底世界')).toBeTruthy()
    // 每集 matchedTotal
    expect(screen.getByText('40')).toBeTruthy()
    expect(screen.getByText('45')).toBeTruthy()
    // 每集 fallbackRate：森林冒险 0.1 → "10.0%"，海底世界 0.05 → "5.0%"
    expect(screen.getByText('10.0%')).toBeTruthy()
    expect(screen.getByText('5.0%')).toBeTruthy()
  })

  it('展开 byEpisode 行后渲染该集 choices（segmentOrder / text / key / hits）', () => {
    renderSection()

    // 森林冒险的两个选项
    expect(screen.getByText('走左边')).toBeTruthy()
    expect(screen.getByText('走右边')).toBeTruthy()
    // 海底世界的两个选项
    expect(screen.getByText('向上游')).toBeTruthy()
    expect(screen.getByText('游向深处')).toBeTruthy()
  })

  // ===== 零数据空态（最关键） =====

  it('totalInteractions=0 时显示空态提示，不含 NaN / Infinity / null 字符串', () => {
    mockUseContentAdventureChoices.mockReturnValue({
      data: ZERO_DATA,
      isLoading: false,
      error: null,
    })
    renderSection(ZERO_DATA)

    // 空态文案
    expect(screen.getByText(/暂无选项命中数据/)).toBeTruthy()

    // 全局文本中不含 NaN / Infinity
    expect(document.body.textContent).not.toMatch(/NaN/)
    expect(document.body.textContent).not.toMatch(/Infinity/)

    // 不含字符串 "null"（比率字段 null 必须渲染为 — 或其他占位，不能是 "null"）
    // 注意：ZERO_DATA 中 byEpisode 为空数组，fallbackRate 和 llmShare 都是 null，
    // 空态下它们不应被渲染成任何文本
    const nullTextRegex = /\bnull\b/i
    expect(document.body.textContent).not.toMatch(nullTextRegex)
  })

  it('byEpisode 为空数组时同样显示空态', () => {
    mockUseContentAdventureChoices.mockReturnValue({
      data: ZERO_DATA,
      isLoading: false,
      error: null,
    })
    renderSection(ZERO_DATA)

    expect(screen.getByText(/暂无选项命中数据/)).toBeTruthy()
  })

  // ===== 部分 null =====

  it('fallbackRate=null 的集显示占位符而非 null 或 NaN', () => {
    mockUseContentAdventureChoices.mockReturnValue({
      data: PARTIAL_NULL_DATA,
      isLoading: false,
      error: null,
    })
    renderSection(PARTIAL_NULL_DATA)

    // 荒岛求生的 fallbackRate 为 null，必须渲染 —
    expect(screen.getByText('荒岛求生')).toBeTruthy()

    // 文档中不应出现 NaN / Infinity
    expect(document.body.textContent).not.toMatch(/NaN/)
    expect(document.body.textContent).not.toMatch(/Infinity/)
  })

  it('choice 的 text / key / segmentOrder 为 null 时显示占位符', () => {
    mockUseContentAdventureChoices.mockReturnValue({
      data: PARTIAL_NULL_DATA,
      isLoading: false,
      error: null,
    })
    renderSection(PARTIAL_NULL_DATA)

    // text=null 的选项显示占位，不能显示 "null"
    expect(screen.getByText('（文案已变更）')).toBeTruthy()
    // key=null 也显示占位
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  // ===== loading 与 error =====

  it('loading 时显示 Spin', () => {
    mockUseContentAdventureChoices.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    })
    renderSection(FULL_DATA)

    // antd Spin 会渲染 .ant-spin 类名
    const spins = document.querySelectorAll('.ant-spin')
    expect(spins.length).toBeGreaterThan(0)
  })

  it('error 时显示错误信息', () => {
    mockUseContentAdventureChoices.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('加载失败'),
    })
    renderSection(FULL_DATA)

    expect(screen.getByText(/加载失败/)).toBeTruthy()
  })
})