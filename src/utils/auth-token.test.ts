import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ISSUED_AT_KEY,
  TOKEN_KEY,
  clearToken,
  getToken,
  isStaleToken,
  setToken,
} from './auth-token'

/**
 * token 存取收口的契约。
 *
 * 最关键的一条是「存在 localStorage 而不是 sessionStorage」：服务端已经把
 * dashboard token 的有效期提到 7 天（deda-server 的 ANALYTICS_JWT_EXPIRES_IN），
 * 但 sessionStorage 的生命周期就是标签页会话，关掉标签页即清空——token 再长寿
 * 也留不住，「一周免登录」无从谈起。这条必须有测试钉住，否则谁把它改回
 * sessionStorage 都不会有任何测试变红。
 *
 * 兜底清理刻意**不**用 token 里的 exp：exp 是服务端时钟签的，本地时钟快几分钟
 * 就会把有效 token 判成过期、把人反复登出，且极难排查。真正的过期判定交给
 * 服务端 401。这里的阈值取得比服务端 TTL 宽（8 天 > 7 天），宁可晚清不可早清。
 */

const BASE = new Date('2026-11-17T00:00:00Z')

/** 用固定的 UTC 时刻，避免本地 Asia/Shanghai 与 CI 的 UTC 跑出不同结果 */
function at(daysLater: number, secondsLater = 0) {
  const next = new Date(BASE)
  next.setUTCDate(next.getUTCDate() + daysLater)
  next.setUTCSeconds(next.getUTCSeconds() + secondsLater)
  vi.setSystemTime(next)
}

describe('auth-token', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(BASE)
    localStorage.clear()
    sessionStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
    sessionStorage.clear()
  })

  it('setToken 之后 getToken 原样读回', () => {
    setToken('tk-1')

    expect(getToken()).toBe('tk-1')
  })

  it('token 存在 localStorage，不存 sessionStorage', () => {
    setToken('tk-1')

    expect(localStorage.getItem(TOKEN_KEY)).toBe('tk-1')
    expect(sessionStorage.getItem(TOKEN_KEY)).toBeNull()
  })

  it('没有 token 时返回 null', () => {
    expect(getToken()).toBeNull()
  })

  it('空串与纯空白视为无 token，避免拿着空 Authorization 头发请求', () => {
    localStorage.setItem(TOKEN_KEY, '')
    expect(getToken()).toBeNull()

    localStorage.setItem(TOKEN_KEY, '   ')
    expect(getToken()).toBeNull()
  })

  it('重复登录覆盖旧 token，不残留上一个人的身份', () => {
    setToken('tk-old')
    setToken('tk-new')

    expect(getToken()).toBe('tk-new')
  })

  it('clearToken 把 token 与签发时间一起清掉', () => {
    setToken('tk-1')
    clearToken()

    expect(getToken()).toBeNull()
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
    expect(isStaleToken()).toBe(false)
    // 再登一次必须重新计时，不能被上一次的签发时间拖累
    setToken('tk-2')
    at(7)
    expect(getToken()).toBe('tk-2')
  })
})

describe('auth-token 陈旧兜底', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(BASE)
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  it('服务端 TTL（7 天）之内不算陈旧', () => {
    setToken('tk-1')
    at(7)

    expect(isStaleToken()).toBe(false)
    expect(getToken()).toBe('tk-1')
  })

  it('超过兜底上限算陈旧，getToken 顺手清掉而不是把僵尸 token 交出去', () => {
    setToken('tk-1')
    at(8, 1)

    expect(isStaleToken()).toBe(true)
    expect(getToken()).toBeNull()
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })

  it('签发时间记录缺失时不做兜底清理，交给服务端 401 判定', () => {
    localStorage.setItem(TOKEN_KEY, 'tk-legacy')

    expect(isStaleToken()).toBe(false)
    expect(getToken()).toBe('tk-legacy')
  })

  it('签发时间被写坏时同样不清理，宁可多留不可误删', () => {
    setToken('tk-1')
    // 先确认 setToken 真的写过签发时间，否则下面这行破坏的是不存在的键，用例会假绿
    expect(localStorage.getItem(ISSUED_AT_KEY)).not.toBeNull()
    localStorage.setItem(ISSUED_AT_KEY, 'not-a-number')

    expect(isStaleToken()).toBe(false)
    expect(getToken()).toBe('tk-1')
  })

  it('本地时钟倒退（签发时间在未来）不算陈旧', () => {
    setToken('tk-1')
    at(-1)

    expect(isStaleToken()).toBe(false)
    expect(getToken()).toBe('tk-1')
  })
})
