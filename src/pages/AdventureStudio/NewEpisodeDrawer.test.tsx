import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NewEpisodeDrawer from './NewEpisodeDrawer'
import type { CapabilitiesResponse, ScriptConvertResult } from '../../types/adventureAdmin'
import {
  useAdventureLint,
  useAdventureNextEpisodeNumber,
  useAdventureScriptConvert,
  useCreateAdventureEpisode,
} from '../../api/queries'

vi.mock('../../api/queries', () => ({
  useAdventureLint: vi.fn(),
  useAdventureNextEpisodeNumber: vi.fn(),
  useAdventureScriptConvert: vi.fn(),
  useCreateAdventureEpisode: vi.fn(),
}))

vi.mock('./EpisodeEditor', () => ({
  default: (props: {
    value: { title: string; segments: unknown[] }
    onChange: (next: { title: string; recap: null; segments: unknown[] }) => void
  }) => (
    <div data-testid="editor">
      {props.value.title || '（空标题）'}|{props.value.segments.length}
      <button
        onClick={() =>
          props.onChange({
            title: `手填标题${props.value.segments.length}`,
            recap: null,
            segments: [],
          })
        }
      >
        改标题
      </button>
    </div>
  ),
}))

vi.mock('./PreviewSimulator', () => ({
  default: (props: {
    identity: { characterKey: string; episodeNumber: number }
    content: { title: string }
  }) => (
    <div data-testid="simulator">
      {props.identity.characterKey}/{props.identity.episodeNumber}/
      {props.content.title}
    </div>
  ),
}))

const mockLint = useAdventureLint as unknown as ReturnType<typeof vi.fn>
const mockNextNumber =
  useAdventureNextEpisodeNumber as unknown as ReturnType<typeof vi.fn>
const mockConvert = useAdventureScriptConvert as unknown as ReturnType<typeof vi.fn>
const mockCreate = useCreateAdventureEpisode as unknown as ReturnType<typeof vi.fn>

const capabilities: CapabilitiesResponse = {
  season: 1,
  characterKeys: ['elly', 'polly'],
  interactionTypes: ['open_question', 'two_choice', 'repeat_after_me', 'reward'],
  replyWaitingInteractionTypes: ['open_question', 'two_choice', 'repeat_after_me'],
  segmentKinds: ['narration', 'interaction'],
  lintThresholds: {
    maxInteractionTextChars: 60,
    maxNarrationTextChars: 220,
    maxTitleChars: 24,
    maxStarsPerEpisode: 3,
    minChoiceTextChars: 2,
    forbiddenWords: [],
  },
  simulationThresholds: { maxAwaitPoints: 12, maxSessionSeconds: 900 },
  fixedExitText: '不想玩了。',
  profile: 'authoring',
  authoring: true,
  testStoryEnabled: false,
}

const okLint = { ok: true, issues: [], errors: [], warnings: [] }

function converted(overrides: Partial<ScriptConvertResult> = {}): ScriptConvertResult {
  return {
    characterKey: 'polly',
    characterDetected: true,
    season: 1,
    episodeNumber: 9,
    content: {
      title: '从 docx 来的标题',
      recap: null,
      segments: [{ order: 0, kind: 'narration', text: '第一段' }],
    },
    sourceText: '正文第一段',
    lint: okLint,
    ...overrides,
  }
}

const seed: ScriptConvertResult = converted({
  characterDetected: false,
  episodeNumber: 3,
  characterKey: 'elly',
})

function lintHook(overrides: Record<string, unknown> = {}) {
  return {
    mutate: vi.fn(),
    isPending: false,
    error: null,
    ...overrides,
  }
}

function convertHook(overrides: Record<string, unknown> = {}) {
  return {
    mutate: vi.fn(),
    reset: vi.fn(),
    isPending: false,
    error: null,
    ...overrides,
  }
}

function createHook(overrides: Record<string, unknown> = {}) {
  return {
    mutate: vi.fn(),
    isPending: false,
    error: null,
    ...overrides,
  }
}

function setup(options?: {
  seed?: ScriptConvertResult | null
  next?: Record<string, unknown>
  lint?: Record<string, unknown>
  convert?: Record<string, unknown>
  create?: Record<string, unknown>
  onCreated?: (episodeId: string) => void
}) {
  const onClose = vi.fn()
  const onCreated = options?.onCreated ?? vi.fn()
  mockNextNumber.mockReturnValue(
    options?.next ?? { data: { characterKey: 'elly', season: 1, episodeNumber: 5 } },
  )
  mockLint.mockReturnValue(options?.lint ?? lintHook())
  mockConvert.mockReturnValue(options?.convert ?? convertHook())
  mockCreate.mockReturnValue(options?.create ?? createHook())
  const view = render(
    <NewEpisodeDrawer
      open
      seed={options && 'seed' in options ? (options.seed ?? null) : null}
      capabilities={capabilities}
      onClose={onClose}
      onCreated={onCreated}
    />,
  )
  return { onClose, onCreated, ...view }
}

beforeEach(() => {
  mockLint.mockReset()
  mockNextNumber.mockReset()
  mockConvert.mockReset()
  mockCreate.mockReset()
})

async function uploadDocx() {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  const file = new File(['hello'], 'script.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
  fireEvent.change(input, { target: { files: [file] } })
}

function clickDrawerClose() {
  ;(document.querySelector('.ant-drawer-close') as HTMLElement).click()
}

describe('NewEpisodeDrawer 手动新建', () => {
  it('手动模式自动取下一集号，并展示即将占用的业务键', () => {
    setup()

    expect(screen.getByText('新建故事集')).toBeInTheDocument()
    expect(screen.getAllByText('elly/1/5').length).toBeGreaterThan(0)
    expect(screen.getByRole('spinbutton')).toHaveValue('5')
    expect(screen.getByText('第 1 季')).toBeInTheDocument()
    expect(screen.getByTestId('editor')).toHaveTextContent('（空标题）|0')
    expect(screen.queryByText('没识别出这一集的主角，已默认小象 Elly')).toBeNull()
  })

  it('取不到自增集号时业务键未知，校验/存草稿/试播全部禁用', () => {
    setup({ next: { data: undefined } })

    expect(screen.queryByText(/elly\/1\//)).toBeNull()
    expect(screen.getByText(/填好集号后显示/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /校\s*验/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /存\s*草\s*稿/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /试\s*播/ })).toBeDisabled()
  })

  it('换主角会按新 IP 重新取集号，业务键随之变化', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getAllByRole('combobox')[0])
    await user.click(
      await screen.findByText('小马 Polly（polly）', {
        selector: '.ant-select-item-option-content',
      }),
    )

    expect(mockNextNumber).toHaveBeenLastCalledWith('polly')
    expect(screen.getAllByText('polly/1/5').length).toBeGreaterThan(0)
  })

  it('手填集号覆盖自增值，并直接决定业务键', async () => {
    const user = userEvent.setup()
    setup()

    const input = screen.getByRole('spinbutton')
    await user.clear(input)
    await user.type(input, '7')

    expect(screen.getAllByText('elly/1/7').length).toBeGreaterThan(0)
  })

  it('编辑内容后「校验」按发布标准调一次接口，并把结果留在面板上', async () => {
    const user = userEvent.setup()
    const mutate = vi.fn((_payload, options: { onSuccess: (r: unknown) => void }) => {
      options.onSuccess({
        ok: true,
        issues: [
          {
            severity: 'warning',
            code: 'TEXT_LONG',
            message: '旁白偏长',
            businessKey: 'elly/1/5',
          },
        ],
        errors: [],
        warnings: [
          {
            severity: 'warning',
            code: 'TEXT_LONG',
            message: '旁白偏长',
            businessKey: 'elly/1/5',
          },
        ],
      })
    })
    setup({ lint: lintHook({ mutate }) })

    await user.click(screen.getByRole('button', { name: /改标题/ }))
    expect(screen.getByTestId('editor')).toHaveTextContent('手填标题0|0')

    await user.click(screen.getByRole('button', { name: /校\s*验/ }))
    expect(mutate).toHaveBeenCalledWith(
      {
        identity: { characterKey: 'elly', season: 1, episodeNumber: 5 },
        content: { title: '手填标题0', recap: null, segments: [] },
        forPublish: true,
      },
      expect.any(Object),
    )
    expect(await screen.findByText('旁白偏长')).toBeInTheDocument()
  })

  it('存草稿走理由弹窗，成功后把新 episodeId 交给上层', async () => {
    const user = userEvent.setup()
    const onCreated = vi.fn()
    const mutate = vi.fn((_payload, options: { onSuccess: (r: unknown) => void }) => {
      options.onSuccess({ episodeId: 'ep-new' })
    })
    setup({ create: createHook({ mutate }), onCreated })

    await user.click(screen.getByRole('button', { name: /存\s*草\s*稿/ }))
    await waitFor(() =>
      expect(document.querySelector('.ant-modal')).not.toBeNull(),
    )
    const dialog = document.querySelector('.ant-modal') as HTMLElement
    expect(within(dialog).getByText('新建故事集')).toBeInTheDocument()
    expect(
      within(dialog).getByText(/会创建一集草稿（业务键 elly\/1\/5）/),
    ).toBeInTheDocument()

    await user.type(
      within(dialog).getByPlaceholderText(/半年后别人/),
      '开一集新的听风原野故事',
    )
    await user.click(within(dialog).getByRole('button', { name: /存\s*草\s*稿/ }))

    expect(mutate).toHaveBeenCalledWith(
      {
        identity: { characterKey: 'elly', season: 1, episodeNumber: 5 },
        content: { title: '', recap: null, segments: [] },
        reason: '开一集新的听风原野故事',
      },
      expect.any(Object),
    )
    expect(onCreated).toHaveBeenCalledWith('ep-new')
  })

  it('存草稿失败时错误留在弹窗里', async () => {
    const user = userEvent.setup()
    setup({
      create: createHook({
        error: Object.assign(new Error('业务键已被占用'), {
          domainCode: 'BUSINESS_KEY_TAKEN',
          status: 409,
        }),
      }),
    })

    await user.click(screen.getByRole('button', { name: /存\s*草\s*稿/ }))

    expect(await screen.findByText('服务端拒绝了这次操作')).toBeInTheDocument()
    expect(screen.getByText('业务键已被占用')).toBeInTheDocument()
    expect(screen.getByText('BUSINESS_KEY_TAKEN')).toBeInTheDocument()
  })

  it('试播弹窗按当前身份与内容渲染，不写库，关闭后不再渲染', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole('button', { name: /试\s*播/ }))
    expect(await screen.findByTestId('simulator')).toHaveTextContent('elly/5/')

    fireEvent.click(document.querySelector('.ant-modal-close') as HTMLElement)
    await waitFor(() =>
      expect(document.querySelector('.ant-modal')).toHaveClass('ant-zoom-leave'),
    )
  })

  it('存草稿弹窗可以取消，取消后不发创建请求', async () => {
    const user = userEvent.setup()
    const create = createHook()
    setup({ create })

    await user.click(screen.getByRole('button', { name: /存\s*草\s*稿/ }))
    await waitFor(() =>
      expect(document.querySelector('.ant-modal')).not.toBeNull(),
    )
    const dialog = document.querySelector('.ant-modal') as HTMLElement
    await user.click(within(dialog).getByRole('button', { name: /取\s*消/ }))

    expect(create.mutate).not.toHaveBeenCalled()
  })
})

describe('NewEpisodeDrawer docx 生成草稿', () => {
  it('seed 模式展示转换结果、主角识别告警与原文回看', () => {
    setup({ seed })

    expect(screen.getByText('生成草稿预览')).toBeInTheDocument()
    expect(
      screen.getByText('没识别出这一集的主角，已默认小象 Elly'),
    ).toBeInTheDocument()
    expect(screen.getByText('原文回看')).toBeInTheDocument()
    expect(screen.getByText('正文第一段')).toBeInTheDocument()
    expect(screen.getAllByText('elly/1/3').length).toBeGreaterThan(0)
    expect(screen.getByTestId('editor')).toHaveTextContent('从 docx 来的标题|1')
  })

  it('「从 docx 填充」在空表单上直接生效，不需要二次确认', async () => {
    const convert = convertHook({
      mutate: vi.fn((_payload, options: { onSuccess: (r: unknown) => void }) => {
        options.onSuccess(converted())
      }),
    })
    setup({ next: { data: undefined }, convert })

    await uploadDocx()

    await waitFor(() =>
      expect(screen.getByTestId('editor')).toHaveTextContent('从 docx 来的标题|1'),
    )
    expect(screen.getAllByText('polly/1/9').length).toBeGreaterThan(0)
    expect(screen.getByText('正文第一段')).toBeInTheDocument()
    expect(mockConvert.mock.results[0]?.value.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: 'script.docx' }),
      expect.any(Object),
    )
  })

  it('已有内容时上传先确认，取消则一个字都不覆盖', async () => {
    const user = userEvent.setup()
    const convert = convertHook({
      mutate: vi.fn((_payload, options: { onSuccess: (r: unknown) => void }) => {
        options.onSuccess(converted())
      }),
    })
    setup({ seed, convert })

    await uploadDocx()
    expect(
      await screen.findByText('上传会覆盖当前表单'),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /取\s*消/ }))
    expect(screen.getByTestId('editor')).toHaveTextContent('从 docx 来的标题|1')
    expect(screen.getAllByText('elly/1/3').length).toBeGreaterThan(0)
  })

  it('确认覆盖后整份填充主角、集号、标题与原文', async () => {
    const user = userEvent.setup()
    const convert = convertHook({
      mutate: vi.fn((_payload, options: { onSuccess: (r: unknown) => void }) => {
        options.onSuccess(converted())
      }),
    })
    setup({ seed, convert })

    await uploadDocx()
    await user.click(
      await screen.findByRole('button', { name: /覆盖并填充/ }),
    )

    await waitFor(() =>
      expect(screen.getByTestId('editor')).toHaveTextContent('从 docx 来的标题|1'),
    )
    expect(screen.getAllByText('polly/1/9').length).toBeGreaterThan(0)
  })
})

describe('NewEpisodeDrawer 关闭保护', () => {
  it('空表单直接关闭', () => {
    const { onClose } = setup()

    clickDrawerClose()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('已有内容时关闭要先确认，「留在这一页」不关也不丢', async () => {
    const user = userEvent.setup()
    const { onClose } = setup()

    await user.click(screen.getByRole('button', { name: /改标题/ }))
    clickDrawerClose()

    expect(await screen.findByText('有未保存的草稿内容')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /留在这一页/ }))
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByTestId('editor')).toHaveTextContent('手填标题0|0')
  })

  it('确认「丢弃并关闭」后调用 onClose', async () => {
    const user = userEvent.setup()
    const { onClose } = setup()

    await user.click(screen.getByRole('button', { name: /改标题/ }))
    clickDrawerClose()
    await user.click(await screen.findByRole('button', { name: /丢弃并关闭/ }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('seed 自带内容也算「有内容」，关闭时一样要确认', async () => {
    const user = userEvent.setup()
    setup({ seed })

    clickDrawerClose()
    expect(await screen.findByText('有未保存的草稿内容')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /留在这一页/ }))
  })
})
