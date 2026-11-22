import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import EpisodeEditor from './EpisodeEditor'
import type {
  CapabilitiesResponse,
  EpisodeContent,
  EpisodeSegment,
  LintReport,
} from '../../types/adventureAdmin'

const capabilities: CapabilitiesResponse = {
  season: 1,
  characterKeys: ['elly'],
  interactionTypes: ['open_question', 'two_choice', 'repeat_after_me', 'reward'],
  replyWaitingInteractionTypes: ['open_question', 'two_choice', 'repeat_after_me'],
  segmentKinds: ['narration', 'interaction'],
  lintThresholds: {
    maxInteractionTextChars: 60,
    maxNarrationTextChars: 220,
    maxTitleChars: 10,
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

function segment(overrides: Partial<EpisodeSegment> = {}): EpisodeSegment {
  return {
    order: 0,
    kind: 'narration',
    text: '旁白',
    interactionType: null,
    options: null,
    fallbackText: null,
    rewardStar: false,
    ...overrides,
  }
}

const value: EpisodeContent = {
  title: '短标题',
  recap: '上次我们走到了山谷。',
  segments: [
    segment({ order: 0, text: '第一段', kind: 'narration' }),
    segment({ order: 1, text: '第二段', kind: 'interaction', interactionType: 'two_choice' }),
    segment({ order: 2, text: '第三段', kind: 'narration' }),
  ],
}

function setup(options?: {
  content?: EpisodeContent
  lint?: LintReport | null
  disabled?: boolean
}) {
  const onChange = vi.fn()
  const view = render(
    <EpisodeEditor
      value={options?.content ?? value}
      capabilities={capabilities}
      lint={options?.lint ?? null}
      disabled={options?.disabled}
      onChange={onChange}
    />,
  )
  return { onChange, ...view }
}

function buttonFor(container: HTMLElement, icon: string): HTMLButtonElement {
  const node = container.querySelector(`.anticon-${icon}`)
  const button = node?.closest('button')
  if (!button) throw new Error(`找不到 ${icon} 对应的按钮`)
  return button as HTMLButtonElement
}

describe('EpisodeEditor', () => {
  it('标题与回顾是受控输入，改动原样上报', () => {
    const { onChange } = setup()

    fireEvent.change(screen.getByPlaceholderText('家长端与看板列表里看到的名字'), {
      target: { value: '新的标题' },
    })
    expect(onChange).toHaveBeenLastCalledWith({ ...value, title: '新的标题' })

    fireEvent.change(screen.getByPlaceholderText(/这一句帮他想起来上次到哪了/), {
      target: { value: '新的回顾' },
    })
    expect(onChange).toHaveBeenLastCalledWith({ ...value, recap: '新的回顾' })
  })

  it('标题超阈值时字数提示变红，未超时是次要色', () => {
    const { rerender } = render(
      <EpisodeEditor value={value} capabilities={capabilities} lint={null} onChange={vi.fn()} />,
    )
    expect(screen.getByText('3 / 10 字').className).toContain('ant-typography-secondary')

    rerender(
      <EpisodeEditor
        value={{ ...value, title: '这是一个明显超过十个字的标题' }}
        capabilities={capabilities}
        lint={null}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByText('14 / 10 字').className).toContain('ant-typography-danger')
  })

  it('加旁白：追加一段旁白并按位置编号', () => {
    const { onChange } = setup()
    fireEvent.click(screen.getByRole('button', { name: /加旁白/ }))

    const next = onChange.mock.calls[0][0] as EpisodeContent
    expect(next.segments).toHaveLength(4)
    expect(next.segments[3]).toEqual({
      order: 3,
      kind: 'narration',
      text: '',
      interactionType: null,
      options: null,
      fallbackText: null,
      rewardStar: false,
    })
  })

  it('加互动：新段落默认开放问答并预留兜底话术', () => {
    const { onChange } = setup()
    fireEvent.click(screen.getByRole('button', { name: /加互动/ }))

    const next = onChange.mock.calls[0][0] as EpisodeContent
    expect(next.segments[3]).toEqual({
      order: 3,
      kind: 'interaction',
      text: '',
      interactionType: 'open_question',
      options: null,
      fallbackText: '',
      rewardStar: false,
    })
  })

  it('上移只交换相邻两段，并整体重新编号', () => {
    const { onChange, container } = setup()
    const cards = container.querySelectorAll('.ant-card')
    fireEvent.click(buttonFor(cards[1] as HTMLElement, 'arrow-up'))

    const next = onChange.mock.calls[0][0] as EpisodeContent
    expect(next.segments.map((item) => item.text)).toEqual(['第二段', '第一段', '第三段'])
    expect(next.segments.map((item) => item.order)).toEqual([0, 1, 2])
  })

  it('下移同样只交换相邻两段', () => {
    const { onChange, container } = setup()
    const cards = container.querySelectorAll('.ant-card')
    fireEvent.click(buttonFor(cards[0] as HTMLElement, 'arrow-down'))

    const next = onChange.mock.calls[0][0] as EpisodeContent
    expect(next.segments.map((item) => item.text)).toEqual(['第二段', '第一段', '第三段'])
  })

  it('删除一段后剩余段落重新编号，序号不留断档', () => {
    const { onChange, container } = setup()
    const cards = container.querySelectorAll('.ant-card')
    fireEvent.click(buttonFor(cards[0] as HTMLElement, 'delete'))

    const next = onChange.mock.calls[0][0] as EpisodeContent
    expect(next.segments.map((item) => item.text)).toEqual(['第二段', '第三段'])
    expect(next.segments.map((item) => item.order)).toEqual([0, 1])
  })

  it('首段不能上移、末段不能下移', () => {
    const { container } = setup()
    const cards = container.querySelectorAll('.ant-card')
    expect(buttonFor(cards[0] as HTMLElement, 'arrow-up')).toBeDisabled()
    expect(buttonFor(cards[2] as HTMLElement, 'arrow-down')).toBeDisabled()
  })

  it('段落编辑改动只替换对应那一段', () => {
    const { onChange, container } = setup()
    const cards = container.querySelectorAll('.ant-card')
    fireEvent.change(cards[1].querySelector('textarea') as HTMLTextAreaElement, {
      target: { value: '改过的第二段' },
    })

    const next = onChange.mock.calls[0][0] as EpisodeContent
    expect(next.segments[0].text).toBe('第一段')
    expect(next.segments[1].text).toBe('改过的第二段')
    expect(next.segments[2].text).toBe('第三段')
  })

  it('没有段落时给出空壳警告', () => {
    setup({ content: { title: '', recap: null, segments: [] } })
    expect(screen.getByText(/还没有段落/)).toBeTruthy()
    expect(screen.getByText('段落（0）')).toBeTruthy()
  })

  it('只读时所有输入与增删按钮都禁用', () => {
    const { container } = setup({ disabled: true })
    expect(screen.getByPlaceholderText('家长端与看板列表里看到的名字')).toBeDisabled()
    expect(screen.getByRole('button', { name: /加旁白/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /加互动/ })).toBeDisabled()
    expect(buttonFor(container.querySelectorAll('.ant-card')[1] as HTMLElement, 'arrow-up')).toBeDisabled()
  })

  it('lint 问题按 segmentOrder 分发到各段，集级问题不落到段上', () => {
    const lint: LintReport = {
      ok: false,
      issues: [
        {
          severity: 'error',
          code: 'NARRATION_TOO_LONG',
          message: '第一段旁白超长',
          businessKey: 'elly/1/1',
          segmentOrder: 0,
        },
        {
          severity: 'warning',
          code: 'PREDECESSOR_NOT_PUBLISHED',
          message: '上一集还没发布',
          businessKey: 'elly/1/1',
        },
      ],
      errors: [
        {
          severity: 'error',
          code: 'NARRATION_TOO_LONG',
          message: '第一段旁白超长',
          businessKey: 'elly/1/1',
          segmentOrder: 0,
        },
      ],
      warnings: [
        {
          severity: 'warning',
          code: 'PREDECESSOR_NOT_PUBLISHED',
          message: '上一集还没发布',
          businessKey: 'elly/1/1',
        },
      ],
    }
    setup({ lint })

    expect(screen.getByText('1 条问题')).toBeTruthy()
    expect(screen.getByText('第一段旁白超长')).toBeTruthy()
    expect(screen.queryByText('上一集还没发布')).toBeNull()
  })

  it('未传 lint 时不报错，也没有问题标签', () => {
    setup({ lint: null })
    expect(screen.queryByText(/条问题/)).toBeNull()
  })
})
