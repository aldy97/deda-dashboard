import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import RetentionCurve from './RetentionCurve'

describe('RetentionCurve 文案', () => {
  it('全部未到期时提示使用「同期群」而不是英文 cohort', () => {
    render(
      <RetentionCurve
        data={{ points: [{ day: 1, rate: null }], cohortSize: 0 }}
      />,
    )

    expect(
      screen.getByText('暂无满足条件的留存数据（同期群均未到期）'),
    ).toBeInTheDocument()
  })
})
