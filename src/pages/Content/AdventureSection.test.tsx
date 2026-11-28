import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import dayjs from 'dayjs'
import AdventureSection from './AdventureSection'
import type { ContentAdventureResponse } from '../../types/analytics'
import type { DayRange } from '../../utils/date-range'

// Mock useAdventureCapabilities
const mockUseAdventureCapabilities = vi.fn()
vi.mock('../../api/queries', () => ({
  useAdventureCapabilities: (options?: unknown) =>
    mockUseAdventureCapabilities(options),
}))

const mockUseAnalyticsMeta = vi.fn()
vi.mock('../../api/meta', () => ({
  useAnalyticsMeta: () => mockUseAnalyticsMeta(),
}))

const DATA: ContentAdventureResponse = {
  startedDevices: 10,
  completedEpisodes: 50,
  completionRate: 0.8,
  avgStarsPerEpisode: 4.2,
  topEpisodes: [
    {
      episodeId: 'ep-001',
      title: '森林冒险',
      completions: 20,
      avgStars: 4.5,
    },
    {
      episodeId: 'ep-002',
      title: '海底世界',
      completions: 15,
      avgStars: 3.8,
    },
  ],
}

const RANGE: DayRange = [dayjs('2026-11-01'), dayjs('2026-11-14')]

function renderSection() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdventureSection data={DATA} range={RANGE} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AdventureSection · 下钻出口', () => {
  beforeEach(() => {
    mockUseAdventureCapabilities.mockReset()
    mockUseAnalyticsMeta.mockReset()
    mockUseAnalyticsMeta.mockReturnValue({
      data: {
        nodeEnv: 'staging',
        promptWriteEnabled: true,
        publishConfirmCode: 'DEDA2025',
        admin: {
          username: 'superadmin',
          displayName: '超管',
          role: 'superadmin',
        },
      },
      isPending: false,
      isError: false,
    })
  })

  describe('权限已确认（capabilities 成功）', () => {
    beforeEach(() => {
      mockUseAdventureCapabilities.mockReturnValue({
        data: { authoring: true },
        isPending: false,
        error: null,
      })
    })

    it('剧集列链接指向 /adventure?tab=episodes&episodeId=<id>', async () => {
      renderSection()

      const epLink = screen.getByText('森林冒险')
      expect(epLink.tagName).toBe('A')
      expect(epLink.getAttribute('href')).toBe('/adventure?tab=episodes&episodeId=ep-001')

      const ep2Link = screen.getByText('海底世界')
      expect(ep2Link.getAttribute('href')).toBe('/adventure?tab=episodes&episodeId=ep-002')
    })

    it('卡片级出口「冒险内容工作台 →」指向 /adventure?tab=episodes', async () => {
      renderSection()

      const workbenchLink = screen.getByText(/冒险内容工作台/)
      expect(workbenchLink.tagName).toBe('A')
      expect(workbenchLink.getAttribute('href')).toBe('/adventure?tab=episodes')
    })

    it('「看冒险对话消息 →」链接带 mode=adventure_story', async () => {
      renderSection()

      const msgLink = screen.getByText(/看冒险对话消息/)
      expect(msgLink.tagName).toBe('A')
      expect(msgLink.getAttribute('href')).toContain('mode=adventure_story')
    })
  })

  describe('403 无权限（content scope 缺失）', () => {
    beforeEach(() => {
      const error = new Error('Forbidden') as Error & { status: number }
      error.status = 403
      mockUseAdventureCapabilities.mockReturnValue({
        data: undefined,
        isPending: false,
        error,
      })
    })

    it('剧集列链接渲染为禁用态且出现超级管理员说明', async () => {
      renderSection()

      // 链接应该是禁用态（Button type="link" disabled）
      const epBtn = screen.getByText('森林冒险')
      expect(epBtn.closest('button')).toBeTruthy()
      expect((epBtn.closest('button') as HTMLButtonElement).disabled).toBe(true)

      // 服务端 403 的说明文案改走超级管理员口径
      expect(screen.getByText(/超级管理员/)).toBeTruthy()
    })

    it('「冒险内容工作台 →」为禁用态', async () => {
      renderSection()

      const workbenchBtn = screen.getByText(/冒险内容工作台/)
      expect(workbenchBtn.closest('button')).toBeTruthy()
      expect((workbenchBtn.closest('button') as HTMLButtonElement).disabled).toBe(true)
    })

    it('「看冒险对话消息 →」仍然可点（不需要权限）', async () => {
      renderSection()

      const msgLink = screen.getByText(/看冒险对话消息/)
      expect(msgLink.tagName).toBe('A')
      expect(msgLink.getAttribute('href')).toContain('mode=adventure_story')
    })
  })

  describe('只读环境（有 scope 但 authoring=false）', () => {
    beforeEach(() => {
      mockUseAdventureCapabilities.mockReturnValue({
        data: { authoring: false, profile: 'read_only' },
        isPending: false,
        error: null,
      })
    })

    it('查看入口仍然可点：闸口是 scope 不是 authoring', async () => {
      renderSection()

      const epLink = screen.getByText('森林冒险')
      expect(epLink.tagName).toBe('A')
      expect(epLink.getAttribute('href')).toBe(
        '/adventure?tab=episodes&episodeId=ep-001',
      )
      expect(screen.getByText(/冒险内容工作台/).tagName).toBe('A')
      expect(screen.queryByText(/adventure-content scope/)).toBeNull()
    })
  })

  describe('普通 admin（非 superadmin）', () => {
    beforeEach(() => {
      mockUseAnalyticsMeta.mockReturnValue({
        data: {
          nodeEnv: 'staging',
          promptWriteEnabled: true,
          publishConfirmCode: 'DEDA2025',
          admin: { username: 'ops', displayName: '运营', role: 'admin' },
        },
        isPending: false,
        isError: false,
      })
      // 即便 capabilities 缓存里已有数据，普通 admin 也不该用它放行
      mockUseAdventureCapabilities.mockReturnValue({
        data: { authoring: true, profile: 'authoring' },
        isPending: false,
        error: null,
      })
    })

    it('不启用 capabilities 查询（避免无谓的 403 请求）', () => {
      renderSection()

      expect(mockUseAdventureCapabilities).toHaveBeenCalledWith({
        enabled: false,
      })
    })

    it('入口退化为灰色纯文本，并保留超级管理员说明', () => {
      renderSection()

      const epText = screen.getByText('森林冒险')
      expect(epText.tagName).toBe('SPAN')
      expect(epText).toHaveAttribute('data-access', 'restricted')
      expect(screen.getByText(/超级管理员/)).toBeTruthy()
      // 卡片级出口同样退化为文本，不再留下可点的死链
      expect(screen.getByText('冒险内容工作台').tagName).toBe('SPAN')
      expect(
        screen.queryByRole('button', { name: /冒险内容工作台/ }),
      ).toBeNull()
    })

    it('「看冒险对话消息 →」仍然可点（与运维权限无关）', () => {
      renderSection()

      const msgLink = screen.getByText(/看冒险对话消息/)
      expect(msgLink.tagName).toBe('A')
    })
  })

  describe('meta 不可用（无法确认角色）', () => {
    beforeEach(() => {
      mockUseAnalyticsMeta.mockReturnValue({
        data: undefined,
        isPending: false,
        isError: true,
      })
      mockUseAdventureCapabilities.mockReturnValue({
        data: undefined,
        isPending: true,
        error: null,
      })
    })

    it('入口退化为纯文本，提示无法确认权限（fail-closed），且不发 capabilities', () => {
      renderSection()

      expect(screen.getByText(/无法确认账号权限/)).toBeTruthy()
      const epText = screen.getByText('森林冒险')
      expect(epText.tagName).toBe('SPAN')
      expect(epText).toHaveAttribute('data-access', 'restricted')
      expect(mockUseAdventureCapabilities).toHaveBeenCalledWith({
        enabled: false,
      })
    })
  })

  describe('capabilities 加载中', () => {
    beforeEach(() => {
      mockUseAdventureCapabilities.mockReturnValue({
        data: undefined,
        isPending: true,
        error: null,
      })
    })

    it('权限确认中时链接为禁用态', async () => {
      renderSection()

      const epBtn = screen.getByText('森林冒险')
      expect(epBtn.closest('button')).toBeTruthy()
      expect((epBtn.closest('button') as HTMLButtonElement).disabled).toBe(true)

      expect(screen.getByText(/权限确认中/)).toBeTruthy()
    })
  })
})
