import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import AuditLog from './AuditLog'
import { useAdventureAudit } from '../../api/queries'
import type { AuditItem, AuditListResponse } from '../../types/adventureAdmin'

/**
 * 审计流水的三个骨架：理由常驻、detail 可展开、分页/筛选的改动都要重新问服务端。
 * 日期区间控件替身化：本文件的考核对象是 AuditLog 自己（谁在什么条件下改 page、
 * 怎么把区间换算成 ISO），不是 antd RangePicker 的交互。
 */
vi.mock('../../api/queries', () => ({
  useAdventureAudit: vi.fn(),
}))

vi.mock('../../components/AnalyticsRangePicker', async () => {
  const { default: dayjs } = await import('dayjs')
  return {
    default: (props: { onChange: (range: unknown) => void }) => (
      <button
        type="button"
        onClick={() =>
          props.onChange([dayjs('2026-11-01'), dayjs('2026-11-10')])
        }
      >
        选择区间
      </button>
    ),
  }
})

const mockAudit = useAdventureAudit as unknown as ReturnType<typeof vi.fn>

function item(index: number, overrides: Partial<AuditItem> = {}): AuditItem {
  return {
    id: `audit-${index}`,
    action: 'publish',
    entityType: 'episode',
    episodeId: 'ep1',
    episodeVersionId: 'ver-1',
    businessKey: 'elly/1/1',
    actorUsername: 'alice',
    actorDisplayName: 'Alice 管理员',
    profile: 'authoring',
    reason: '发布第一集，内容已通过校验',
    detail: null,
    sourceBundleHash: null,
    createdAt: '2026-11-20T04:00:00.000Z',
    ...overrides,
  }
}

function items(count: number): AuditItem[] {
  return Array.from({ length: count }, (_, index) => item(index))
}

function state(data: AuditListResponse | undefined, overrides = {}) {
  return { data, isLoading: false, error: null, ...overrides }
}

function renderLog(props: { episodeId?: string } = {}) {
  return render(<AuditLog {...props} />)
}

describe('AuditLog · 加载与失败', () => {
  it('首屏加载时表格转圈，并把默认分页参数交给 hook', () => {
    mockAudit.mockReturnValue(state(undefined, { isLoading: true }))

    renderLog()

    expect(document.querySelector('.ant-spin-spinning')).not.toBeNull()
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        episodeId: undefined,
        action: undefined,
        actorUsername: undefined,
        from: undefined,
        to: undefined,
        page: 1,
        pageSize: 20,
      }),
    )
  })

  it('加载失败给出服务端 message，不伪装成空列表', () => {
    mockAudit.mockReturnValue(state(undefined, { error: new Error('审计服务挂了') }))

    renderLog()

    expect(screen.getByText('审计流水加载失败')).toBeInTheDocument()
    expect(screen.getByText('审计服务挂了')).toBeInTheDocument()
    // 没有数据可渲染时仍是空态，但错误提示已经在上面明确说出来
    expect(screen.getByText('没有符合条件的审计记录')).toBeInTheDocument()
  })

  it('没有记录时显示空态', () => {
    mockAudit.mockReturnValue(state({ items: [], total: 0 }))

    renderLog()

    expect(screen.getByText('没有符合条件的审计记录')).toBeInTheDocument()
  })

  it('传 episodeId 时收窄到本集审计', () => {
    mockAudit.mockReturnValue(state({ items: [], total: 0 }))

    renderLog({ episodeId: 'ep1' })

    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ episodeId: 'ep1' }),
    )
  })
})

describe('AuditLog · 列表与 detail 展开', () => {
  it('理由、操作人、环境常驻显示；理由为空时给破折号', () => {
    const rows = [
      item(0, {
        detail: { plan: 'sweep', devices: 2 },
        action: 'recovery_sweep',
      }),
      item(1, {
        action: 'retire',
        profile: 'readonly',
        reason: null,
        actorUsername: 'bob',
        actorDisplayName: 'Bob 管理员',
      }),
    ]
    mockAudit.mockReturnValue(state({ items: rows, total: 2 }))

    renderLog()

    expect(screen.getByText('手动巡检')).toBeInTheDocument()
    expect(screen.getByText('下架')).toBeInTheDocument()
    expect(screen.getAllByText('elly/1/1')).toHaveLength(2)
    expect(screen.getByText('Alice 管理员')).toBeInTheDocument()
    expect(screen.getByText('Bob 管理员')).toBeInTheDocument()
    expect(screen.getByText('发布第一集，内容已通过校验')).toBeInTheDocument()
    expect(screen.getByText('authoring')).toBeInTheDocument()
    expect(screen.getByText('readonly')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByText(/共 2 条/)).toBeInTheDocument()
  })

  it('有 detail 的行可展开，并原样展示 JSON；没有 detail 的行不可展开', () => {
    const rows = [
      item(0, { detail: { plan: 'sweep', devices: 2 } }),
      item(1, { detail: null }),
      item(2, { detail: { nested: { ok: true } } }),
    ]
    mockAudit.mockReturnValue(state({ items: rows, total: 3 }))

    renderLog()

    const expanders = document.querySelectorAll(
      '.ant-table-row-expand-icon:not(.ant-table-row-expand-icon-spaced)',
    )
    expect(expanders).toHaveLength(2)

    fireEvent.click(expanders[0])
    const pre = document.querySelector('pre')
    expect(pre).not.toBeNull()
    expect(pre?.textContent).toContain('"plan": "sweep"')
    expect(pre?.textContent).toContain('"devices": 2')
  })

  it('detail 为空的行点不出「无附加信息」块', () => {
    mockAudit.mockReturnValue(state({ items: [item(0)], total: 1 }))

    renderLog()

    expect(screen.queryByText('无附加信息')).not.toBeInTheDocument()
    expect(
      document.querySelector('.ant-table-row-expand-icon-spaced'),
    ).not.toBeNull()
  })
})

describe('AuditLog · 筛选与分页', () => {
  it('改动作筛选：把 action 交给服务端并把页码重置为 1', async () => {
    mockAudit.mockReturnValue(state({ items: items(25), total: 25 }))
    renderLog()

    fireEvent.click(
      document.querySelector('.ant-pagination-item-2 a') as Element,
    )
    await waitFor(() =>
      expect(mockAudit).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 }),
      ),
    )

    fireEvent.mouseDown(screen.getAllByRole('combobox')[0])
    const option = await screen.findByTitle('发布')
    fireEvent.click(option)

    await waitFor(() =>
      expect(mockAudit).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: 'publish', page: 1 }),
      ),
    )
  })

  it('操作人输入即时带上 actorUsername，并把页码重置为 1', async () => {
    mockAudit.mockReturnValue(state({ items: items(25), total: 25 }))
    renderLog()

    fireEvent.click(
      document.querySelector('.ant-pagination-item-2 a') as Element,
    )
    await waitFor(() =>
      expect(mockAudit).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 }),
      ),
    )

    fireEvent.change(screen.getByPlaceholderText('操作人 username'), {
      target: { value: 'bob' },
    })

    await waitFor(() =>
      expect(mockAudit).toHaveBeenLastCalledWith(
        expect.objectContaining({ actorUsername: 'bob', page: 1 }),
      ),
    )
  })

  it('选择日期区间：换算成当天起止 ISO 交给服务端，页码重置', async () => {
    mockAudit.mockReturnValue(state({ items: items(25), total: 25 }))
    renderLog()

    fireEvent.click(screen.getByRole('button', { name: '选择区间' }))

    await waitFor(() => {
      const last = mockAudit.mock.calls.at(-1)?.[0] as {
        from?: string
        to?: string
        page?: number
      }
      expect(last.page).toBe(1)
      expect(last.from).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(last.to).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(new Date(last.to as string).getTime()).toBeGreaterThan(
        new Date(last.from as string).getTime(),
      )
    })
  })

  it('翻页只改 page，不改筛选条件', async () => {
    mockAudit.mockReturnValue(state({ items: items(25), total: 25 }))
    renderLog()

    fireEvent.click(
      document.querySelector('.ant-pagination-item-2 a') as Element,
    )

    await waitFor(() =>
      expect(mockAudit).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2, pageSize: 20, action: undefined }),
      ),
    )
    // 第二页只渲染剩下的 5 条
    expect(screen.getAllByText('elly/1/1')).toHaveLength(5)
  })
})
