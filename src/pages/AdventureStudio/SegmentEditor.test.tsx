import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import SegmentEditor from './SegmentEditor'
import type {
  CapabilitiesResponse,
  EpisodeSegment,
  TwoChoiceOption,
} from '../../types/adventureAdmin'

const capabilities: CapabilitiesResponse = {
  season: 1,
  characterKeys: ['elly', 'polly'],
  interactionTypes: [
    'open_question',
    'two_choice',
    'repeat_after_me',
    'reward',
  ],
  replyWaitingInteractionTypes: [
    'open_question',
    'two_choice',
    'repeat_after_me',
  ],
  segmentKinds: ['narration', 'interaction'],
  lintThresholds: {
    maxInteractionTextChars: 60,
    maxNarrationTextChars: 220,
    maxTitleChars: 24,
    maxStarsPerEpisode: 3,
    minChoiceTextChars: 2,
    forbiddenWords: [],
  },
  simulationThresholds: {
    maxAwaitPoints: 12,
    maxSessionSeconds: 900,
  },
  fixedExitText: '不想玩了。',
  profile: 'authoring',
  authoring: true,
  testStoryEnabled: false,
}

const first: TwoChoiceOption = {
  key: 'A',
  text: '去森林',
  reply: '森林里传来鸟叫。',
}

const second: TwoChoiceOption = {
  key: 'B',
  text: '去海边',
  reply: '海浪拍上沙滩。',
}

function twoChoiceSegment(
  choices: TwoChoiceOption[] = [first, second],
): EpisodeSegment {
  return {
    order: 0,
    kind: 'interaction',
    text: '你想先去森林，还是先去海边？第一个是森林，第二个是海边。',
    interactionType: 'two_choice',
    options: { choices },
    fallbackText: '没关系，我们继续。',
    rewardStar: false,
  }
}

function setup(options?: {
  segment?: EpisodeSegment
  disabled?: boolean
}) {
  const onChange = vi.fn()
  render(
    <SegmentEditor
      segment={options?.segment ?? twoChoiceSegment()}
      index={0}
      total={1}
      capabilities={capabilities}
      issues={[]}
      disabled={options?.disabled}
      onChange={onChange}
      onMove={vi.fn()}
      onRemove={vi.fn()}
    />,
  )
  return { onChange }
}

describe('SegmentEditor · 二选一选项顺序', () => {
  it('每条选项行前显示 1/2 序号，让作者看见判定顺序', () => {
    setup()
    expect(screen.getByLabelText('第 1 个选项')).toHaveTextContent('1')
    expect(screen.getByLabelText('第 2 个选项')).toHaveTextContent('2')
  })

  it('点击交换按钮整体交换两个选项，不触碰段落字段', () => {
    const { onChange } = setup()
    fireEvent.click(
      screen.getByRole('button', { name: '交换两个选项的顺序' }),
    )

    expect(onChange).toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0][0] as EpisodeSegment
    expect(next.options?.choices).toEqual([second, first])
    expect(next.order).toBe(0)
    expect(next.text).toBe(twoChoiceSegment().text)
    expect(next.fallbackText).toBe(twoChoiceSegment().fallbackText)
  })

  it('只有 1 个选项时交换按钮不可点', () => {
    setup({ segment: twoChoiceSegment([first]) })
    expect(
      screen.getByRole('button', { name: '交换两个选项的顺序' }),
    ).toBeDisabled()
  })

  it('超过 2 个选项时交换按钮不可点（不猜测前两个的语义）', () => {
    setup({
      segment: twoChoiceSegment([
        first,
        second,
        { key: 'C', text: '去山顶', reply: '风很大。' },
      ]),
    })
    expect(
      screen.getByRole('button', { name: '交换两个选项的顺序' }),
    ).toBeDisabled()
  })

  it('只读 / 保存中（disabled）时交换按钮不可点', () => {
    setup({ disabled: true })
    expect(
      screen.getByRole('button', { name: '交换两个选项的顺序' }),
    ).toBeDisabled()
  })
})
