import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import CohortTable from './CohortTable'
import type { RetentionCohortsResponse } from '../../types/analytics'

function data(
  overrides: Partial<RetentionCohortsResponse> = {},
): RetentionCohortsResponse {
  return {
    basis: 'activation',
    granularity: 'week',
    cohorts: [],
    ...overrides,
  }
}

describe('CohortTable 文案', () => {
  it('空态使用「同期群」而不是英文 cohort', () => {
    render(<CohortTable data={data()} />)

    expect(screen.getByText('所选区间暂无同期群数据')).toBeInTheDocument()
  })

  it('首列表头是「同期群」', () => {
    render(
      <CohortTable
        data={data({
          cohorts: [
            {
              cohort: '2026-W41',
              size: 10,
              retention: [{ n: 0, rate: 1 }],
            },
          ],
        })}
      />,
    )

    expect(screen.getAllByText('同期群').length).toBeGreaterThan(0)
    expect(screen.queryByText('Cohort')).toBeNull()
  })
})
