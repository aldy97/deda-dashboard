import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useViewerRole } from './use-viewer-role'

const mockUseAnalyticsMeta = vi.fn()
vi.mock('../../api/meta', () => ({
  useAnalyticsMeta: () => mockUseAnalyticsMeta(),
}))

describe('useViewerRole', () => {
  beforeEach(() => {
    mockUseAnalyticsMeta.mockReset()
  })

  it('superadmin 角色 → superadmin', () => {
    mockUseAnalyticsMeta.mockReturnValue({
      data: { admin: { role: 'superadmin' } },
      isPending: false,
      isError: false,
    })
    expect(renderHook(() => useViewerRole()).result.current).toBe('superadmin')
  })

  it('普通 admin → restricted', () => {
    mockUseAnalyticsMeta.mockReturnValue({
      data: { admin: { role: 'admin' } },
      isPending: false,
      isError: false,
    })
    expect(renderHook(() => useViewerRole()).result.current).toBe('restricted')
  })

  it('meta 未就绪 → pending（不提前下结论）', () => {
    mockUseAnalyticsMeta.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
    })
    expect(renderHook(() => useViewerRole()).result.current).toBe('pending')
  })

  it('meta 失败 → unknown（fail-closed，按无权限处理）', () => {
    mockUseAnalyticsMeta.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
    })
    expect(renderHook(() => useViewerRole()).result.current).toBe('unknown')
  })
})
