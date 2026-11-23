import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ImportExport from './ImportExport'
import type {
  AdventureBundle,
  ExportResult,
  ImportApplyResult,
  ImportPreview,
} from '../../types/adventureAdmin'
import {
  useAdventureAuthoring,
  useAdventureEpisodes,
  useAdventureExport,
  useAdventureImport,
  useAdventureImportPreview,
} from '../../api/queries'

vi.mock('../../api/queries', () => ({
  useAdventureAuthoring: vi.fn(),
  useAdventureEpisodes: vi.fn(),
  useAdventureExport: vi.fn(),
  useAdventureImport: vi.fn(),
  useAdventureImportPreview: vi.fn(),
}))

const mockAuthoring = useAdventureAuthoring as unknown as ReturnType<typeof vi.fn>
const mockEpisodes = useAdventureEpisodes as unknown as ReturnType<typeof vi.fn>
const mockExport = useAdventureExport as unknown as ReturnType<typeof vi.fn>
const mockPreview = useAdventureImportPreview as unknown as ReturnType<typeof vi.fn>
const mockImport = useAdventureImport as unknown as ReturnType<typeof vi.fn>

const bundle: AdventureBundle = {
  bundleSchemaVersion: 1,
  exportedAt: '2026-11-20T10:00:00.000Z',
  sourceProfile: 'authoring',
  episodes: [
    {
      characterKey: 'elly',
      season: 1,
      episodeNumber: 1,
      title: '听风原野第一天',
      recap: null,
      segments: [],
    },
  ],
}

const bundleText = JSON.stringify(bundle)

function exportResult(overrides: Partial<ExportResult> = {}): ExportResult {
  return {
    bundle,
    bundleHash: 'abcdef0123456789abcdef',
    confirmToken: 'TOKEN-EXPORT',
    episodeCount: 1,
    skipped: [],
    ...overrides,
  }
}

function previewResult(overrides: Partial<ImportPreview> = {}): ImportPreview {
  return {
    ok: true,
    bundleHash: 'abcdef0123456789abcdef',
    confirmToken: 'TOKEN-IMPORT',
    plan: {
      ok: true,
      bundleHash: 'abcdef0123456789abcdef',
      items: [],
      adds: 0,
      replaces: 0,
      upToDate: 0,
      rejects: 0,
    },
    parseErrors: [],
    parseWarnings: [],
    message: '计划可以导入',
    ...overrides,
  }
}

function importResult(overrides: Partial<ImportApplyResult> = {}): ImportApplyResult {
  return {
    bundleHash: 'abcdef0123456789abcdef',
    confirmToken: 'TOKEN-IMPORT',
    plan: previewResult().plan,
    written: [
      {
        businessKey: 'elly/1/1',
        action: 'add',
        episodeId: 'ep1',
        versionId: 'ver1',
        version: 1,
      },
    ],
    skipped: [],
    message: '全部写入草稿',
    ...overrides,
  }
}

function exportHook(overrides: Record<string, unknown> = {}) {
  return {
    data: undefined,
    error: null,
    isPending: false,
    mutate: vi.fn(),
    ...overrides,
  }
}

function previewHook(overrides: Record<string, unknown> = {}) {
  return {
    data: undefined,
    error: null,
    isPending: false,
    mutate: vi.fn(),
    reset: vi.fn(),
    ...overrides,
  }
}

function importHook(overrides: Record<string, unknown> = {}) {
  return {
    data: undefined,
    error: null,
    isPending: false,
    mutate: vi.fn(),
    reset: vi.fn(),
    ...overrides,
  }
}

function setup(options?: {
  authoring?: boolean
  episodes?: Record<string, unknown>
  export?: Record<string, unknown>
  preview?: Record<string, unknown>
  import?: Record<string, unknown>
}) {
  mockAuthoring.mockReturnValue(options?.authoring ?? true)
  mockEpisodes.mockReturnValue(
    options?.episodes ?? {
      data: {
        items: [
          {
            id: 'ep1',
            characterKey: 'elly',
            season: 1,
            episodeNumber: 1,
            businessKey: 'elly/1/1',
            title: '听风原野第一天',
            recap: null,
            published: true,
            retiredAt: null,
            currentVersionId: 'v1',
            currentVersion: 1,
            publishedAt: '2026-11-20T10:00:00.000Z',
            hasDraft: false,
            draftVersionId: null,
            draftVersion: null,
            draftUpdatedAt: null,
            draftUpdatedBy: null,
            createdAt: '2026-11-01T10:00:00.000Z',
            updatedAt: '2026-11-20T10:00:00.000Z',
          },
        ],
        total: 1,
      },
      isLoading: false,
      error: null,
    },
  )
  mockExport.mockReturnValue(options?.export ?? exportHook())
  mockPreview.mockReturnValue(options?.preview ?? previewHook())
  mockImport.mockReturnValue(options?.import ?? importHook())
  return render(<ImportExport />)
}

function apiError(message: string, extra: Record<string, unknown> = {}) {
  return Object.assign(new Error(message), extra)
}

function importTextarea() {
  return screen.getByPlaceholderText(/bundleSchemaVersion/)
}

beforeEach(() => {
  mockAuthoring.mockReset()
  mockEpisodes.mockReset()
  mockExport.mockReset()
  mockPreview.mockReset()
  mockImport.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ImportExport 导出', () => {
  it('只读环境禁用导出并说明「导出会写审计」', () => {
    setup({ authoring: false })

    expect(screen.getByText('只读环境不能导出')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /导出 bundle/ })).toBeDisabled()
    expect(mockEpisodes).toHaveBeenLastCalledWith({
      pageSize: 200,
      includeRetired: true,
    })
  })

  it('不选集时导出全部，并带上「包含已下架」开关', async () => {
    const user = userEvent.setup()
    const mutate = vi.fn()
    setup({ export: exportHook({ mutate }) })

    await user.click(screen.getByLabelText('包含已下架的集'))
    await user.click(screen.getByRole('button', { name: /导出 bundle/ }))

    expect(mutate).toHaveBeenCalledWith({
      episodeIds: undefined,
      includeRetired: true,
    })
  })

  it('指定故事集导出时把 id 数组传给后端', async () => {
    const user = userEvent.setup()
    const mutate = vi.fn()
    setup({ export: exportHook({ mutate }) })

    await user.click(screen.getAllByRole('combobox')[0])
    await user.click(
      await screen.findByText('elly/1/1 · 听风原野第一天', {
        selector: '.ant-select-item-option-content',
      }),
    )
    await user.click(screen.getByRole('button', { name: /导出 bundle/ }))

    expect(mutate).toHaveBeenCalledWith({
      episodeIds: ['ep1'],
      includeRetired: undefined,
    })
  })

  it('导出结果展示集数、被跳过项、哈希与确认码', () => {
    setup({
      export: exportHook({
        data: exportResult({
          skipped: [
            { businessKey: 'elly/1/2', reason: '从未发布过' },
            { businessKey: 'elly/1/3', reason: '已下架' },
          ],
        }),
      }),
    })

    expect(screen.getByText('导出集数')).toBeInTheDocument()
    expect(screen.getByText('被跳过')).toBeInTheDocument()
    expect(screen.getByText('这些集没有被导出')).toBeInTheDocument()
    expect(screen.getByText(/从未发布过/)).toBeInTheDocument()
    expect(screen.getAllByText(/已下架/).length).toBeGreaterThan(0)
    expect(screen.getByText('abcdef012345…')).toBeInTheDocument()
    expect(screen.getByText('TOKEN-EXPORT')).toBeInTheDocument()
  })

  it('复制成功切到「已复制到剪贴板」并收起文本框', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    setup({ export: exportHook({ data: exportResult() }) })

    const exportCard = document.querySelector('.ant-card') as HTMLElement
    expect(within(exportCard).getByRole('textbox')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '复制 JSON' }))

    expect(writeText).toHaveBeenCalledWith(
      JSON.stringify(exportResult().bundle, null, 2),
    )
    expect(
      await screen.findByRole('button', { name: '已复制到剪贴板' }),
    ).toBeInTheDocument()
    expect(within(exportCard).queryByRole('textbox')).toBeNull()
  })

  it('剪贴板不可用时留在「复制 JSON」，并保留可手动选的文本框', async () => {
    const user = userEvent.setup()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockRejectedValue(new Error('not allowed')),
      },
    })
    setup({ export: exportHook({ data: exportResult() }) })

    await user.click(screen.getByRole('button', { name: '复制 JSON' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: '复制 JSON' })).toBeInTheDocument(),
    )
    const exportCard = document.querySelector('.ant-card') as HTMLElement
    expect(within(exportCard).getByRole('textbox')).toBeInTheDocument()
  })

  it('下载 JSON 文件名带上集数，点文本框会全选内容', async () => {
    const user = userEvent.setup()
    const createObjectURL = vi.fn(() => 'blob:mock')
    const revokeObjectURL = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURL,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURL,
    })
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined)
    setup({ export: exportHook({ data: exportResult() }) })

    await user.click(screen.getByRole('button', { name: '下载 JSON' }))

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(anchorClick).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock')

    const exportCard = document.querySelector('.ant-card') as HTMLElement
    const textarea = within(exportCard).getByRole('textbox') as HTMLTextAreaElement
    const select = vi.spyOn(textarea, 'select')
    fireEvent.focus(textarea)
    expect(select).toHaveBeenCalled()
  })

  it('导出失败时显示错误码，方便对照服务端拒绝原因', () => {
    setup({
      export: exportHook({
        error: apiError('只读环境不能导出', {
          domainCode: 'READONLY_PROFILE',
          status: 403,
        }),
      }),
    })

    expect(screen.getByText('导出失败')).toBeInTheDocument()
    expect(screen.getByText('只读环境不能导出')).toBeInTheDocument()
    expect(screen.getByText('READONLY_PROFILE')).toBeInTheDocument()
  })
})

describe('ImportExport 导入的解析与预览', () => {
  it('空内容不发预览请求，也不报解析错误', () => {
    setup()

    expect(screen.getByRole('button', { name: /预览/ })).toBeDisabled()
    expect(screen.queryByText('bundle 无法解析')).toBeNull()
  })

  it('JSON 语法错误就地提示，不会把坏 JSON 当 bundle 发出去', async () => {
    setup()

    fireEvent.change(importTextarea(), { target: { value: '{"bundleSchemaVersion":' } })

    expect(await screen.findByText('bundle 无法解析')).toBeInTheDocument()
    expect(screen.getByText(/JSON 解析失败/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /预览/ })).toBeDisabled()
  })

  it('顶层缺 episodes 数组时提示形状不对', async () => {
    setup()

    fireEvent.change(importTextarea(), { target: { value: '{"foo":1}' } })

    expect(
      await screen.findByText('形状不对：顶层必须有 episodes 数组'),
    ).toBeInTheDocument()
  })

  it('清空输入后回到初始态，不残留上一次的解析错误', () => {
    setup()

    fireEvent.change(importTextarea(), { target: { value: '{"foo":1}' } })
    expect(
      screen.getByText('形状不对：顶层必须有 episodes 数组'),
    ).toBeInTheDocument()

    fireEvent.change(importTextarea(), { target: { value: '' } })
    expect(screen.queryByText('bundle 无法解析')).toBeNull()
    expect(screen.getByRole('button', { name: /预览/ })).toBeDisabled()
  })

  it('合法 bundle 可 dry-run，预览展示计划、确认码与逐集表格', async () => {
    const user = userEvent.setup()
    const mutate = vi.fn()
    setup({
      preview: previewHook({
        mutate,
        data: previewResult({
          plan: {
            ok: true,
            bundleHash: 'abcdef0123456789abcdef',
            adds: 1,
            replaces: 1,
            upToDate: 0,
            rejects: 0,
            items: [
              {
                businessKey: 'elly/1/1',
                action: 'add',
                incomingHash: 'hash-new-123456',
                existingHash: null,
              },
              {
                businessKey: 'elly/1/2',
                action: 'replace',
                incomingHash: 'hash-new-234567',
                existingHash: 'hash-old-234567',
                diff: {
                  businessKey: 'elly/1/2',
                  change: 'replaced',
                  titleChanged: false,
                  recapChanged: false,
                  segmentDiffs: [
                    {
                      order: 0,
                      change: 'modified',
                      field: 'text',
                      before: '旧旁白',
                      after: '新旁白',
                    },
                  ],
                },
              },
            ],
          },
        }),
      }),
    })

    fireEvent.change(importTextarea(), { target: { value: bundleText } })
    await user.click(screen.getByRole('button', { name: /预览/ }))

    expect(mutate).toHaveBeenCalledWith(bundle)
    expect(screen.getByText('TOKEN-IMPORT')).toBeInTheDocument()
    expect(screen.getAllByText('新增').length).toBeGreaterThan(0)
    expect(screen.getAllByText('替换').length).toBeGreaterThan(0)
    expect(screen.getByText('已一致')).toBeInTheDocument()
    expect(screen.getByText('计划可以导入')).toBeInTheDocument()
    expect(screen.getByText('—（新集）')).toBeInTheDocument()
    expect(screen.getByText('hash-new-123…')).toBeInTheDocument()

    const expand = document.querySelector(
      '.ant-table-row-expand-icon:not(.ant-table-row-expand-icon-spaced)',
    ) as HTMLElement
    await user.click(expand)
    expect(await screen.findByText('旧旁白')).toBeInTheDocument()
    expect(screen.getByText('新旁白')).toBeInTheDocument()
  })

  it('有 parseErrors 时整批拒绝并禁用确认导入', async () => {
    setup({
      preview: previewHook({
        data: previewResult({
          parseErrors: ['第 2 集段落为空'],
          plan: { ...previewResult().plan, ok: false, rejects: 1 },
        }),
      }),
    })

    fireEvent.change(importTextarea(), { target: { value: bundleText } })

    expect(
      await screen.findByText('bundle 本身不合法，导入会被整批拒绝'),
    ).toBeInTheDocument()
    expect(screen.getByText('第 2 集段落为空')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /确认导入/ })).toBeDisabled()
  })

  it('有警告与 reject 时都摊开说明，确认导入同样禁用', async () => {
    setup({
      preview: previewHook({
        data: previewResult({
          parseWarnings: ['来源环境是 prod'],
          plan: {
            ok: false,
            bundleHash: 'abcdef0123456789abcdef',
            adds: 0,
            replaces: 0,
            upToDate: 0,
            rejects: 1,
            items: [
              {
                businessKey: 'elly/1/2',
                action: 'reject',
                incomingHash: 'hash-new-234567',
                existingHash: 'hash-old-234567',
                reason: '目标环境有未发布的本地草稿',
              },
            ],
          },
        }),
      }),
    })

    fireEvent.change(importTextarea(), { target: { value: bundleText } })

    expect(
      await screen.findByText('bundle 有警告（不拦导入，但请确认是预期的）'),
    ).toBeInTheDocument()
    expect(screen.getByText('来源环境是 prod')).toBeInTheDocument()
    expect(screen.getByText('计划里有 reject，整批不会写入')).toBeInTheDocument()
    expect(
      screen.getByText('目标环境有未发布的本地草稿'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /确认导入/ })).toBeDisabled()
  })

  it('预览失败显示服务端错误与错误码', async () => {
    setup({
      preview: previewHook({
        error: apiError('bundle 结构不合法', {
          domainCode: 'BUNDLE_INVALID',
          status: 400,
        }),
      }),
    })

    fireEvent.change(importTextarea(), { target: { value: bundleText } })

    expect(await screen.findByText('预览失败')).toBeInTheDocument()
    expect(screen.getByText('bundle 结构不合法')).toBeInTheDocument()
    expect(screen.getByText('BUNDLE_INVALID')).toBeInTheDocument()
  })

  it('修改文本框会立刻作废上一次预览与导入结论', async () => {
    const reset = vi.fn()
    const importReset = vi.fn()
    setup({
      preview: previewHook({ reset, data: previewResult() }),
      import: importHook({ reset: importReset }),
    })

    fireEvent.change(importTextarea(), { target: { value: '{}' } })

    expect(reset).toHaveBeenCalled()
    expect(importReset).toHaveBeenCalled()
  })

  it('可以从本地 JSON 文件读入 bundle', async () => {
    const user = userEvent.setup()
    const mutate = vi.fn()
    setup({ preview: previewHook({ mutate }) })

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File([bundleText], 'bundle.json', {
      type: 'application/json',
    })
    Object.defineProperty(file, 'text', {
      value: () => Promise.resolve(bundleText),
    })
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /预览/ })).toBeEnabled(),
    )
    await user.click(screen.getByRole('button', { name: /预览/ }))
    expect(mutate).toHaveBeenCalledWith(bundle)
  })
})

describe('ImportExport 导入确认与结果', () => {
  async function openConfirm() {
    const user = userEvent.setup()
    const preview = previewHook({ data: previewResult() })
    setup({ preview })
    fireEvent.change(importTextarea(), { target: { value: bundleText } })
    await user.click(await screen.findByRole('button', { name: /确认导入/ }))
    await waitFor(() =>
      expect(document.querySelector('.ant-modal')).not.toBeNull(),
    )
    return { user, preview, dialog: document.querySelector('.ant-modal') as HTMLElement }
  }

  it('确认弹窗要求手输确认码，提交时回传预览哈希', async () => {
    const mutate = vi.fn()
    const user = userEvent.setup()
    setup({
      preview: previewHook({ data: previewResult() }),
      import: importHook({ mutate }),
    })

    fireEvent.change(importTextarea(), { target: { value: bundleText } })
    await user.click(await screen.findByRole('button', { name: /确认导入/ }))
    await waitFor(() =>
      expect(document.querySelector('.ant-modal')).not.toBeNull(),
    )
    const dialog = document.querySelector('.ant-modal') as HTMLElement
    expect(within(dialog).getByText('确认导入这一批内容')).toBeInTheDocument()

    const ok = within(dialog).getByRole('button', { name: /确认导入/ })
    expect(ok).toBeDisabled()

    await user.type(
      within(dialog).getByPlaceholderText(/半年后别人/),
      '把 staging 验证过的内容搬到 prod',
    )
    await user.type(within(dialog).getByPlaceholderText('TOKEN-IMPORT'), 'TOKEN-IMPORT')
    await waitFor(() => expect(ok).toBeEnabled())
    await user.click(ok)

    expect(mutate).toHaveBeenCalledWith(
      {
        bundle,
        reason: '把 staging 验证过的内容搬到 prod',
        confirmText: 'TOKEN-IMPORT',
        expectedBundleHash: 'abcdef0123456789abcdef',
      },
      expect.any(Object),
    )
  })

  it('导入成功后列出写入明细并清空输入，防止重复提交', async () => {
    const user = userEvent.setup()
    const reset = vi.fn()
    const mutate = vi.fn((_payload, options: { onSuccess: () => void }) => {
      options.onSuccess()
    })
    setup({
      preview: previewHook({ data: previewResult(), reset }),
      import: importHook({
        mutate,
        data: importResult(),
        reset,
      }),
    })

    fireEvent.change(importTextarea(), { target: { value: bundleText } })
    await user.click(await screen.findByRole('button', { name: /确认导入/ }))
    await waitFor(() =>
      expect(document.querySelector('.ant-modal')).not.toBeNull(),
    )
    const dialog = document.querySelector('.ant-modal') as HTMLElement
    await user.type(
      within(dialog).getByPlaceholderText(/半年后别人/),
      '把 staging 验证过的内容搬到 prod',
    )
    await user.type(within(dialog).getByPlaceholderText('TOKEN-IMPORT'), 'TOKEN-IMPORT')
    await user.click(within(dialog).getByRole('button', { name: /确认导入/ }))

    expect(await screen.findByText('导入完成：写入 1 集草稿')).toBeInTheDocument()
    expect(screen.getByText('全部写入草稿')).toBeInTheDocument()
    expect(screen.getByText(/新增为 v1（草稿）/)).toBeInTheDocument()
    expect((importTextarea() as HTMLTextAreaElement).value).toBe('')
  })

  it('替换动作在成功明细里标「替换」', async () => {
    setup({
      preview: previewHook({ data: previewResult() }),
      import: importHook({
        data: importResult({
          written: [
            {
              businessKey: 'elly/1/2',
              action: 'replace',
              episodeId: 'ep2',
              versionId: 'ver9',
              version: 9,
            },
          ],
        }),
      }),
    })

    fireEvent.change(importTextarea(), { target: { value: bundleText } })

    expect(await screen.findByText(/替换为 v9（草稿）/)).toBeInTheDocument()
  })

  it('导入失败整批未写入，BUNDLE_HASH_MISMATCH 额外提示重新预览', async () => {
    setup({
      preview: previewHook({ data: previewResult() }),
      import: importHook({
        error: apiError('bundle 哈希不一致', {
          domainCode: 'BUNDLE_HASH_MISMATCH',
          status: 409,
        }),
      }),
    })

    fireEvent.change(importTextarea(), { target: { value: bundleText } })

    expect(
      await screen.findByText('导入失败，整批未写入'),
    ).toBeInTheDocument()
    expect(screen.getByText('bundle 哈希不一致')).toBeInTheDocument()
    expect(
      screen.getByText(/你预览的那一份和提交的那一份不是同一个 bundle/),
    ).toBeInTheDocument()
  })

  it('确认弹窗可取消，取消后不发导入请求', async () => {
    const { user, dialog } = await openConfirm()

    await user.click(within(dialog).getByRole('button', { name: /取\s*消/ }))

    expect(mockImport.mock.results[0]?.value.mutate).not.toHaveBeenCalled()
  })
})
