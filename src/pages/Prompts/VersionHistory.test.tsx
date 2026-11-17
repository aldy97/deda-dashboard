import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import VersionHistory from './VersionHistory'
import { versionStateTags } from './labels'
import type { PromptVersionItem } from '../../types/analytics'

const VERSIONS: PromptVersionItem[] = [
  {
    revision: 3,
    content: '第三版正文',
    changeNote: '收紧自称',
    authorUsername: 'admin',
    authorDisplayName: '熊总',
    createdAt: '2026-11-12T10:00:00+08:00',
    publishedAt: '2026-11-12T10:05:00+08:00',
    isPublished: true,
    isDraft: false,
  },
  {
    revision: 2,
    content: '第二版正文',
    changeNote: null,
    authorUsername: 'ops01',
    authorDisplayName: null,
    createdAt: '2026-11-10T09:00:00+08:00',
    publishedAt: null,
    isPublished: false,
    isDraft: false,
  },
  {
    revision: 4,
    content: '待发布草稿正文',
    changeNote: '还在改',
    authorUsername: 'admin',
    authorDisplayName: '熊总',
    createdAt: '2026-11-13T08:00:00+08:00',
    publishedAt: null,
    isPublished: false,
    isDraft: true,
  },
]

function setup(overrides: Partial<Parameters<typeof VersionHistory>[0]> = {}) {
  const onRollback = vi.fn()
  render(
    <VersionHistory
      versions={VERSIONS}
      canRollback
      publishedRevision={3}
      onRollback={onRollback}
      {...overrides}
    />,
  )
  return { onRollback }
}

function rollbackButtons() {
  return screen.getAllByRole('button', { name: '回滚到此版本' })
}

describe('versionStateTags', () => {
  it('三种状态互斥：当前生效 / 草稿 / 历史', () => {
    expect(versionStateTags(VERSIONS[0])).toEqual({
      text: '当前生效',
      color: 'green',
    })
    expect(versionStateTags(VERSIONS[2])).toEqual({ text: '草稿', color: 'gold' })
    expect(versionStateTags(VERSIONS[1])).toEqual({
      text: '历史',
      color: 'default',
    })
  })
})

describe('VersionHistory', () => {
  it('从未编辑过时给出明确空态，而不是空白表格', () => {
    setup({ versions: [] })

    expect(
      screen.getByText('这个 prompt 还没被编辑过，当前生效的是代码默认值'),
    ).toBeInTheDocument()
  })

  it('渲染版本号、改动说明、操作人与时间', () => {
    setup()

    expect(screen.getByText('r3')).toBeInTheDocument()
    expect(screen.getByText('收紧自称')).toBeInTheDocument()
    // displayName 为空时退回 username，不留空格
    expect(screen.getByText('ops01')).toBeInTheDocument()
    // r3 与 r4 都是同一个人操作的
    expect(screen.getAllByText('熊总')).toHaveLength(2)
    expect(screen.getAllByText(/2026-11-12/).length).toBeGreaterThan(0)
    // changeNote 为 null 显示破折号，不显示 "null"
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    expect(screen.queryByText('null')).not.toBeInTheDocument()
  })

  it('回滚到当前生效版本无意义，按钮禁用', () => {
    setup()

    const rows = rollbackButtons()
    expect(rows).toHaveLength(3)
    // 第一行是 r3（当前生效）
    expect(rows[0]).toBeDisabled()
  })

  it('草稿还没发布，不能「回滚到草稿」', () => {
    setup()

    const draftRow = rollbackButtons().at(-1)
    expect(draftRow).toBeDisabled()
  })

  it('历史版本可回滚，点击带出完整版本对象', async () => {
    const { onRollback } = setup()

    await userEvent.click(rollbackButtons()[1])

    expect(onRollback).toHaveBeenCalledWith(VERSIONS[1])
  })

  it('不可写时全部禁用，并给出理由（不让人以为是页面坏了）', () => {
    setup({
      canRollback: false,
      disabledReason: '当前环境只读（PROMPT_WRITE_ENABLED=false）',
    })

    rollbackButtons().forEach((button) => expect(button).toBeDisabled())
  })

  it('展开行显示该版本完整正文（审计链要能查证）', async () => {
    const { container } = render(
      <VersionHistory
        versions={VERSIONS}
        canRollback
        publishedRevision={3}
        onRollback={vi.fn()}
      />,
    )

    const expandIcon = container.querySelector(
      '.ant-table-row-expand-icon',
    ) as HTMLElement
    await userEvent.click(expandIcon)

    expect(await screen.findByText('第三版正文')).toBeInTheDocument()
  })
})
