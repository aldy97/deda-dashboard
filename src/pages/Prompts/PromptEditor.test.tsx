import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { apiClient } from '../../api/client'
import { UNKNOWN_ENV_VIEW, resolveEnvTag } from '../../components/env'
import PromptEditor from './PromptEditor'
import type { PromptDetail, PromptVersionItem } from '../../types/analytics'

/**
 * PromptEditor 的行为契约。
 *
 * 这里 mock 的是 apiClient（不是 hooks），所以「mutation 成功后三处缓存失效 →
 * 表单按新指针重挂载 → 输入框显示服务端真相」这条链路是真实跑通的。
 * 重点盯三件容易错的事：
 * 1. 发布的是**已保存的草稿**，有未保存改动时发布按钮必须禁用；
 * 2. 保存/发布的成功提示不能因为表单重挂载而瞬间消失；
 * 3. 服务端报错（409 乐观锁 / 400 确认码）要给出可操作的提示，弹窗不能静默关掉。
 */
vi.mock('../../api/client', () => ({
  apiClient: { get: vi.fn(), patch: vi.fn(), post: vi.fn() },
}))

const mockGet = apiClient.get as unknown as ReturnType<typeof vi.fn>
const mockPatch = apiClient.patch as unknown as ReturnType<typeof vi.fn>
const mockPost = apiClient.post as unknown as ReturnType<typeof vi.fn>

const KEY = 'persona_elly'
const CODE = 'DEDA2025'
const STAGING = resolveEnvTag('staging')
const DEFAULT_CONTENT = '你是小象 Elly。\n要温柔。'

function makeDetail(overrides: Partial<PromptDetail> = {}): PromptDetail {
  return {
    key: KEY,
    category: 'persona',
    scene: 'chat_main',
    name: '小象 Elly 人设',
    description: '主链路角色人设，注入主模型 system。',
    variables: [
      { name: 'childName', required: true, description: '孩子昵称' },
      { name: 'contextSection', required: false, description: '可选上下文段' },
    ],
    maxChars: 20_000,
    defaultContent: DEFAULT_CONTENT,
    effectiveContent: DEFAULT_CONTENT,
    source: 'default',
    publishedRevision: null,
    draftRevision: null,
    publishedAt: null,
    publishedBy: null,
    deviatesFromDefault: false,
    draftContent: null,
    draftChangeNote: null,
    publishedContent: null,
    discardedDraftRevision: null,
    ...overrides,
  }
}

interface FailSpec {
  status: number
  message: string
}

/** 有状态的服务端替身：写操作会真的改动后续 GET 的返回值 */
function fakeServer(initial: PromptDetail, versions: PromptVersionItem[] = []) {
  const state = {
    detail: initial,
    versions,
    patches: [] as Array<{ url: string; body: Record<string, unknown> }>,
    posts: [] as Array<{ url: string; body: Record<string, unknown> }>,
    failNext: null as FailSpec | null,
  }

  const reject = (spec: FailSpec) => {
    const err = new Error(spec.message) as Error & { status?: number }
    err.status = spec.status
    return Promise.reject(err)
  }

  mockGet.mockImplementation((url: string) => {
    if (url.endsWith('/versions')) {
      return Promise.resolve({ data: state.versions })
    }
    return Promise.resolve({ data: state.detail })
  })

  mockPatch.mockImplementation(
    (url: string, body: Record<string, unknown>) => {
      state.patches.push({ url, body })
      if (state.failNext) return reject(state.failNext)
      const revision = (state.detail.draftRevision ?? 0) + 1
      state.versions = [
        {
          revision,
          content: String(body.content),
          changeNote: (body.changeNote as string | undefined) ?? null,
          authorUsername: 'admin',
          authorDisplayName: '熊总',
          createdAt: '2026-11-13T10:00:00+08:00',
          publishedAt: null,
          isPublished: false,
          isDraft: true,
        },
        ...state.versions,
      ]
      state.detail = {
        ...state.detail,
        draftRevision: revision,
        draftContent: String(body.content),
        draftChangeNote: (body.changeNote as string | undefined) ?? null,
      }
      return Promise.resolve({ data: state.detail })
    },
  )

  mockPost.mockImplementation(
    (url: string, body: Record<string, unknown>) => {
      state.posts.push({ url, body })
      if (state.failNext) return reject(state.failNext)
      if (url.endsWith('/rollback')) {
        const target = state.versions.find(
          (v) => v.revision === body.targetRevision,
        )
        const revision = Math.max(
          0,
          ...state.versions.map((v) => v.revision),
        ) + 1
        state.detail = {
          ...state.detail,
          publishedRevision: revision,
          publishedContent: target?.content ?? state.detail.defaultContent,
          effectiveContent: target?.content ?? state.detail.defaultContent,
          source: 'db',
          draftRevision: null,
          draftContent: null,
          discardedDraftRevision: state.detail.draftRevision,
          deviatesFromDefault:
            (target?.content ?? state.detail.defaultContent) !==
            state.detail.defaultContent,
        }
        return Promise.resolve({ data: state.detail })
      }
      if (url.endsWith('/reset-to-default')) {
        const revision = (state.detail.publishedRevision ?? 0) + 1
        state.detail = {
          ...state.detail,
          publishedRevision: revision,
          publishedContent: state.detail.defaultContent,
          effectiveContent: state.detail.defaultContent,
          source: 'db',
          draftRevision: null,
          draftContent: null,
          deviatesFromDefault: false,
        }
        return Promise.resolve({ data: state.detail })
      }
      // publish
      const revision = state.detail.draftRevision
      state.detail = {
        ...state.detail,
        publishedRevision: revision,
        publishedContent: state.detail.draftContent,
        effectiveContent: state.detail.draftContent ?? state.detail.effectiveContent,
        source: 'db',
        draftRevision: null,
        draftContent: null,
        publishedAt: '2026-11-13T10:05:00+08:00',
        publishedBy: 'admin',
        deviatesFromDefault:
          (state.detail.draftContent ?? state.detail.effectiveContent) !==
          state.detail.defaultContent,
      }
      return Promise.resolve({ data: state.detail })
    },
  )

  return state
}

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        retry: false,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

function setup(
  detail = makeDetail(),
  versions: PromptVersionItem[] = [],
  overrides: Partial<Parameters<typeof PromptEditor>[0]> = {},
) {
  const state = fakeServer(detail, versions)
  const utils = render(
    <PromptEditor
      promptKey={KEY}
      env={STAGING}
      writable
      disabledReason={null}
      confirmCodeHint={CODE}
      {...overrides}
    />,
    { wrapper: createWrapper() },
  )
  return { ...utils, state }
}

function bodyTextarea() {
  return screen.getByLabelText('prompt 正文')
}

function button(name: string | RegExp) {
  return screen.getByRole('button', { name })
}

async function openPublishAndSubmit(note = '上线新人设', code = CODE) {
  await userEvent.click(button('发布草稿'))
  const dialog = await screen.findByRole('dialog')
  await userEvent.type(within(dialog).getByLabelText('改动说明'), note)
  await userEvent.type(within(dialog).getByLabelText('确认码'), code)
  await userEvent.click(
    within(dialog).getByRole('button', { name: /发布草稿/ }),
  )
  return dialog
}

beforeEach(() => {
  mockGet.mockReset()
  mockPatch.mockReset()
  mockPost.mockReset()
})

describe('PromptEditor 读取与展示', () => {
  it('详情加载中显示 Spin，不渲染半成品表单', () => {
    mockGet.mockReturnValue(new Promise(() => undefined))
    render(
      <PromptEditor
        promptKey={KEY}
        env={STAGING}
        writable
        disabledReason={null}
        confirmCodeHint={CODE}
      />,
      { wrapper: createWrapper() },
    )

    expect(document.querySelector('.ant-spin')).not.toBeNull()
    expect(screen.queryByLabelText('prompt 正文')).not.toBeInTheDocument()
  })

  it('详情加载失败给出错误态与服务端 message', async () => {
    const err = new Error('未知的 prompt key：nope') as Error & { status?: number }
    err.status = 404
    mockGet.mockRejectedValue(err)

    render(
      <PromptEditor
        promptKey={KEY}
        env={STAGING}
        writable
        disabledReason={null}
        confirmCodeHint={CODE}
      />,
      { wrapper: createWrapper() },
    )

    expect(
      await screen.findByText('prompt 详情加载失败'),
    ).toBeInTheDocument()
    expect(screen.getByText(/未知的 prompt key/)).toBeInTheDocument()
  })

  it('渲染元信息、变量契约与当前正文', async () => {
    setup()

    await screen.findByText('小象 Elly 人设')
    expect(screen.getByText(KEY)).toBeInTheDocument()
    expect(screen.getByText('角色人设')).toBeInTheDocument()
    expect(screen.getByText('主对话回答')).toBeInTheDocument()
    expect(screen.getByText('代码默认值')).toBeInTheDocument()
    expect(screen.getByText(/未编辑/)).toBeInTheDocument()
    // 必填变量带 *，可选变量不带
    expect(screen.getByText('{{childName}} *')).toBeInTheDocument()
    expect(screen.getByText('{{contextSection}}')).toBeInTheDocument()
    expect((bodyTextarea() as HTMLTextAreaElement).value).toBe(DEFAULT_CONTENT)
  })

  it('已发布 + 有草稿时两个版本号都显示，且标出「已偏离默认」', async () => {
    setup(
      makeDetail({
        source: 'db',
        publishedRevision: 2,
        draftRevision: 3,
        publishedContent: '已发布正文',
        effectiveContent: '已发布正文',
        draftContent: '草稿正文',
        draftChangeNote: '还在改',
        deviatesFromDefault: true,
      }),
    )

    await screen.findByText('已发布 r2 · 待发布草稿 r3')
    expect(screen.getByText('已偏离默认')).toBeInTheDocument()
    expect(screen.getByText('DB 已发布')).toBeInTheDocument()
    // 编辑区显示的是草稿正文，不是已发布正文
    expect((bodyTextarea() as HTMLTextAreaElement).value).toBe('草稿正文')
    expect(
      (screen.getByLabelText('草稿改动说明') as HTMLTextAreaElement).value,
    ).toBe('还在改')
  })
})

describe('PromptEditor 只读态（fail-closed）', () => {
  it('writable=false 时正文只读、不出现任何写按钮，并说明原因', async () => {
    setup(makeDetail(), [], {
      writable: false,
      disabledReason: '无法确认当前环境，已禁用全部写操作。',
      env: UNKNOWN_ENV_VIEW,
    })

    await screen.findByText('小象 Elly 人设')
    expect((bodyTextarea() as HTMLTextAreaElement).disabled).toBe(true)
    expect(screen.getByText('当前为只读')).toBeInTheDocument()
    expect(
      screen.getByText('无法确认当前环境，已禁用全部写操作。'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '保存草稿' })).toBeNull()
    expect(screen.queryByRole('button', { name: '发布草稿' })).toBeNull()
    expect(screen.queryByRole('button', { name: '恢复代码默认值' })).toBeNull()
  })

  it('只读时版本历史里的回滚也一律禁用', async () => {
    // publishedRevision 故意与版本 r1 不同：这样禁用只能来自 writable=false，
    // 而不是「回滚到当前生效版本」那条规则
    setup(
      makeDetail({ publishedRevision: 2, source: 'db' }),
      [
        {
          revision: 1,
          content: 'v1',
          changeNote: 'x',
          authorUsername: 'admin',
          authorDisplayName: null,
          createdAt: '2026-11-12T10:00:00+08:00',
          publishedAt: '2026-11-12T10:00:00+08:00',
          isPublished: false,
          isDraft: false,
        },
      ],
      { writable: false, disabledReason: '只读' },
    )

    await screen.findByText('小象 Elly 人设')
    const rollback = await screen.findByRole('button', { name: '回滚到此版本' })
    expect(rollback).toBeDisabled()
  })
})

describe('PromptEditor 草稿与发布闸口', () => {
  it('没有草稿时发布禁用；生效值等于默认值时恢复默认也禁用', async () => {
    setup()

    await screen.findByText('小象 Elly 人设')
    expect(button('发布草稿')).toBeDisabled()
    expect(button('恢复代码默认值')).toBeDisabled()
    expect(button('保存草稿')).toBeDisabled()
  })

  it('改了正文才算 dirty：出现差异预览并解锁保存草稿，但发布仍禁用', async () => {
    setup()

    await screen.findByText('小象 Elly 人设')
    fireEvent.change(bodyTextarea(), { target: { value: '你是小象 Elly！' } })

    expect(await screen.findByText('有未保存的改动')).toBeInTheDocument()
    expect(screen.getByTestId('prompt-diff')).toBeInTheDocument()
    expect(button('保存草稿')).toBeEnabled()
    // 关键：发布的是已保存草稿，屏幕上的未保存改动不能被误发
    expect(button('发布草稿')).toBeDisabled()
  })

  it('保存草稿：expectedRevision 走乐观锁，成功后提示明确「尚未发布」', async () => {
    const { state } = setup()

    await screen.findByText('小象 Elly 人设')
    fireEvent.change(bodyTextarea(), { target: { value: '新人设正文' } })
    fireEvent.change(screen.getByLabelText('草稿改动说明'), {
      target: { value: '收紧自称' },
    })
    await userEvent.click(button('保存草稿'))

    await waitFor(() => expect(state.patches).toHaveLength(1))
    expect(state.patches[0].url).toBe(`/analytics/prompts/${KEY}/draft`)
    expect(state.patches[0].body).toEqual({
      content: '新人设正文',
      expectedRevision: 0,
      changeNote: '收紧自称',
    })
    expect(
      await screen.findByText(/草稿已保存为 r1；尚未发布/),
    ).toBeInTheDocument()
    // 表单按新指针重挂载后，输入框显示的是服务端回传的草稿正文
    await waitFor(() =>
      expect((bodyTextarea() as HTMLTextAreaElement).value).toBe('新人设正文'),
    )
  })

  it('改动说明留空时不带 changeNote 字段（服务端可选）', async () => {
    const { state } = setup()

    await screen.findByText('小象 Elly 人设')
    fireEvent.change(bodyTextarea(), { target: { value: 'x' } })
    await userEvent.click(button('保存草稿'))

    await waitFor(() => expect(state.patches).toHaveLength(1))
    expect(state.patches[0].body).toEqual({
      content: 'x',
      expectedRevision: 0,
      changeNote: undefined,
    })
  })

  it('乐观锁 409：提示里带上服务端原文，让管理员知道要刷新', async () => {
    const { state } = setup()
    state.failNext = {
      status: 409,
      message: '草稿已被他人更新（当前 r2，你的编辑基于 r0）；请刷新后重试',
    }

    await screen.findByText('小象 Elly 人设')
    fireEvent.change(bodyTextarea(), { target: { value: 'x' } })
    await userEvent.click(button('保存草稿'))

    expect(
      await screen.findByText(/草稿已被他人更新（当前 r2，你的编辑基于 r0）/),
    ).toBeInTheDocument()
  })

  it('有草稿且无未保存改动时发布解锁，提交带上 revision 与确认码', async () => {
    const { state } = setup(
      makeDetail({ draftRevision: 1, draftContent: '草稿正文', draftChangeNote: '待发布' }),
    )

    await screen.findByText('小象 Elly 人设')
    await openPublishAndSubmit()

    await waitFor(() => expect(state.posts).toHaveLength(1))
    expect(state.posts[0].url).toBe(`/analytics/prompts/${KEY}/publish`)
    expect(state.posts[0].body).toEqual({
      revision: 1,
      changeNote: '上线新人设',
      confirmCode: CODE,
    })
    expect(
      await screen.findByText(/已发布 r1，线上立即生效/),
    ).toBeInTheDocument()
  })

  it('确认码错误（服务端 400）：弹窗保持打开并给出可操作提示', async () => {
    const { state } = setup(
      makeDetail({ draftRevision: 1, draftContent: '草稿正文' }),
    )
    state.failNext = { status: 400, message: '确认码不正确，操作已取消' }

    await screen.findByText('小象 Elly 人设')
    const dialog = await openPublishAndSubmit()

    expect(
      await within(dialog).findByText(
        '确认码不正确，操作已取消。请对照弹窗提示重新手动输入。',
      ),
    ).toBeInTheDocument()
    // 弹窗没被自动关掉，草稿也没被发布
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(state.detail.publishedRevision).toBeNull()
  })
})

describe('PromptEditor 回滚与恢复默认', () => {
  it('恢复代码默认值：生效值偏离默认时可用，提交走 reset-to-default', async () => {
    const { state } = setup(
      makeDetail({
        source: 'db',
        publishedRevision: 4,
        publishedContent: '被改坏的正文',
        effectiveContent: '被改坏的正文',
        deviatesFromDefault: true,
      }),
    )

    await screen.findByText('小象 Elly 人设')
    await userEvent.click(button('恢复代码默认值'))
    const dialog = await screen.findByRole('dialog')
    // diff 展示「当前生效 → 代码默认值」
    expect(within(dialog).getByTestId('prompt-diff')).toBeInTheDocument()
    await userEvent.type(within(dialog).getByLabelText('改动说明'), '改坏了，恢复默认')
    await userEvent.type(within(dialog).getByLabelText('确认码'), CODE)
    await userEvent.click(
      within(dialog).getByRole('button', { name: /恢复代码默认值/ }),
    )

    await waitFor(() => expect(state.posts).toHaveLength(1))
    expect(state.posts[0].url).toBe(
      `/analytics/prompts/${KEY}/reset-to-default`,
    )
    expect(state.posts[0].body).toEqual({
      changeNote: '改坏了，恢复默认',
      confirmCode: CODE,
    })
    expect(
      await screen.findByText(/已恢复代码默认值并发布为 r5/),
    ).toBeInTheDocument()
  })

  it('回滚：以目标版本正文新建 revision 发布，并提示被丢弃的草稿号', async () => {
    const { state } = setup(
      makeDetail({
        source: 'db',
        publishedRevision: 3,
        publishedContent: '第三版',
        effectiveContent: '第三版',
        draftRevision: 4,
        draftContent: '未发布的第四版',
        deviatesFromDefault: true,
      }),
      [
        {
          revision: 4,
          content: '未发布的第四版',
          changeNote: '还在改',
          authorUsername: 'admin',
          authorDisplayName: null,
          createdAt: '2026-11-13T10:00:00+08:00',
          publishedAt: null,
          isPublished: false,
          isDraft: true,
        },
        {
          revision: 3,
          content: '第三版',
          changeNote: 'x',
          authorUsername: 'admin',
          authorDisplayName: null,
          createdAt: '2026-11-12T10:00:00+08:00',
          publishedAt: '2026-11-12T10:00:00+08:00',
          isPublished: true,
          isDraft: false,
        },
        {
          revision: 2,
          content: '第二版',
          changeNote: 'y',
          authorUsername: 'admin',
          authorDisplayName: null,
          createdAt: '2026-11-11T10:00:00+08:00',
          publishedAt: '2026-11-11T10:00:00+08:00',
          isPublished: false,
          isDraft: false,
        },
      ],
    )

    await screen.findByText('小象 Elly 人设')
    // 有未发布草稿时也算「无未保存改动」，回滚可用；草稿行与当前生效行都禁用
    // 版本历史是详情之后独立的一次请求，必须 await 到按钮出现
    const rollbacks = await screen.findAllByRole('button', {
      name: '回滚到此版本',
    })
    expect(rollbacks[0]).toBeDisabled() // r4 草稿
    expect(rollbacks[1]).toBeDisabled() // r3 当前生效
    expect(rollbacks[2]).toBeEnabled() // r2 历史

    await userEvent.click(rollbacks[2])
    const dialog = await screen.findByRole('dialog')
    // 目标版本同时出现在弹窗标题和警示条里，用 AllBy 断言两处都在
    expect(
      within(dialog).getAllByText(/回滚到 r2/).length,
    ).toBeGreaterThanOrEqual(2)
    await userEvent.type(within(dialog).getByLabelText('改动说明'), '回到第二版')
    await userEvent.type(within(dialog).getByLabelText('确认码'), CODE)
    await userEvent.click(
      within(dialog).getByRole('button', { name: /回滚到历史版本/ }),
    )

    await waitFor(() => expect(state.posts).toHaveLength(1))
    expect(state.posts[0].url).toBe(`/analytics/prompts/${KEY}/rollback`)
    expect(state.posts[0].body).toEqual({
      targetRevision: 2,
      changeNote: '回到第二版',
      confirmCode: CODE,
    })
    expect(
      await screen.findByText(/已回滚：以 r2 的正文发布为 r5；被丢弃的草稿是 r4/),
    ).toBeInTheDocument()
  })
})

describe('PromptEditor 弹窗状态不留痕', () => {
  it('取消后重新打开，确认码与改动说明都是空的', async () => {
    setup(
      makeDetail({
        source: 'db',
        publishedRevision: 1,
        publishedContent: '已发布的第一版',
        effectiveContent: '已发布的第一版',
        draftRevision: 2,
        draftContent: '待发布的第二版',
        deviatesFromDefault: true,
      }),
    )
    await screen.findByText('小象 Elly 人设')

    // 弹窗是按需挂载的：取消即卸载，输入不该有机会留到下一次打开
    await userEvent.click(button('发布草稿'))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('改动说明'), '打错字了')
    await userEvent.type(within(dialog).getByLabelText('确认码'), 'WRONGCODE')
    await userEvent.click(
      within(dialog).getByRole('button', { name: /取\s*消/ }),
    )
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )

    await userEvent.click(button('发布草稿'))
    const reopened = await screen.findByRole('dialog')
    expect(within(reopened).getByLabelText('确认码')).toHaveValue('')
    expect(within(reopened).getByLabelText('改动说明')).toHaveValue('')
    expect(
      within(reopened).getByRole('button', { name: /发布草稿/ }),
    ).toBeDisabled()
  })
})

describe('PromptEditor 通知条', () => {
  it('保存成功的提示可以手动关掉，不一直挡着正文', async () => {
    setup()
    await screen.findByText('小象 Elly 人设')
    fireEvent.change(bodyTextarea(), { target: { value: '新人设正文' } })
    await userEvent.click(button('保存草稿'))

    expect(await screen.findByText(/草稿已保存为 r1/)).toBeInTheDocument()
    const close = document.querySelector('.ant-alert-close-icon')
    expect(close).not.toBeNull()
    fireEvent.click(close as Element)

    await waitFor(() =>
      expect(screen.queryByText(/草稿已保存为 r1/)).not.toBeInTheDocument(),
    )
  })
})
