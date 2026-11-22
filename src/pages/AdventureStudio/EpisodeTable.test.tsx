import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EpisodeTable from './EpisodeTable'
import { useAdventureCapabilities, useAdventureEpisodes } from '../../api/queries'
import type { EpisodeSummary } from '../../types/adventureAdmin'

vi.mock('../../api/queries', () => ({
  useAdventureCapabilities: vi.fn(),
  useAdventureEpisodes: vi.fn(),
}))

const mockCaps = useAdventureCapabilities as unknown as ReturnType<typeof vi.fn>
const mockEpisodes = useAdventureEpisodes as unknown as ReturnType<typeof vi.fn>

function summary(overrides: Partial<EpisodeSummary> = {}): EpisodeSummary {
  return {
    id: 'ep1',
    characterKey: 'elly',
    season: 1,
    episodeNumber: 1,
    businessKey: 'elly/1/1',
    title: '听风原野第一天',
    recap: null,
    published: true,
    retiredAt: null,
    currentVersionId: 'v2',
    currentVersion: 2,
    publishedAt: '2026-11-20T10:00:00.000Z',
    hasDraft: true,
    draftVersionId: 'd3',
    draftVersion: 3,
    draftUpdatedAt: '2026-11-21T10:00:00.000Z',
    draftUpdatedBy: 'alice',
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-21T10:00:00.000Z',
    ...overrides,
  }
}

function listHook(overrides: Record<string, unknown> = {}) {
  return {
    data: { items: [summary()], total: 1 },
    isLoading: false,
    error: null,
    ...overrides,
  }
}

function setup(options?: {
  onCreate?: () => void
  list?: ReturnType<typeof listHook>
}) {
  const onOpen = vi.fn()
  const onCreate = options?.onCreate ?? vi.fn()
  mockCaps.mockReturnValue({
    data: { characterKeys: ['elly', 'polly'] },
    isPending: false,
    error: null,
  })
  mockEpisodes.mockReturnValue(options?.list ?? listHook())
  const view = render(
    <EpisodeTable
      onOpen={onOpen}
      onCreate={options && 'onCreate' in options ? options.onCreate : onCreate}
    />,
  )
  return { onOpen, onCreate, ...view }
}

function clickPage(user: ReturnType<typeof userEvent.setup>, page: number) {
  return user.click(
    screen.getByRole('button', { name: new RegExp(`(Page|第) ${page}`) }),
  )
}

async function chooseOption(
  user: ReturnType<typeof userEvent.setup>,
  selectIndex: number,
  optionText: string,
) {
  const select = screen.getAllByRole('combobox')[selectIndex]
  await user.click(select)
  await user.click(
    await screen.findByText(optionText, {
      selector: '.ant-select-item-option-content',
    }),
  )
}

beforeEach(() => {
  mockCaps.mockReset()
  mockEpisodes.mockReset()
})

describe('EpisodeTable 列表渲染', () => {
  it('首次加载时渲染 loading 表格，查询参数为默认值', () => {
    const { container } = setup({ list: listHook({ data: undefined, isLoading: true }) })

    expect(container.querySelector('.ant-spin')).not.toBeNull()
    expect(mockEpisodes).toHaveBeenLastCalledWith({
      characterKey: undefined,
      published: undefined,
      includeRetired: undefined,
      search: undefined,
      page: 1,
      pageSize: 20,
    })
  })

  it('加载失败时显示错误原因', () => {
    setup({ list: listHook({ data: undefined, error: new Error('网络炸了') }) })

    expect(screen.getByText('故事集列表加载失败')).toBeInTheDocument()
    expect(screen.getByText('网络炸了')).toBeInTheDocument()
  })

  it('没有数据时显示空态，并给 authoring 环境一个「新建第一集」入口', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn()
    setup({
      onCreate,
      list: listHook({ data: { items: [], total: 0 } }),
    })

    expect(screen.getByText('没有符合条件的故事集')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /新建第一集/ }))
    expect(onCreate).toHaveBeenCalledTimes(1)
  })

  it('没有新建权限时不渲染任何新建入口', () => {
    setup({
      onCreate: undefined,
      list: listHook({ data: { items: [], total: 0 } }),
    })

    expect(screen.queryByRole('button', { name: /新建第一集/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /新建故事集/ })).toBeNull()
  })

  it('三个状态维度并排展示：已发布 / 已下架 / 未发布，草稿带版本号', () => {
    setup({
      list: listHook({
        data: {
          items: [
            summary(),
            summary({
              id: 'ep2',
              characterKey: 'polly',
              episodeNumber: 2,
              businessKey: 'polly/1/2',
              title: '雨后的小路',
              published: false,
              retiredAt: '2026-11-18T10:00:00.000Z',
              currentVersion: null,
              currentVersionId: null,
              publishedAt: null,
              hasDraft: false,
              draftVersion: null,
              draftUpdatedAt: null,
              draftUpdatedBy: null,
            }),
            summary({
              id: 'ep3',
              episodeNumber: 3,
              businessKey: 'elly/1/3',
              title: '',
              published: false,
              currentVersion: 1,
              hasDraft: true,
              draftVersion: 4,
              draftUpdatedBy: null,
            }),
          ],
          total: 3,
        },
      }),
    })

    expect(screen.getByText('elly/1/1')).toBeInTheDocument()
    expect(screen.getAllByText('小象 Elly').length).toBeGreaterThan(0)
    expect(screen.getByText('小马 Polly')).toBeInTheDocument()
    expect(screen.getByText('已发布')).toBeInTheDocument()
    expect(screen.getByText('已下架')).toBeInTheDocument()
    expect(screen.getByText('未发布')).toBeInTheDocument()
    expect(screen.getByText('有草稿 v3')).toBeInTheDocument()
    expect(screen.getByText('有草稿 v4')).toBeInTheDocument()
    expect(screen.getByText('v2')).toBeInTheDocument()
    expect(screen.getByText('v1')).toBeInTheDocument()
    // 草稿作者缺失时不能显示空白，否则看不出「谁在改」
    expect(screen.getByText(/未知 · /)).toBeInTheDocument()
  })

  it('当前发布版与草稿为空时都显示「—」而不是 0 或空白', () => {
    setup({
      list: listHook({
        data: {
          items: [
            summary({
              currentVersion: null,
              hasDraft: false,
              draftVersion: null,
              publishedAt: null,
            }),
          ],
          total: 1,
        },
      }),
    })

    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2)
  })

  it('点「打开」与点行都回调 onOpen', async () => {
    const user = userEvent.setup()
    const { onOpen } = setup()

    await user.click(screen.getByText('打开'))
    expect(onOpen).toHaveBeenCalledWith('ep1')

    onOpen.mockClear()
    await user.click(screen.getByText('听风原野第一天'))
    expect(onOpen).toHaveBeenLastCalledWith('ep1')
  })
})

describe('EpisodeTable 筛选与分页', () => {
  it('切换 IP 过滤并把页码重置为第 1 页', async () => {
    const user = userEvent.setup()
    setup({ list: listHook({ data: { items: [summary()], total: 45 } }) })

    await clickPage(user, 2)
    expect(mockEpisodes).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2 }),
    )

    await chooseOption(user, 0, '小马 Polly')
    expect(mockEpisodes).toHaveBeenLastCalledWith(
      expect.objectContaining({ characterKey: 'polly', page: 1 }),
    )
  })

  it('发布状态筛选把「已发布 / 未发布」翻译成布尔值，全部时不下发', async () => {
    const user = userEvent.setup()
    setup()

    await chooseOption(user, 1, '只看已发布')
    expect(mockEpisodes).toHaveBeenLastCalledWith(
      expect.objectContaining({ published: true, page: 1 }),
    )

    await chooseOption(user, 1, '只看未发布')
    expect(mockEpisodes).toHaveBeenLastCalledWith(
      expect.objectContaining({ published: false, page: 1 }),
    )

    await chooseOption(user, 1, '全部发布状态')
    expect(mockEpisodes).toHaveBeenLastCalledWith(
      expect.objectContaining({ published: undefined, page: 1 }),
    )
  })

  it('勾选「含已下架」把 includeRetired 置为 true 并回到第 1 页', async () => {
    const user = userEvent.setup()
    setup({ list: listHook({ data: { items: [summary()], total: 45 } }) })

    await user.click(screen.getByLabelText('含已下架'))
    expect(mockEpisodes).toHaveBeenLastCalledWith(
      expect.objectContaining({ includeRetired: true, page: 1 }),
    )
  })

  it('搜索框逐字更新，但空串不下发 search', async () => {
    const user = userEvent.setup()
    setup()

    const input = screen.getByPlaceholderText('搜索标题 / 集号')
    await user.type(input, '听风')
    expect(mockEpisodes).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: '听风', page: 1 }),
    )

    await user.clear(input)
    expect(mockEpisodes).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: undefined, page: 1 }),
    )
  })

  it('服务端分页：翻页与改每页条数都把参数传给后端', async () => {
    const user = userEvent.setup()
    setup({ list: listHook({ data: { items: [summary()], total: 45 } }) })

    expect(screen.getByText('共 45 集')).toBeInTheDocument()

    await clickPage(user, 2)
    expect(mockEpisodes).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2, pageSize: 20 }),
    )

    const sizeChanger = document.querySelector(
      '.ant-pagination-options .ant-select',
    ) as Element
    await user.click(sizeChanger)
    const options = await screen.findAllByText(/50/)
    const pageSizeOption = options.find((node) =>
      node.classList.contains('ant-select-item-option-content'),
    )
    expect(pageSizeOption).toBeDefined()
    await user.click(pageSizeOption as HTMLElement)

    expect(mockEpisodes).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, pageSize: 50 }),
    )
  })

  it('点击「新建故事集」调用 onCreate', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn()
    setup({ onCreate })

    await user.click(screen.getByRole('button', { name: /新建故事集/ }))
    expect(onCreate).toHaveBeenCalledTimes(1)
  })

  it('IP 下拉清空后不再下发 characterKey', async () => {
    const user = userEvent.setup()
    setup()

    await chooseOption(user, 0, '小象 Elly')
    expect(mockEpisodes).toHaveBeenLastCalledWith(
      expect.objectContaining({ characterKey: 'elly' }),
    )

    const clear = document.querySelector('.ant-select-clear') as Element
    fireEvent.click(clear)
    expect(mockEpisodes).toHaveBeenLastCalledWith(
      expect.objectContaining({ characterKey: undefined }),
    )
  })
})
