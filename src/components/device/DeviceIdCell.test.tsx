import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DeviceIdCell from './DeviceIdCell'

function renderCell(props: {
  label: string
  href?: string
  whitelistNote?: string | null
  copyable?: boolean
  labelWidth?: number
}) {
  return render(
    <MemoryRouter>
      <DeviceIdCell {...props} />
    </MemoryRouter>,
  )
}

/**
 * 设备 ID + 白名单备注 Tag 的共享单元格（设备舰队与消息明细共用）。
 *
 * 守两条容易回归的契约：
 * 1. 第一列固定宽度，Tag 左边缘不随设备 ID 长短漂移；
 * 2. Tag 槽位必须是 flex：普通行内 span 会多出约 3px 行盒高度，
 *    标签看上去比设备标识「高一截」。
 */
describe('DeviceIdCell', () => {
  it('链接形态：设备 ID 可点，Tag 与 ID 同一行且垂直居中', () => {
    renderCell({
      label: 'aabbccddeeff',
      href: '/users/aabbccddeeff',
      whitelistNote: '3 号样机-熊枫',
    })

    const cell = screen.getByTestId('device-id-cell')
    const label = screen.getByTestId('device-id-label')
    const tagSlot = screen.getByTestId('device-whitelist-tag')
    const tag = screen.getByText('3 号样机-熊枫')

    // 第一列固定宽度：设备 ID 长短不影响第二列 Tag 的左边缘
    expect(cell.style.display).toBe('grid')
    expect(cell.style.gridTemplateColumns).toBe('104px minmax(0px, 1fr)')
    expect(cell.style.columnGap).toBe('2px')
    expect(cell.children[0]).toBe(label)
    expect(cell.children[1]).toBe(tagSlot)
    expect(tagSlot.contains(tag)).toBe(true)

    // 垂直对齐：flex 让槽位高度等于 Tag 高度，不再多出 3px 行盒高度
    expect(tagSlot.style.display).toBe('flex')
    expect(tagSlot.style.alignItems).toBe('center')
    expect(tagSlot.style.justifySelf).toBe('start')

    // 链接形态与超长省略
    expect(label.tagName).toBe('A')
    expect(label).toHaveAttribute('href', '/users/aabbccddeeff')
    expect(label).toHaveAttribute('title', 'aabbccddeeff')
    expect(label.style.minWidth).toBe('0px')
    expect(label.style.overflow).toBe('hidden')
    expect(label.style.textOverflow).toBe('ellipsis')
    expect(tag.style.flexShrink).toBe('0')
  })

  it('纯文本形态：没有 href 时渲染 span，不生成链接', () => {
    renderCell({ label: 'D002', whitelistNote: null })

    const label = screen.getByTestId('device-id-label')
    expect(label.tagName).toBe('SPAN')
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('白名单')).toBeInTheDocument()
  })

  it('copyable 时按「ID → 复制 → 备注」排序，间距收紧到 2px', () => {
    renderCell({
      label: 'DEDA-A1B2C3D4',
      href: '/users/DEDA-A1B2C3D4',
      copyable: true,
      whitelistNote: '3 号样机-熊枫',
    })

    const cell = screen.getByTestId('device-id-cell')
    // 复制图标紧跟在 ID 后面，备注 Tag 排最后
    expect(cell.style.gridTemplateColumns).toBe('104px auto minmax(0px, 1fr)')
    expect(cell.style.columnGap).toBe('2px')
    expect(cell.children[0]).toBe(screen.getByTestId('device-id-label'))
    expect(cell.children[1]).toBe(screen.getByTestId('device-id-copy'))
    expect(cell.children[2]).toBe(screen.getByTestId('device-whitelist-tag'))
    expect(
      screen.getByRole('button', { name: '复制设备 ID' }),
    ).toBeInTheDocument()
  })

  it('copyable 但没有备注时不占第三格', () => {
    renderCell({ label: 'D002', copyable: true })

    const cell = screen.getByTestId('device-id-cell')
    expect(cell.style.gridTemplateColumns).toBe('104px auto')
    expect(cell.children.length).toBe(2)
  })

  it('labelWidth 可覆盖首列宽度：家长档案的设备 ID 更长，不能被 104px 截断', () => {
    renderCell({
      label: 'DEDA-A1B2C3D4',
      copyable: true,
      labelWidth: 140,
      whitelistNote: null,
    })

    expect(screen.getByTestId('device-id-cell').style.gridTemplateColumns).toBe(
      '140px auto minmax(0px, 1fr)',
    )
  })

  it('不传 copyable 时不渲染复制按钮，缺槽位不占列', () => {
    renderCell({ label: 'D002' })

    expect(screen.queryByRole('button')).toBeNull()
    // 只有 ID 一个槽位时不再留空的 Tag 列
    expect(screen.getByTestId('device-id-cell').style.gridTemplateColumns).toBe(
      '104px',
    )
  })

  it('undefined = 不在白名单不渲染 Tag；null = 在册但没备注回落「白名单」', () => {
    const { rerender } = renderCell({ label: 'dev-1' })
    expect(screen.queryByTestId('device-whitelist-tag')).toBeNull()

    rerender(
      <MemoryRouter>
        <DeviceIdCell label="dev-1" whitelistNote={null} />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('device-whitelist-tag')).toBeInTheDocument()
    expect(screen.getByText('白名单')).toBeInTheDocument()
  })
})
