import { describe, expect, it } from 'vitest'
import type { AnalyticsMeta } from '../../types/analytics'
import { isSuperAdmin } from './role'

const base = {
  nodeEnv: 'staging',
  promptWriteEnabled: true,
  publishConfirmCode: 'DEDA2025',
}

describe('isSuperAdmin', () => {
  it('只认服务端下发的 superadmin', () => {
    expect(
      isSuperAdmin({
        ...base,
        admin: { username: 'superadmin', displayName: '超管', role: 'superadmin' },
      }),
    ).toBe(true)
  })

  it('普通 admin 为 false', () => {
    expect(
      isSuperAdmin({
        ...base,
        admin: { username: 'ops', displayName: '运营', role: 'admin' },
      }),
    ).toBe(false)
  })

  it('meta 未就绪 / 请求失败 / 老后端没有 admin 块时一律 false（fail-closed）', () => {
    expect(isSuperAdmin(null)).toBe(false)
    expect(isSuperAdmin(undefined)).toBe(false)
    expect(isSuperAdmin({ ...base } as AnalyticsMeta)).toBe(false)
    expect(
      isSuperAdmin({
        ...base,
        admin: { username: 'x', displayName: 'x', role: 'root' as never },
      }),
    ).toBe(false)
  })
})
