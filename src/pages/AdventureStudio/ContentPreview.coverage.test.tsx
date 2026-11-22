import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import ContentPreview from './ContentPreview'
import type { EpisodeContent, EpisodeSegment } from '../../types/adventureAdmin'

const narration: EpisodeSegment = {
  order: 0,
  kind: 'narration',
  text: '森林的清晨很安静。',
}

const interaction: EpisodeSegment = {
  order: 1,
  kind: 'interaction',
  text: '你想先去森林，还是先去海边？',
  interactionType: 'two_choice',
  options: {
    choices: [
      { key: 'A', text: '去森林', reply: '森林里有鸟叫。' },
      { key: 'B', text: '去海边', reply: '' },
    ],
  },
  fallbackText: '没关系，我们继续。',
  rewardStar: true,
}

function content(overrides: Partial<EpisodeContent> = {}): EpisodeContent {
  return {
    title: '听风原野第一天',
    recap: '上次我们走到了山谷。',
    segments: [narration, interaction],
    ...overrides,
  }
}

describe('ContentPreview', () => {
  it('按 order 渲染标题、回顾与每一段的正文', () => {
    render(<ContentPreview content={content()} />)

    expect(screen.getByText('听风原野第一天')).toBeTruthy()
    expect(screen.getByText('开场回顾：上次我们走到了山谷。')).toBeTruthy()
    expect(screen.getByText('森林的清晨很安静。')).toBeTruthy()
    expect(screen.getByText('#0')).toBeTruthy()
    expect(screen.getByText('旁白')).toBeTruthy()
    expect(screen.getByText('互动')).toBeTruthy()
    expect(screen.getByText('二选一')).toBeTruthy()
    expect(screen.getByText('奖励 1 颗星')).toBeTruthy()
    expect(screen.getByText('森林里有鸟叫。')).toBeTruthy()
    expect(screen.getByText('（缺接话）')).toBeTruthy()
    expect(screen.getByText('兜底话术（跑题/沉默）：没关系，我们继续。')).toBeTruthy()
  })

  it('段落按 order 升序展示，不依赖输入顺序', () => {
    const secondPage: EpisodeSegment = {
      order: 2,
      kind: 'narration',
      text: '第二段旁白',
    }
    const firstPage: EpisodeSegment = {
      order: 1,
      kind: 'narration',
      text: '第一段旁白',
    }
    render(<ContentPreview content={content({ segments: [secondPage, firstPage] })} />)

    const markers = screen.getAllByText(/^#\d$/)
    expect(markers.map((node) => node.textContent)).toEqual(['#1', '#2'])
  })

  it('空标题与空文本都明确标红，不让空壳看起来像正常内容', () => {
    render(
      <ContentPreview
        content={content({
          title: '',
          recap: null,
          segments: [{ order: 0, kind: 'narration', text: '' }],
        })}
      />,
    )

    expect(screen.getByText('（未填标题）')).toBeTruthy()
    expect(screen.getByText('（这一段没有文本）')).toBeTruthy()
    expect(screen.queryByText(/开场回顾/)).toBeNull()
  })

  it('没有段落时给空态说明', () => {
    render(<ContentPreview content={content({ segments: [] })} />)
    expect(screen.getByText('这一集还没有任何段落')).toBeTruthy()
  })

  it('repeat_after_me 段展示表扬句', () => {
    render(
      <ContentPreview
        content={content({
          segments: [
            {
              order: 0,
              kind: 'interaction',
              text: '跟我说：小象',
              interactionType: 'repeat_after_me',
              options: { praise: '哇，你说得真清楚！' },
            },
          ],
        })}
      />,
    )
    expect(screen.getByText('跟我说：小象')).toBeTruthy()
    expect(screen.getByText('跟我念')).toBeTruthy()
    expect(screen.getByText('哇，你说得真清楚！')).toBeTruthy()
  })

  it('compact 模式去掉外层留白，仍完整渲染内容', () => {
    const { container } = render(<ContentPreview content={content()} compact />)
    expect(container.firstElementChild).not.toHaveStyle({ paddingTop: '4px' })
    expect(screen.getByText('听风原野第一天')).toBeTruthy()
  })
})
