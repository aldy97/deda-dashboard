import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import SegmentEditor from './SegmentEditor'
import type {
  CapabilitiesResponse,
  EpisodeSegment,
  LintIssue,
  TwoChoiceOption,
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

const first: TwoChoiceOption = { key: 'A', text: '去森林', reply: '森林里有鸟叫。' }
const second: TwoChoiceOption = { key: 'B', text: '去海边', reply: '海浪拍上沙滩。' }

function twoChoice(overrides: Partial<EpisodeSegment> = {}): EpisodeSegment {
  return {
    order: 0,
    kind: 'interaction',
    text: '你想先去森林，还是先去海边？',
    interactionType: 'two_choice',
    options: { choices: [first, second] },
    fallbackText: '没关系，我们继续。',
    rewardStar: false,
    ...overrides,
  }
}

function setup(options?: {
  segment?: EpisodeSegment
  issues?: LintIssue[]
  index?: number
  total?: number
  disabled?: boolean
}) {
  const onChange = vi.fn()
  const onMove = vi.fn()
  const onRemove = vi.fn()
  const view = render(
    <SegmentEditor
      segment={options?.segment ?? twoChoice()}
      index={options?.index ?? 0}
      total={options?.total ?? 1}
      capabilities={capabilities}
      issues={options?.issues ?? []}
      disabled={options?.disabled}
      onChange={onChange}
      onMove={onMove}
      onRemove={onRemove}
    />,
  )
  return { onChange, onMove, onRemove, ...view }
}

function openSelect(index: number) {
  const combos = screen.getAllByRole('combobox')
  fireEvent.mouseDown(combos[index])
}

function pickOption(title: string) {
  const option = document.querySelector(`.ant-select-item-option[title="${title}"]`)
  if (!option) throw new Error(`下拉里没有 ${title}`)
  fireEvent.click(option)
}

function buttonByIcon(container: HTMLElement, icon: string): HTMLButtonElement {
  const button = container.querySelector(`.anticon-${icon}`)?.closest('button')
  if (!button) throw new Error(`找不到 ${icon} 按钮`)
  return button as HTMLButtonElement
}

describe('SegmentEditor · 字段与类型切换', () => {
  it('切成旁白时清掉互动专属字段', () => {
    const { onChange } = setup()
    openSelect(0)
    pickOption('旁白')

    const next = onChange.mock.calls[0][0] as EpisodeSegment
    expect(next.kind).toBe('narration')
    expect(next.interactionType).toBeNull()
    expect(next.options).toBeNull()
    // 正文与兜底话术保留，只有互动专属字段被清
    expect(next.text).toBe(twoChoice().text)
    expect(next.fallbackText).toBe(twoChoice().fallbackText)
  })

  it('换成二选一时自动补一条空选项', () => {
    const { onChange } = setup({
      segment: twoChoice({ interactionType: 'open_question', options: null }),
    })
    openSelect(1)
    pickOption('二选一（需孩子开口）')

    const next = onChange.mock.calls[0][0] as EpisodeSegment
    expect(next.interactionType).toBe('two_choice')
    expect(next.options).toEqual({ choices: [{ key: '', text: '', reply: '' }] })
  })

  it('换成二选一时已有选项原样保留', () => {
    const { onChange } = setup({
      segment: twoChoice({ interactionType: 'reward', options: { choices: [first, second] } }),
    })
    openSelect(1)
    pickOption('二选一（需孩子开口）')

    const next = onChange.mock.calls[0][0] as EpisodeSegment
    expect(next.options).toEqual({ choices: [first, second] })
  })

  it('换成跟我念时保留已有表扬、没有则给空串占位', () => {
    const { onChange } = setup({
      segment: twoChoice({ interactionType: 'open_question', options: null }),
    })
    openSelect(1)
    pickOption('跟我念（需孩子开口）')
    expect((onChange.mock.calls[0][0] as EpisodeSegment).options).toEqual({ praise: '' })
  })

  it('已有表扬时换原语不丢它', () => {
    const { onChange } = setup({
      segment: twoChoice({
        interactionType: 'open_question',
        options: { praise: '说得真好' },
      }),
    })
    openSelect(1)
    pickOption('跟我念（需孩子开口）')
    expect((onChange.mock.calls[0][0] as EpisodeSegment).options).toEqual({
      praise: '说得真好',
    })
  })

  it('换成开放问答时清掉专属字段', () => {
    const { onChange } = setup()
    openSelect(1)
    pickOption('开放问答（需孩子开口）')
    expect((onChange.mock.calls[0][0] as EpisodeSegment).options).toBeNull()
  })

  it('奖励原语不需要孩子开口，不渲染兜底话术框', () => {
    setup({
      segment: twoChoice({
        interactionType: 'reward',
        options: null,
        fallbackText: null,
      }),
    })
    expect(screen.queryByText(/兜底话术（必填）/)).toBeNull()
    expect(screen.queryByText(/退出话术由系统统一设定/)).toBeNull()
  })

  it('勾选奖励星把 rewardStar 置为 true', () => {
    const { onChange } = setup()
    fireEvent.click(screen.getByRole('checkbox', { name: /通过这一段奖励一颗星/ }))
    expect((onChange.mock.calls[0][0] as EpisodeSegment).rewardStar).toBe(true)
  })

  it('正文改动原样上报；互动引导词与旁白各用各的上限提示', () => {
    const { onChange } = setup()
    fireEvent.change(screen.getByPlaceholderText(/互动引导词：问孩子什么/), {
      target: { value: '换一句引导词' },
    })
    expect((onChange.mock.calls[0][0] as EpisodeSegment).text).toBe('换一句引导词')
    expect(screen.getByText(/（互动引导词上限）/)).toBeTruthy()

    const narration = setup({
      segment: twoChoice({ kind: 'narration', interactionType: null, options: null }),
    })
    fireEvent.change(screen.getByPlaceholderText(/旁白原文/), {
      target: { value: '旁白改了' },
    })
    expect((narration.onChange.mock.calls[0][0] as EpisodeSegment).text).toBe('旁白改了')
    expect(screen.getByText(/（旁白上限）/)).toBeTruthy()
  })

  it('正文超阈值时字数提示变红', () => {
    setup({
      segment: twoChoice({ text: '长'.repeat(61), kind: 'interaction' }),
    })
    expect(screen.getByText(/61 \/ 60 字/).className).toContain('ant-typography-danger')
  })

  it('兜底话术改动原样上报', () => {
    const { onChange } = setup()
    fireEvent.change(screen.getByDisplayValue('没关系，我们继续。'), {
      target: { value: '我们再来一次。' },
    })
    expect((onChange.mock.calls[0][0] as EpisodeSegment).fallbackText).toBe('我们再来一次。')
  })

  it('跟我念的表扬输入框可编辑', () => {
    const { onChange } = setup({
      segment: twoChoice({
        interactionType: 'repeat_after_me',
        options: { praise: '' },
      }),
    })
    fireEvent.change(screen.getByPlaceholderText('例如：哇，你说得真清楚！'), {
      target: { value: '说得真好' },
    })
    expect((onChange.mock.calls[0][0] as EpisodeSegment).options).toEqual({
      praise: '说得真好',
    })
  })
})

describe('SegmentEditor · 二选一选项编辑', () => {
  it('key / 选项 / 接话三个字段分别上报', () => {
    const { onChange } = setup()
    fireEvent.change(screen.getByDisplayValue('A'), { target: { value: 'A1' } })
    expect((onChange.mock.calls[0][0] as EpisodeSegment).options?.choices?.[0].key).toBe('A1')

    fireEvent.change(screen.getByDisplayValue('去森林'), {
      target: { value: '去森林深处' },
    })
    expect((onChange.mock.calls[1][0] as EpisodeSegment).options?.choices?.[0].text).toBe(
      '去森林深处',
    )

    fireEvent.change(screen.getByDisplayValue('森林里有鸟叫。'), {
      target: { value: '森林里有小鸟在唱歌。' },
    })
    expect((onChange.mock.calls[2][0] as EpisodeSegment).options?.choices?.[0].reply).toBe(
      '森林里有小鸟在唱歌。',
    )
    // 只改被点名的那个字段，另一个选项一字不动
    expect((onChange.mock.calls[2][0] as EpisodeSegment).options?.choices?.[1]).toEqual(second)
  })

  it('固定两个选项时，删选项与加选项按钮都不可点', () => {
    const { container } = setup()
    const deleteButtons = container.querySelectorAll('.ant-card-body .anticon-delete')
    expect((deleteButtons[0].closest('button') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByRole('button', { name: /加一个选项/ })).toBeDisabled()
  })

  it('三个选项时可以删掉多出来的那条、加选项按钮仍禁用', () => {
    const third: TwoChoiceOption = { key: 'C', text: '去山顶', reply: '风很大。' }
    const { onChange, container } = setup({
      segment: twoChoice({ options: { choices: [first, second, third] } }),
    })
    const deleteButtons = container.querySelectorAll('.ant-card-body .anticon-delete')
    expect((deleteButtons[0].closest('button') as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByRole('button', { name: /加一个选项/ })).toBeDisabled()

    fireEvent.click(deleteButtons[0].closest('button') as HTMLButtonElement)
    expect((onChange.mock.calls[0][0] as EpisodeSegment).options?.choices).toEqual([
      second,
      third,
    ])
  })

  it('恰好两个选项时交换按钮可点，整对象交换 key/text/reply', () => {
    const { onChange } = setup()
    fireEvent.click(screen.getByRole('button', { name: '交换两个选项的顺序' }))
    expect((onChange.mock.calls[0][0] as EpisodeSegment).options?.choices).toEqual([
      second,
      first,
    ])
  })

  it('段落类型从旁白切回互动时不清字段', () => {
    const { onChange } = setup({
      segment: twoChoice({ kind: 'narration', interactionType: null, options: null }),
    })
    openSelect(0)
    pickOption('互动')

    const next = onChange.mock.calls[0][0] as EpisodeSegment
    expect(next.kind).toBe('interaction')
    expect(next.interactionType).toBeNull()
    expect(next.options).toBeNull()
  })

  it('互动段还没选原语时下拉有占位符', () => {
    setup({ segment: twoChoice({ interactionType: null, options: null }) })
    expect(screen.getByText('选择交互原语')).toBeTruthy()
  })

  it('给我念段没有 options 时表扬框以空串兜底', () => {
    const { onChange } = setup({
      segment: twoChoice({ interactionType: 'repeat_after_me', options: null }),
    })
    const input = screen.getByPlaceholderText('例如：哇，你说得真清楚！')
    expect((input as HTMLInputElement).value).toBe('')
    fireEvent.change(input, { target: { value: '念得真准' } })
    expect((onChange.mock.calls[0][0] as EpisodeSegment).options).toEqual({
      praise: '念得真准',
    })
  })

  it('标了奖励星的段落显示金色标签', () => {
    setup({ segment: twoChoice({ rewardStar: true }) })
    expect(screen.getByText('奖励 1 颗星')).toBeTruthy()
  })

  it('只有一个选项时可以补到两个', () => {
    const { onChange } = setup({
      segment: twoChoice({ options: { choices: [first] } }),
    })
    fireEvent.click(screen.getByRole('button', { name: /加一个选项/ }))
    expect((onChange.mock.calls[0][0] as EpisodeSegment).options?.choices).toEqual([
      first,
      { key: '', text: '', reply: '' },
    ])
  })
})

describe('SegmentEditor · 问题列表与移动删除', () => {
  it('阻断项用红色、提醒项用橙色，并显示问题条数', () => {
    const issues: LintIssue[] = [
      { severity: 'error', code: 'TEXT_TOO_LONG', message: '旁白超长', businessKey: 'elly/1/1' },
      { severity: 'warning', code: 'TEXT_SHORT', message: '旁白偏短', businessKey: 'elly/1/1' },
    ]
    setup({ issues })

    expect(screen.getByText('2 条问题')).toBeTruthy()
    expect(screen.getByText('旁白超长')).toBeTruthy()
    expect(screen.getByText('旁白偏短')).toBeTruthy()
    expect(screen.getByText('旁白超长').className).toContain('ant-typography-danger')
    expect(screen.getByText('旁白偏短').className).not.toContain('ant-typography-danger')
  })

  it('只有提醒项时问题标签用橙色', () => {
    setup({
      issues: [
        {
          severity: 'warning',
          code: 'TEXT_SHORT',
          message: '旁白偏短',
          businessKey: 'elly/1/1',
        },
      ],
    })
    expect(screen.getByText('1 条问题').closest('.ant-tag')?.className).toContain(
      'ant-tag-orange',
    )
  })

  it('首段禁用上移但可下移，回调方向正确', () => {
    const { onMove, container } = setup({ index: 0, total: 2 })
    expect(buttonByIcon(container, 'arrow-up')).toBeDisabled()
    fireEvent.click(buttonByIcon(container, 'arrow-down'))
    expect(onMove).toHaveBeenCalledWith(1)
  })

  it('非末段可上移下移，删除按钮触发 onRemove', () => {
    const { onMove, onRemove, container } = setup({ index: 1, total: 3 })
    fireEvent.click(buttonByIcon(container, 'arrow-up'))
    expect(onMove).toHaveBeenCalledWith(-1)
    fireEvent.click(buttonByIcon(container, 'arrow-down'))
    expect(onMove).toHaveBeenCalledWith(1)
    fireEvent.click(buttonByIcon(container, 'delete'))
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  it('只读时所有可编辑控件都禁用，方向按钮也不可点', () => {
    const { container } = setup({ index: 1, total: 3, disabled: true })
    expect(screen.getByRole('checkbox', { name: /通过这一段奖励一颗星/ })).toBeDisabled()
    expect(buttonByIcon(container, 'arrow-up')).toBeDisabled()
    expect(buttonByIcon(container, 'arrow-down')).toBeDisabled()
    expect(buttonByIcon(container, 'delete')).toBeDisabled()
    expect(screen.getByDisplayValue('去森林')).toBeDisabled()
    expect(screen.getByDisplayValue('没关系，我们继续。')).toBeDisabled()
  })

  it('旁白段不渲染交互原语下拉', () => {
    setup({ segment: twoChoice({ kind: 'narration', interactionType: null, options: null }) })
    expect(screen.queryByPlaceholderText('选择交互原语')).toBeNull()
  })

  it('段落标号与类型标签来自 index / kind', () => {
    setup({ segment: twoChoice(), index: 4, total: 5 })
    expect(screen.getByText('#4')).toBeTruthy()
    expect(screen.getAllByText('互动').length).toBeGreaterThan(0)
    expect(screen.getAllByText('二选一').length).toBeGreaterThan(0)
  })
})
