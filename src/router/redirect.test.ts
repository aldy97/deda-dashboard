import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LANDING,
  LOGIN_NEXT_PARAM,
  buildLoginHref,
  buildLoginSearch,
  resolveNextIntent,
  sanitizeNext,
  stripBase,
} from './redirect'

/**
 * 登录意图（?next=）的纯函数契约。
 *
 * 这里守的是两类在界面上完全看不出来的回归：
 *
 * 1. 开放重定向。next 是浏览器地址栏里可以随便改的东西，校验松一点就变成
 *    跳板。`//evil.com` 这类协议相对 URL 用 window.location.href 跳会真的离开
 *    本站（src/api/client.ts 正是整页硬跳转），不能依赖「react-router 会加
 *    basename 所以跳不出去」这个巧合。
 * 2. basename 口径。router 内 useLocation().pathname 不含 /dashboard，
 *    window.location.pathname 含。两套口径混用会拼出 /dashboard/dashboard/x。
 *    stripBase 因此必须接收 base 参数而不是自己读 import.meta.env——vitest
 *    没配 base，测试环境里 BASE_URL 是 '/'，读环境变量就永远测不到真实换算。
 */

describe('stripBase', () => {
  it('剥掉 basename 前缀', () => {
    expect(stripBase('/dashboard/adventure', '/dashboard/')).toBe('/adventure')
    expect(stripBase('/dashboard/adventure', '/dashboard')).toBe('/adventure')
  })

  it('pathname 恰好等于 basename 时回落到根', () => {
    expect(stripBase('/dashboard', '/dashboard/')).toBe('/')
    expect(stripBase('/dashboard/', '/dashboard/')).toBe('/')
  })

  it('不含前缀的路径原样返回', () => {
    expect(stripBase('/adventure', '/dashboard/')).toBe('/adventure')
  })

  it('不能把同前缀的其它路径误判成 basename', () => {
    expect(stripBase('/dashboardfoo/x', '/dashboard/')).toBe('/dashboardfoo/x')
  })

  it("base 是 '/'（vitest 环境的 BASE_URL）时为无操作", () => {
    expect(stripBase('/adventure', '/')).toBe('/adventure')
    expect(stripBase('/adventure', '')).toBe('/adventure')
  })

  it('深层路径与多级 basename 都能剥', () => {
    expect(stripBase('/dashboard/users/dev-001', '/dashboard/')).toBe(
      '/users/dev-001',
    )
  })
})

describe('sanitizeNext', () => {
  it('接受站内相对路径', () => {
    expect(sanitizeNext('/adventure')).toBe('/adventure')
    expect(sanitizeNext('/')).toBe('/')
    expect(sanitizeNext('/users/dev-001')).toBe('/users/dev-001')
  })

  it('整串保留深链接的 query 与 hash', () => {
    expect(sanitizeNext('/adventure?tab=episodes&episodeId=X')).toBe(
      '/adventure?tab=episodes&episodeId=X',
    )
    expect(sanitizeNext('/messages?deviceId=d1#turn-2')).toBe(
      '/messages?deviceId=d1#turn-2',
    )
  })

  it('拒绝协议相对 URL 与绝对 URL', () => {
    expect(sanitizeNext('//evil.com')).toBeNull()
    expect(sanitizeNext('///evil.com')).toBeNull()
    expect(sanitizeNext('https://evil.com/x')).toBeNull()
    expect(sanitizeNext('http://evil.com')).toBeNull()
  })

  it('拒绝反斜杠变体（部分浏览器把 /\\evil.com 当成 //evil.com）', () => {
    expect(sanitizeNext('/\\evil.com')).toBeNull()
    expect(sanitizeNext('/adventure\\..\\..')).toBeNull()
  })

  it('拒绝没有前导斜杠的相对路径', () => {
    expect(sanitizeNext('adventure')).toBeNull()
    expect(sanitizeNext('./adventure')).toBeNull()
  })

  it('拒绝登录页自身，避免已登录守卫自我重定向成死循环', () => {
    expect(sanitizeNext('/login')).toBeNull()
    expect(sanitizeNext('/login?next=%2Fadventure')).toBeNull()
    expect(sanitizeNext('/login#x')).toBeNull()
  })

  it('对缺省、空白与非字符串一律拒绝', () => {
    expect(sanitizeNext(undefined)).toBeNull()
    expect(sanitizeNext(null)).toBeNull()
    expect(sanitizeNext('')).toBeNull()
    expect(sanitizeNext('   ')).toBeNull()
    expect(sanitizeNext(123)).toBeNull()
    expect(sanitizeNext({})).toBeNull()
    expect(sanitizeNext(['/adventure'])).toBeNull()
  })

  it('首尾空白要容忍，路径中间的空白要拒绝', () => {
    expect(sanitizeNext('  /adventure  ')).toBe('/adventure')
    expect(sanitizeNext('/adven ture')).toBeNull()
    expect(sanitizeNext('/adven\nture')).toBeNull()
  })

  it('超长值视为畸形', () => {
    expect(sanitizeNext(`/${'a'.repeat(600)}`)).toBeNull()
    expect(sanitizeNext(`/${'a'.repeat(400)}`)).toBe(`/${'a'.repeat(400)}`)
  })
})

describe('resolveNextIntent', () => {
  it('没有意图时返回 null，由调用方决定落到哪', () => {
    expect(resolveNextIntent(null)).toBeNull()
    expect(resolveNextIntent(undefined)).toBeNull()
    expect(resolveNextIntent('')).toBeNull()
  })

  it('意图非法时返回 null，而不是把脏值交给 navigate', () => {
    expect(resolveNextIntent('//evil.com')).toBeNull()
    expect(resolveNextIntent('/login')).toBeNull()
    expect(resolveNextIntent(123)).toBeNull()
  })

  it('意图合法时原样返回', () => {
    expect(resolveNextIntent('/adventure?tab=episodes')).toBe(
      '/adventure?tab=episodes',
    )
  })

  it('容忍误粘带 basename 的完整路径', () => {
    expect(resolveNextIntent('/dashboard/adventure', '/dashboard/')).toBe(
      '/adventure',
    )
    expect(
      resolveNextIntent('/dashboard/adventure?tab=audit', '/dashboard/'),
    ).toBe('/adventure?tab=audit')
  })

  it('剥 basename 不能变成绕过校验的通道', () => {
    expect(resolveNextIntent('/dashboard//evil.com', '/dashboard/')).toBeNull()
    expect(resolveNextIntent('/dashboard/login', '/dashboard/')).toBeNull()
  })
})

describe('buildLoginSearch', () => {
  it('把 pathname 编码进 next', () => {
    expect(buildLoginSearch('/adventure')).toBe(
      `?${LOGIN_NEXT_PARAM}=%2Fadventure`,
    )
  })

  it('pathname + search + hash 整串带上，且编码可逆', () => {
    const search = buildLoginSearch(
      '/adventure',
      '?tab=episodes&episodeId=X',
      '#top',
    )
    const params = new URLSearchParams(search)
    expect(params.get(LOGIN_NEXT_PARAM)).toBe(
      '/adventure?tab=episodes&episodeId=X#top',
    )
  })

  it('next 里的 & 与 = 必须被编码，否则会被当成登录页自己的参数', () => {
    const search = buildLoginSearch('/messages', '?deviceId=d1&role=user')
    const params = new URLSearchParams(search)
    expect(params.get(LOGIN_NEXT_PARAM)).toBe('/messages?deviceId=d1&role=user')
    expect(params.get('deviceId')).toBeNull()
    expect(params.get('role')).toBeNull()
  })

  it('search / hash 缺省时不产生多余字符', () => {
    expect(buildLoginSearch('/overview', '', '')).toBe(
      `?${LOGIN_NEXT_PARAM}=%2Foverview`,
    )
  })

  it('产出的 next 一定能被 sanitizeNext 接受（写读两端自洽）', () => {
    for (const [pathname, search] of [
      ['/adventure', '?tab=episodes&episodeId=X'],
      ['/users/dev-001', '?messageId=m1'],
      ['/overview', ''],
    ] as const) {
      const params = new URLSearchParams(buildLoginSearch(pathname, search))
      expect(sanitizeNext(params.get(LOGIN_NEXT_PARAM))).toBe(
        `${pathname}${search}`,
      )
    }
  })
})

describe('常量', () => {
  it('参数名与默认落地页是写读两端共用的唯一来源', () => {
    expect(LOGIN_NEXT_PARAM).toBe('next')
    expect(DEFAULT_LANDING).toBe('/overview')
  })
})


describe('buildLoginHref', () => {
  it('含 basename 的地址栏路径要换算成 router 口径再编码进 next', () => {
    // window.location.pathname 是 /dashboard/adventure，而 navigate() 需要
    // /adventure；不换算就会拼出 /dashboard/dashboard/adventure。
    expect(
      buildLoginHref('/dashboard/adventure', '?tab=x', '/dashboard/'),
    ).toBe('/dashboard/login?next=%2Fadventure%3Ftab%3Dx')
  })

  it("base 是 '/'（vitest 环境的 BASE_URL）时不做前缀换算", () => {
    expect(buildLoginHref('/adventure', '?tab=x', '/')).toBe(
      '/login?next=%2Fadventure%3Ftab%3Dx',
    )
  })

  it('没有 query 时只带 pathname', () => {
    expect(buildLoginHref('/dashboard/users/dev-001', '', '/dashboard/')).toBe(
      '/dashboard/login?next=%2Fusers%2Fdev-001',
    )
  })

  it('产出的 next 能被 resolveNextIntent 原样还原（写读两端自洽）', () => {
    const href = buildLoginHref(
      '/dashboard/adventure',
      '?tab=episodes&episodeId=X',
      '/dashboard/',
    )
    const search = href.slice(href.indexOf('?'))
    const next = new URLSearchParams(search).get(LOGIN_NEXT_PARAM)

    expect(resolveNextIntent(next, '/dashboard/')).toBe(
      '/adventure?tab=episodes&episodeId=X',
    )
  })

  it('已经在登录页时 next 指向自身，读端会拒绝而不是死循环', () => {
    const href = buildLoginHref('/dashboard/login', '', '/dashboard/')
    const next = new URLSearchParams(href.slice(href.indexOf('?'))).get(
      LOGIN_NEXT_PARAM,
    )

    expect(resolveNextIntent(next, '/dashboard/')).toBeNull()
  })
})
