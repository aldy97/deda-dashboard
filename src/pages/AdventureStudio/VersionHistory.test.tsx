import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import VersionHistory from './VersionHistory'
import type { ApiError } from '../../api/client'
import type {
  VersionDiffResult,
  VersionSummary,
} from '../../types/adventureAdmin'
import {
  useAdventureAuthoring,
  useAdventureEpisode,
  useAdventureVersion,
  useAdventureVersionDiff,
  useAdventureVersions,
  useRevertAdventureEpisode,
} from '../../api/queries'

vi.mock('../../api/queries', () => ({
  useAdventureAuthoring: vi.fn(),
  useAdventureEpisode: vi.fn(),
  useAdventureVersion: vi.fn(),
  useAdventureVersionDiff: vi.fn(),
  useAdventureVersions: vi.fn(),
  useRevertAdventureEpisode: vi.fn(),
}))

const mockAuthoring = useAdventureAuthoring as unknown as ReturnType<typeof vi.fn>
const mockEpisode = useAdventureEpisode as unknown as ReturnType<typeof vi.fn>
const mockVersion = useAdventureVersion as unknown as ReturnType<typeof vi.fn>
const mockDiff = useAdventureVersionDiff as unknown as ReturnType<typeof vi.fn>
const mockVersions = useAdventureVersions as unknown as ReturnType<typeof vi.fn>
const mockRevert = useRevertAdventureEpisode as unknown as ReturnType<typeof vi.fn>

function version(overrides: Partial<VersionSummary> = {}): VersionSummary {
  return {
    id: 'ver2',
    version: 2,
    status: 'published',
    contentHash: 'abcdef0123456789abcdef',
    changeNote: '修改了第二段的引导语',
    createdBy: 'user-1',
    createdByName: 'Alice',
    publishedAt: '2026-11-20T10:00:00.000Z',
    publishedBy: 'alice',
    supersededById: null,
    createdAt: '2026-11-20T09:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    title: '听风原野第一天',
    segmentCount: 8,
    isCurrent: true,
    ...overrides,
  }
}

const publishedCurrent = version()
const superseded = version({
  id: 'ver1',
  version: 1,
  status: 'superseded',
  contentHash: null,
  changeNote: null,
  isCurrent: false,
  publishedAt: null,
  publishedBy: null,
})

function detail(overrides: Record<string, unknown> = {}) {
  return {
    summary: {
      id: 'ep1',
      characterKey: 'elly',
      season: 1,
      episodeNumber: 1,
      businessKey: 'elly/1/1',
      title: '听风原野第一天',
      recap: null,
      published: true,
      retiredAt: null,
      currentVersionId: 'ver2',
      currentVersion: 2,
      publishedAt: '2026-11-20T10:00:00.000Z',
      hasDraft: true,
      draftVersionId: 'd1',
      draftVersion: 1,
      draftUpdatedAt: '2026-11-21T10:00:00.000Z',
      draftUpdatedBy: 'alice',
      createdAt: '2026-11-01T10:00:00.000Z',
      updatedAt: '2026-11-21T10:00:00.000Z',
    },
    content: { title: '听风原野第一天', recap: null, segments: [] },
    contentSource: 'draft',
    baseVersionId: 'ver2',
    baseDraftUpdatedAt: '2026-11-21T10:00:00.000Z',
    lint: { ok: true, issues: [], errors: [], warnings: [] },
    impact: {
      devicesPlayingToday: 3,
      devicesStaleCrossDay: 1,
      devicesPinnedToOlderVersions: 2,
      totalDevicesEverStarted: 40,
      publishedVersionCount: 2,
    },
    ...overrides,
  }
}

function diffResult(overrides: Partial<VersionDiffResult> = {}): VersionDiffResult {
  const side = (versionNumber: number) => ({
    versionId: `ver${versionNumber}`,
    version: versionNumber,
    status: 'published' as const,
    businessKey: 'elly/1/1',
    episode: {
      characterKey: 'elly' as const,
      season: 1,
      episodeNumber: 1,
      title: '听风原野第一天',
      recap: null,
      segments: [],
    },
  })
  return {
    left: side(1),
    right: side(2),
    titleChanged: true,
    recapChanged: true,
    added: [{ order: 2, change: 'added', after: '新段' }],
    removed: [],
    changed: [{ order: 0, change: 'modified', field: 'text', before: '旧', after: '新' }],
    segmentDiffs: [
      { order: 0, change: 'modified', field: 'text', before: '旧', after: '新' },
      { order: 2, change: 'added', after: '新段' },
    ],
    ...overrides,
  }
}

function versionsHook(overrides: Record<string, unknown> = {}) {
  return {
    data: [publishedCurrent, superseded],
    isLoading: false,
    error: null,
    ...overrides,
  }
}

function revertHook(overrides: Record<string, unknown> = {}) {
  return {
    mutate: vi.fn(),
    isPending: false,
    error: null,
    ...overrides,
  }
}

function setup(options?: {
  versions?: Record<string, unknown>
  detail?: Record<string, unknown> | null
  authoring?: boolean
  version?: Record<string, unknown>
  diff?: Record<string, unknown>
  revert?: Record<string, unknown>
  initialVersionId?: string | null
  onPreviewClosed?: () => void
}) {
  mockAuthoring.mockReturnValue(options?.authoring ?? true)
  mockVersions.mockReturnValue(options?.versions ?? versionsHook())
  mockEpisode.mockReturnValue(
    options?.detail === null
      ? { data: null, isLoading: false, error: null }
      : { data: detail(), isLoading: false, error: null },
  )
  mockVersion.mockReturnValue(
    options?.version ?? { data: null, isFetching: false, error: null },
  )
  mockDiff.mockReturnValue(
    options?.diff ?? {
      data: diffResult(),
      isFetching: false,
      error: null,
    },
  )
  mockRevert.mockReturnValue(options?.revert ?? revertHook())
  return render(
    <VersionHistory
      episodeId="ep1"
      initialVersionId={options?.initialVersionId}
      onPreviewClosed={options?.onPreviewClosed}
    />,
  )
}

function apiError(message: string, extra: Partial<ApiError> = {}): ApiError {
  return Object.assign(new Error(message), extra)
}

beforeEach(() => {
  mockAuthoring.mockReset()
  mockVersions.mockReset()
  mockEpisode.mockReset()
  mockVersion.mockReset()
  mockDiff.mockReset()
  mockRevert.mockReset()
})

async function clickPageLink(name: string) {
  const links = screen.getAllByText(name)
  await userEvent.setup().click(links[0])
}

describe('VersionHistory 时间线', () => {
  it('加载中与加载失败都有明确反馈', () => {
    const { rerender } = setup({
      versions: versionsHook({ data: undefined, isLoading: true }),
    })
    expect(document.querySelector('.ant-spin')).not.toBeNull()

    mockVersions.mockReturnValue(
      versionsHook({ data: undefined, error: new Error('版本接口挂了') }),
    )
    rerender(<VersionHistory episodeId="ep1" />)
    expect(screen.getByText('版本时间线加载失败')).toBeInTheDocument()
    expect(screen.getByText('版本接口挂了')).toBeInTheDocument()
  })

  it('没有任何版本时给出空态', () => {
    setup({ versions: versionsHook({ data: [] }) })

    expect(screen.getByText('这一集还没有任何版本')).toBeInTheDocument()
    expect(screen.getByText('选择两个版本即可查看逐段差异。')).toBeInTheDocument()
  })

  it('版本行展示当前标记、状态、变更说明、哈希与时间', () => {
    setup()

    expect(screen.getAllByText('v2').length).toBeGreaterThan(0)
    expect(screen.getByText('当前')).toBeInTheDocument()
    expect(screen.getAllByText('当前发布版').length).toBeGreaterThan(0)
    expect(screen.getAllByText('历史版本').length).toBeGreaterThan(0)
    expect(screen.getByText('修改了第二段的引导语')).toBeInTheDocument()
    // changeNote / contentHash 为 null 时都退化为「—」，不能显示 null
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2)
    // 短哈希只展示前 12 位
    expect(screen.getByText('abcdef012345…')).toBeInTheDocument()
  })

  it('草稿与已作废版本不允许回滚，也不显示回滚入口', () => {
    setup({
      versions: versionsHook({
        data: [
          version({ id: 'ver3', version: 3, status: 'draft', isCurrent: false }),
          version({ id: 'ver2', version: 2, status: 'discarded', isCurrent: false }),
        ],
      }),
    })

    expect(screen.getByText('草稿')).toBeInTheDocument()
    expect(screen.getByText('已作废')).toBeInTheDocument()
    expect(screen.queryByText('回滚到这一版')).toBeNull()
  })

  it('只读环境看不到回滚入口，但仍可查看内容', () => {
    setup({ authoring: false })

    expect(screen.queryByText('回滚到这一版')).toBeNull()
    expect(screen.getAllByText('查看内容').length).toBe(2)
  })
})

describe('VersionHistory 版本对比', () => {
  it('默认对比当前发布版与它的上一版', () => {
    setup()

    expect(mockDiff).toHaveBeenLastCalledWith('ep1', 'ver1', 'ver2')
    expect(screen.getByText('v1 → v2')).toBeInTheDocument()
    expect(screen.getByText('标题有改动')).toBeInTheDocument()
    expect(screen.getByText('开场回顾有改动')).toBeInTheDocument()
    expect(screen.getByText('新增 1')).toBeInTheDocument()
    expect(screen.getByText('删除 0')).toBeInTheDocument()
    expect(screen.getByText('修改 1')).toBeInTheDocument()
    expect(screen.getByText('旧')).toBeInTheDocument()
    expect(screen.getByText('新段')).toBeInTheDocument()
  })

  it('没有当前版时以最新一版为右侧，再往上一版为左侧', () => {
    setup({
      versions: versionsHook({
        data: [
          version({ id: 'ver3', version: 3, isCurrent: false, status: 'draft' }),
          version({ id: 'ver2', version: 2, isCurrent: false, status: 'superseded' }),
        ],
      }),
    })

    expect(mockDiff).toHaveBeenLastCalledWith('ep1', 'ver2', 'ver3')
  })

  it('只有一个版本时左侧为空，提示先选两个版本', () => {
    setup({
      versions: versionsHook({
        data: [version({ id: 'ver1', version: 1, isCurrent: false })],
      }),
    })

    expect(mockDiff).toHaveBeenLastCalledWith('ep1', null, 'ver1')
    expect(screen.getByText('选择两个版本即可查看逐段差异。')).toBeInTheDocument()
  })

  it('差异计算失败时保留对比框并显示原因', () => {
    setup({
      diff: { data: null, isFetching: false, error: new Error('diff 挂了') },
    })

    expect(screen.getByText('差异计算失败')).toBeInTheDocument()
    expect(screen.getByText('diff 挂了')).toBeInTheDocument()
  })

  it('手动把两侧选成同一版时提示另选一版', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getAllByRole('combobox')[1])
    await user.click(
      await screen.findByText(/^v1 · 历史版本/, {
        selector: '.ant-select-item-option-content',
      }),
    )

    expect(screen.getByText('两侧是同一个版本，请另选一版。')).toBeInTheDocument()
  })

  it('手动改左侧旧版本也会重新算差异', async () => {
    const user = userEvent.setup()
    setup({
      versions: versionsHook({
        data: [
          publishedCurrent,
          superseded,
          version({ id: 'ver0', version: 0, status: 'superseded', isCurrent: false }),
        ],
      }),
    })

    await user.click(screen.getAllByRole('combobox')[0])
    await user.click(
      await screen.findByText(/^v0 · 历史版本/, {
        selector: '.ant-select-item-option-content',
      }),
    )

    expect(mockDiff).toHaveBeenLastCalledWith('ep1', 'ver0', 'ver2')
  })

  it('清空新版本选择后回到「先选两个版本」的提示', async () => {
    const user = userEvent.setup()
    setup()

    const clear = document.querySelectorAll('.ant-select-clear')[1] as Element
    await user.click(clear)

    expect(screen.getByText('选择两个版本即可查看逐段差异。')).toBeInTheDocument()
  })

  it('手动选一个新版本后按选择算差异', async () => {
    const user = userEvent.setup()
    setup({
      versions: versionsHook({ data: [publishedCurrent, superseded, version({
        id: 'ver0',
        version: 0,
        status: 'superseded',
        isCurrent: false,
      })] }),
    })

    await user.click(screen.getAllByRole('combobox')[1])
    await user.click(
      await screen.findByText(/^v0 · 历史版本/, {
        selector: '.ant-select-item-option-content',
      }),
    )

    expect(mockDiff).toHaveBeenLastCalledWith('ep1', 'ver1', 'ver0')
  })
})

describe('VersionHistory 快照预览', () => {
  it('点「查看内容」按版本 id 拉快照并展示在弹窗里', async () => {
    const user = userEvent.setup()
    setup({
      version: {
        data: {
          meta: version({ id: 'ver2', version: 2 }),
          content: {
            title: '听风原野第一天',
            recap: null,
            segments: [{ order: 0, kind: 'narration', text: '快照里的旁白' }],
          },
        },
        isFetching: false,
        error: null,
      },
    })

    await user.click(screen.getAllByText('查看内容')[0])

    expect(await screen.findByText('v2 快照内容 · 当前发布版')).toBeInTheDocument()
    expect(screen.getByText('快照里的旁白')).toBeInTheDocument()

    fireEvent.click(document.querySelector('.ant-modal-close') as HTMLElement)
    // jsdom 不跑动画，antd 关弹窗只留下离场类名；断言它已开始离开即可
    await waitFor(() =>
      expect(document.querySelector('.ant-modal')).toHaveClass('ant-zoom-leave'),
    )
  })

  it('挂载时带 initialVersionId 直接打开该版快照', async () => {
    setup({
      initialVersionId: 'ver1',
      version: {
        data: {
          meta: version({
            id: 'ver1',
            version: 1,
            status: 'superseded',
            isCurrent: false,
          }),
          content: {
            title: '听风原野第一天',
            recap: null,
            segments: [
              { order: 0, kind: 'narration', text: '深链进来的快照旁白' },
            ],
          },
        },
        isFetching: false,
        error: null,
      },
    })

    expect(
      await screen.findByText('v1 快照内容 · 历史版本'),
    ).toBeInTheDocument()
    expect(screen.getByText('深链进来的快照旁白')).toBeInTheDocument()
    expect(mockVersion).toHaveBeenCalledWith('ep1', 'ver1')
  })

  it('关闭深链快照时通知外层一次，且不重复弹', async () => {
    const onPreviewClosed = vi.fn()
    setup({
      initialVersionId: 'ver1',
      onPreviewClosed,
      version: {
        data: {
          meta: version({
            id: 'ver1',
            version: 1,
            status: 'superseded',
            isCurrent: false,
          }),
          content: {
            title: '听风原野第一天',
            recap: null,
            segments: [],
          },
        },
        isFetching: false,
        error: null,
      },
    })

    expect(
      await screen.findByText('v1 快照内容 · 历史版本'),
    ).toBeInTheDocument()
    fireEvent.click(document.querySelector('.ant-modal-close') as HTMLElement)

    expect(onPreviewClosed).toHaveBeenCalledTimes(1)
    await waitFor(() =>
      expect(document.querySelector('.ant-modal')).toHaveClass('ant-zoom-leave'),
    )
  })

  it('快照还在加载时显示通用标题，失败时显示原因', async () => {
    const user = userEvent.setup()
    const { rerender } = setup()

    await user.click(screen.getAllByText('查看内容')[0])
    expect(await screen.findByText('版本快照内容')).toBeInTheDocument()

    mockVersion.mockReturnValue({
      data: null,
      isFetching: false,
      error: new Error('快照挂了'),
    })
    rerender(<VersionHistory episodeId="ep1" />)
    await user.click(screen.getAllByText('查看内容')[0])
    expect(await screen.findByText('快照加载失败')).toBeInTheDocument()
    expect(screen.getByText('快照挂了')).toBeInTheDocument()
  })
})

describe('VersionHistory 快速回滚', () => {
  it('只有 authoring 且状态可回滚、非当前版时才出现入口', () => {
    setup()

    expect(screen.getByText('回滚到这一版')).toBeInTheDocument()
  })

  it('回滚弹窗要求理由与业务键双确认，提交时带上目标版本', async () => {
    const user = userEvent.setup()
    const mutate = vi.fn()
    setup({ revert: revertHook({ mutate }) })

    await clickPageLink('回滚到这一版')

    expect(await screen.findByText('回滚到 v1（历史版本）')).toBeInTheDocument()
    const ok = screen.getByRole('button', { name: /确认回滚并发布/ })
    expect(ok).toBeDisabled()

    await user.type(
      screen.getByPlaceholderText(/半年后别人/),
      '出事之后回到前一天那版',
    )
    expect(ok).toBeDisabled()

    await user.type(screen.getByPlaceholderText('elly/1/1'), 'elly/1/1')
    await waitFor(() => expect(ok).toBeEnabled())
    await user.click(ok)

    expect(mutate).toHaveBeenCalledWith(
      {
        episodeId: 'ep1',
        targetVersionId: 'ver1',
        reason: '出事之后回到前一天那版',
        confirmText: 'elly/1/1',
      },
      expect.any(Object),
    )
  })

  it('回滚成功但草稿仍在时提醒「下一次发布仍会覆盖它」', async () => {
    const user = userEvent.setup()
    const mutate = vi.fn((_payload, options: { onSuccess: (r: unknown) => void }) => {
      options.onSuccess({
        revertedToVersion: 1,
        newVersion: 3,
        draftStillPending: true,
      })
    })
    setup({ revert: revertHook({ mutate }) })

    await clickPageLink('回滚到这一版')
    await user.type(
      await screen.findByPlaceholderText(/半年后别人/),
      '回到前一天那版并保留草稿',
    )
    await user.type(screen.getByPlaceholderText('elly/1/1'), 'elly/1/1')
    await user.click(screen.getByRole('button', { name: /确认回滚并发布/ }))

    expect(
      await screen.findByText(/注意——你的草稿还在/),
    ).toBeInTheDocument()
  })

  it('回滚成功后给出成功提示，且提示可关闭', async () => {
    const user = userEvent.setup()
    const mutate = vi.fn((_payload, options: { onSuccess: (r: unknown) => void }) => {
      options.onSuccess({
        revertedToVersion: 1,
        newVersion: 3,
        draftStillPending: false,
      })
    })
    setup({ revert: revertHook({ mutate }) })

    await clickPageLink('回滚到这一版')
    await user.type(
      await screen.findByPlaceholderText(/半年后别人/),
      '回到前一天那一版内容',
    )
    await user.type(screen.getByPlaceholderText('elly/1/1'), 'elly/1/1')
    await user.click(screen.getByRole('button', { name: /确认回滚并发布/ }))

    await waitFor(() => {
      const alerts = Array.from(document.querySelectorAll('.ant-alert'))
      expect(
        alerts.some((node) =>
          node.textContent?.includes(
            '已回滚：v1 的内容被复制成 v3 并发布为当前版本。',
          ),
        ),
      ).toBe(true)
    })

    const closeIcon = document.querySelector('.ant-alert-close-icon') as HTMLElement
    await user.click(closeIcon)
    await waitFor(() =>
      expect(screen.queryByText(/已回滚：v1 的内容/)).toBeNull(),
    )
  })

  it('服务端拒绝时错误留在弹窗内，不吞掉已填的理由', async () => {
    setup({
      revert: revertHook({
        error: apiError('目标版本不可回滚', {
          domainCode: 'VERSION_NOT_REVERTABLE',
          status: 409,
        }),
      }),
    })

    await clickPageLink('回滚到这一版')

    expect(await screen.findByText('服务端拒绝了这次操作')).toBeInTheDocument()
    expect(screen.getByText('目标版本不可回滚')).toBeInTheDocument()
    expect(screen.getByText('VERSION_NOT_REVERTABLE')).toBeInTheDocument()
  })

  it('回滚弹窗可以取消，取消后不会发请求', async () => {
    const user = userEvent.setup()
    const mutate = vi.fn()
    setup({ revert: revertHook({ mutate }) })

    await clickPageLink('回滚到这一版')
    expect(await screen.findByText('回滚到 v1（历史版本）')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /取\s*消/ }))
    await waitFor(() =>
      expect(screen.queryByText('回滚到 v1（历史版本）')).toBeNull(),
    )
    expect(mutate).not.toHaveBeenCalled()
  })

  it('该集详情还没回来时不渲染回滚弹窗（避免拿不到业务键与影响面）', async () => {
    setup({ detail: null })

    await clickPageLink('回滚到这一版')

    expect(screen.queryByText('回滚到 v1（历史版本）')).toBeNull()
  })
})
