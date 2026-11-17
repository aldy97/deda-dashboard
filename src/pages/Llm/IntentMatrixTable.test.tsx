import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import IntentMatrixTable from './IntentMatrixTable'
import type { IntentSummaryResponse } from '../../types/analytics'

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location-search">{location.search}</div>
}

function summary(
  matrix: IntentSummaryResponse['matrix'],
  overrides: Partial<IntentSummaryResponse> = {},
): IntentSummaryResponse {
  return {
    total: matrix.reduce((s, c) => s + c.count, 0),
    byIntent: [],
    bySource: [],
    modelInvokedCount: 0,
    modelInvokedRate: null,
    fallbackCount: 0,
    fallbackRate: null,
    notRoutedCount: 0,
    adventureTakeoverCount: 0,
    matrix,
    ...overrides,
  }
}

function renderTable(
  matrix: IntentSummaryResponse['matrix'],
  startDate = '2026-11-01',
  endDate = '2026-11-07',
) {
  return render(
    <MemoryRouter>
      <LocationProbe />
      <IntentMatrixTable
        summary={summary(matrix)}
        startDate={startDate}
        endDate={endDate}
      />
    </MemoryRouter>,
  )
}

describe('IntentMatrixTable 意图→消息明细下钻', () => {
  it('free_chat 意图渲染为链接，带 mode=free_chat 与日期区间', () => {
    renderTable([{ intent: 'free_chat', source: 'model', count: 10 }])

    const link = screen.getByRole('link', { name: '自由聊天' })
    expect(link.getAttribute('href')).toBe(
      '/messages?mode=free_chat&startDate=2026-11-01&endDate=2026-11-07',
    )
  })

  it('adventure_story 意图渲染为链接', () => {
    renderTable([{ intent: 'adventure_story', source: 'continuation', count: 5 }])

    const link = screen.getByRole('link', { name: '冒险故事' })
    expect(link.getAttribute('href')).toBe(
      '/messages?mode=adventure_story&startDate=2026-11-01&endDate=2026-11-07',
    )
  })

  it('english_story / idiom_story / sleep_story / free_story 也都渲染为链接', () => {
    renderTable([
      { intent: 'english_story', source: 'model', count: 3 },
      { intent: 'idiom_story', source: 'model', count: 2 },
      { intent: 'sleep_story', source: 'force_sleep', count: 8 },
      { intent: 'free_story', source: 'model', count: 4 },
    ])

    expect(screen.getByRole('link', { name: '英语故事' }).getAttribute('href')).toBe(
      '/messages?mode=english_story&startDate=2026-11-01&endDate=2026-11-07',
    )
    expect(screen.getByRole('link', { name: '成语故事' }).getAttribute('href')).toBe(
      '/messages?mode=idiom_story&startDate=2026-11-01&endDate=2026-11-07',
    )
    expect(screen.getByRole('link', { name: '哄睡故事' }).getAttribute('href')).toBe(
      '/messages?mode=sleep_story&startDate=2026-11-01&endDate=2026-11-07',
    )
    expect(screen.getByRole('link', { name: '自由故事' }).getAttribute('href')).toBe(
      '/messages?mode=free_story&startDate=2026-11-01&endDate=2026-11-07',
    )
  })

  it('sleep_config 不渲染链接（哄睡设置不是对话模式），保持纯文本 Tag', () => {
    renderTable([{ intent: 'sleep_config', source: 'model', count: 3 }])

    expect(screen.queryByRole('link', { name: '哄睡设置' })).not.toBeInTheDocument()
    // 纯文本 Tag 仍在
    expect(screen.getByText('哄睡设置')).toBeInTheDocument()
  })

  it('null intent（未走到路由）不渲染链接，保持纯文本', () => {
    renderTable([{ intent: null, source: 'not_routed', count: 7 }])

    expect(screen.queryByRole('link', { name: '未走到路由' })).not.toBeInTheDocument()
    expect(screen.getByText('未走到路由')).toBeInTheDocument()
  })
})

describe('IntentMatrixTable 既有行为不变', () => {
  it('空矩阵显示空态', () => {
    renderTable([])

    expect(screen.getByText('所选区间暂无意图判定记录')).toBeInTheDocument()
  })

  it('列标题用中文名（来源标签），含 NULL_BUCKET 映射', () => {
    renderTable([
      { intent: 'free_chat', source: 'model', count: 5 },
      { intent: 'free_chat', source: null, count: 3 },
    ])

    expect(
      screen.getByRole('columnheader', { name: '小模型判定' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', { name: '未知来源' }),
    ).toBeInTheDocument()
  })

  it('缺组合渲染「—」而非 0', () => {
    renderTable([
      { intent: 'free_chat', source: 'model', count: 5 },
      { intent: 'sleep_story', source: 'rule', count: 3 },
    ])

    // free_chat 行没有 rule 列（模型命中的意图），sleep_story 行没有 model 列
    // 缺失的组合应渲染「—」而非 0
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('合计列在右侧固定', () => {
    renderTable([{ intent: 'free_chat', source: 'model', count: 10 }])

    expect(
      screen.getByRole('columnheader', { name: '合计' }),
    ).toBeInTheDocument()
    // "10" 同时出现在模型列和合计列，用 getAllByText
    expect(screen.getAllByText('10').length).toBeGreaterThanOrEqual(2)
  })

  it('分页关闭', () => {
    renderTable([{ intent: 'free_chat', source: 'model', count: 10 }])

    expect(document.querySelector('.ant-pagination')).toBeNull()
  })
})
