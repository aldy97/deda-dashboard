import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import PhoneDuplicateTag from './PhoneDuplicateTag'

describe('PhoneDuplicateTag', () => {
  it('重复时渲染黄色「重复」Tag', () => {
    render(<PhoneDuplicateTag duplicate />)

    const tag = screen.getByText('重复')
    expect(tag.closest('.ant-tag')).toHaveClass('ant-tag-gold')
  })

  it('不重复时不渲染任何内容', () => {
    const { container } = render(<PhoneDuplicateTag duplicate={false} />)

    expect(container).toBeEmptyDOMElement()
  })
})
