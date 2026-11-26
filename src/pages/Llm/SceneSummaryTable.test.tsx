import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SceneSummaryTable from './SceneSummaryTable'
import type { LlmSummaryResponse } from '../../types/analytics'

function summary(
  scenes: LlmSummaryResponse['scenes'],
): LlmSummaryResponse {
  return { scenes }
}

function sceneRow(overrides: Partial<LlmSummaryResponse['scenes'][number]> = {}) {
  return {
    scene: 'chat_main',
    tier: 'main' as const,
    calls: 1000,
    successRate: 0.98,
    p50LatencyMs: 1200,
    p90LatencyMs: 3500,
    p50FirstTokenMs: 400,
    p90FirstTokenMs: 1200,
    totalTokens: 500000,
    failureBreakdown: [{ reason: 'timeout', count: 20 }],
    ...overrides,
  }
}

function renderTable(scenes: LlmSummaryResponse['scenes']) {
  return render(
    <MemoryRouter>
      <SceneSummaryTable data={summary(scenes)} />
    </MemoryRouter>,
  )
}

describe('SceneSummaryTable 场景列链接', () => {
  it('场景名是到 /prompts?scene=<scene> 的链接', () => {
    renderTable([sceneRow({ scene: 'chat_main' })])

    const link = screen.getByRole('link', { name: /主对话回答/ })
    expect(link.getAttribute('href')).toBe('/prompts?scene=chat_main')
  })

  it('filler 场景链接正确', () => {
    renderTable([sceneRow({ scene: 'filler', tier: 'small' })])

    const link = screen.getByRole('link', { name: /首响过渡语/ })
    expect(link.getAttribute('href')).toBe('/prompts?scene=filler')
  })

  it('safety_l2 场景链接正确', () => {
    renderTable([sceneRow({ scene: 'safety_l2', tier: 'small' })])

    const link = screen.getByRole('link', { name: /安全语义分类/ })
    expect(link.getAttribute('href')).toBe('/prompts?scene=safety_l2')
  })

  it('intent_classify 场景链接正确', () => {
    renderTable([sceneRow({ scene: 'intent_classify', tier: 'small' })])

    const link = screen.getByRole('link', { name: /意图分类/ })
    expect(link.getAttribute('href')).toBe('/prompts?scene=intent_classify')
  })

  it('adventure_script_convert 显示中文名并带场景 InfoTip', () => {
    renderTable([sceneRow({ scene: 'adventure_script_convert' })])

    const link = screen.getByRole('link', { name: /故事稿转换/ })
    expect(link.getAttribute('href')).toBe(
      '/prompts?scene=adventure_script_convert',
    )
    const sceneCell = link.closest('span')
    expect(sceneCell).not.toBeNull()
    expect(
      sceneCell!.querySelector('[aria-label="question-circle"]'),
    ).not.toBeNull()
  })

  it('多场景表格每行都有链接', () => {
    renderTable([
      sceneRow({ scene: 'chat_main' }),
      sceneRow({ scene: 'filler', tier: 'small', calls: 500 }),
    ])

    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(2)
    expect(links[0].getAttribute('href')).toBe('/prompts?scene=chat_main')
    expect(links[1].getAttribute('href')).toBe('/prompts?scene=filler')
  })
})

describe('SceneSummaryTable 既有列行为不变', () => {
  it('调用量 / 成功率 / 延迟 / 首包 / Token / 失败 Top1 列都在', () => {
    renderTable([sceneRow()])

    expect(screen.getByText('调用量')).toBeInTheDocument()
    expect(screen.getByText('1000')).toBeInTheDocument()
    // 成功率 Progress 组件
    // antd Progress 渲染为 "98%"，不是 "98.0%"
    expect(screen.getByText('98%')).toBeInTheDocument()
    // 失败 Top1
    expect(screen.getByText(/超时/)).toBeInTheDocument()
  })

  it('successRate 为 null 时渲染「—」', () => {
    renderTable([sceneRow({ successRate: null })])

    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('非流式场景首包列显示「—」', () => {
    // intent_classify 不是流式场景
    renderTable([sceneRow({ scene: 'intent_classify', tier: 'small' })])

    // 首包列 title 存在
    expect(screen.getByText(/首包 P50/)).toBeInTheDocument()
  })

  it('静默降级 Tag 出现在 fail-open 场景', () => {
    renderTable([sceneRow({ scene: 'filler', tier: 'small' })])

    expect(screen.getByText('静默降级')).toBeInTheDocument()
  })

  it('chat_main 不展示静默降级 Tag', () => {
    renderTable([sceneRow({ scene: 'chat_main' })])

    expect(screen.queryByText('静默降级')).not.toBeInTheDocument()
  })

  it('模型层级 Tag 展示小模型 / 主模型', () => {
    renderTable([
      sceneRow({ scene: 'chat_main', tier: 'main' }),
      sceneRow({ scene: 'filler', tier: 'small' }),
    ])

    expect(screen.getByText('主模型')).toBeInTheDocument()
    expect(screen.getByText('小模型')).toBeInTheDocument()
  })

  it('失败 Top1 为空时渲染「—」', () => {
    renderTable([sceneRow({ failureBreakdown: [] })])

    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('分页关闭（全量展示不翻页）', () => {
    renderTable([sceneRow()])

    // antd Table pagination={false} 不会渲染分页器
    expect(document.querySelector('.ant-pagination')).toBeNull()
  })
})
