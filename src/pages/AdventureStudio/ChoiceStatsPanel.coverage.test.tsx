import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ChoiceStatsPanel from './ChoiceStatsPanel'
import { useEpisodeChoiceStats } from '../../api/queries'
import type { EpisodeChoiceStatsResponse } from '../../types/adventureAdmin'

/**
 * 口径全部来自服务端：前端不排序、不算比率、不推断 neverChosen。
 * 测试要守住「服务端给什么就显示什么」，以及零互动时不铺满段清单。
 */
vi.mock('../../api/queries', () => ({
  useEpisodeChoiceStats: vi.fn(),
}))

const mockQuery = useEpisodeChoiceStats as unknown as ReturnType<typeof vi.fn>

function state(overrides: Record<string, unknown> = {}) {
  return {
    data: undefined,
    isLoading: false,
    error: null,
    ...overrides,
  }
}

function stats(
  overrides: Partial<EpisodeChoiceStatsResponse> = {},
): EpisodeChoiceStatsResponse {
  return {
    episodeId: 'ep1',
    title: '听风原野第一天',
    contentNote: '这是服务端下发的固定说明，前端原样展示。',
    totalInteractions: 30,
    matchedTotal: 21,
    segments: [
      {
        segmentOrder: 1,
        promptText: '你想去哪里？',
        matchedTotal: 18,
        fallbackTotal: 0,
        fallbackRate: 0,
        neverChosen: false,
        choices: [
          {
            index: 0,
            key: 'A',
            text: '去森林',
            hits: 12,
            deterministicHits: 7,
            llmHits: 5,
            share: 0.6667,
          },
          {
            index: 1,
            key: null,
            text: null,
            hits: 6,
            deterministicHits: 2,
            llmHits: 4,
            share: null,
          },
        ],
      },
      {
        segmentOrder: null,
        promptText: null,
        matchedTotal: 0,
        fallbackTotal: 3,
        fallbackRate: null,
        neverChosen: true,
        choices: [],
      },
    ],
    ...overrides,
  }
}

describe('ChoiceStatsPanel · 状态分支', () => {
  it('加载中只显示转圈，不提前给出空态结论', () => {
    mockQuery.mockReturnValue(state({ isLoading: true }))

    render(<ChoiceStatsPanel episodeId="ep1" />)

    expect(document.querySelector('.ant-spin')).not.toBeNull()
    expect(
      screen.queryByText(/这一集还没有选项命中数据/),
    ).not.toBeInTheDocument()
  })

  it('403：说明是权限面问题而不是没有数据', () => {
    const error = Object.assign(new Error('Forbidden'), { status: 403 })
    mockQuery.mockReturnValue(state({ error }))

    render(<ChoiceStatsPanel episodeId="ep1" />)

    expect(screen.getByText('选项命中数据加载失败')).toBeInTheDocument()
    expect(screen.getByText(/当前账号无权访问该端点的数据/)).toBeInTheDocument()
  })

  it('非 403 错误：透出服务端 message', () => {
    mockQuery.mockReturnValue(state({ error: new Error('统计服务挂了') }))

    render(<ChoiceStatsPanel episodeId="ep1" />)

    expect(screen.getByText('统计服务挂了')).toBeInTheDocument()
    expect(screen.queryByText(/当前账号无权访问/)).not.toBeInTheDocument()
  })

  it('非 Error 类型的失败也给出人话，不渲染 undefined', () => {
    mockQuery.mockReturnValue(state({ error: { status: 500 } }))

    render(<ChoiceStatsPanel episodeId="ep1" />)

    expect(screen.getByText('未知错误')).toBeInTheDocument()
  })

  it.each([
    ['data 还没回来', undefined],
    ['还没有任何互动', stats({ totalInteractions: 0 })],
    ['拿不到段清单', stats({ segments: [] })],
  ])('%s 时显示空态并解释两种可能', (_label, data) => {
    mockQuery.mockReturnValue(state({ data }))

    render(<ChoiceStatsPanel episodeId="ep1" />)

    expect(
      screen.getByText(/这一集还没有选项命中数据/),
    ).toBeInTheDocument()
    expect(screen.getByText(/此前发生过的互动不会被追溯进来/)).toBeInTheDocument()
  })
})

describe('ChoiceStatsPanel · 数据展示', () => {
  it('固定说明、汇总与段级统计按服务端数字渲染', () => {
    mockQuery.mockReturnValue(state({ data: stats() }))

    render(<ChoiceStatsPanel episodeId="ep1" />)

    expect(
      screen.getByText('这是服务端下发的固定说明，前端原样展示。'),
    ).toBeInTheDocument()
    expect(screen.getByText('全时段累计')).toBeInTheDocument()
    expect(screen.getByText('互动点总次数')).toBeInTheDocument()
    expect(screen.getByText('命中总次数')).toBeInTheDocument()
    expect(screen.getByText('30')).toBeInTheDocument()
    expect(screen.getByText('21')).toBeInTheDocument()
    expect(screen.getByText('#1')).toBeInTheDocument()
    expect(screen.getByText('你想去哪里？')).toBeInTheDocument()
    expect(screen.getByText('66.7%')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1)
  })

  it('从未被选中：段标题打红标并给出改文案的建议', () => {
    mockQuery.mockReturnValue(state({ data: stats() }))

    render(<ChoiceStatsPanel episodeId="ep1" />)

    expect(screen.getAllByText('从未被选中')).toHaveLength(1)
    expect(
      screen.getByText(/这个交互点的所有选项从未被任何孩子选中过/),
    ).toBeInTheDocument()
    expect(screen.getByText(/建议回到「内容与编辑」tab 修改/)).toBeInTheDocument()
    expect(screen.getByText('未记录段号')).toBeInTheDocument()
    expect(screen.getByText('（无引导词）')).toBeInTheDocument()
  })

  it('选项明细：有 key / 无 key、有文案 / 缺文案都要有明确呈现', () => {
    mockQuery.mockReturnValue(state({ data: stats() }))

    render(<ChoiceStatsPanel episodeId="ep1" />)

    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('去森林')).toBeInTheDocument()
    expect(screen.getByText('（无标识）')).toBeInTheDocument()
    expect(screen.getByText('（选项文案缺失）')).toBeInTheDocument()
    expect(screen.getByText('66.7%')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('有引导词时 neverChosen 警示点名具体交互点', () => {
    mockQuery.mockReturnValue(
      state({
        data: stats({
          segments: [
            {
              segmentOrder: 2,
              promptText: '海边还是山顶？',
              matchedTotal: 0,
              fallbackTotal: 4,
              fallbackRate: 1,
              neverChosen: true,
              choices: [],
            },
          ],
        }),
      }),
    )

    render(<ChoiceStatsPanel episodeId="ep1" />)

    expect(
      screen.getByText(
        '「海边还是山顶？」这个交互点的所有选项从未被任何孩子选中过',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('100.0%')).toBeInTheDocument()
  })
})
