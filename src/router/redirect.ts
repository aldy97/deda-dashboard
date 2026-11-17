/**
 * 登录意图（`/login?next=`）的读写契约。
 *
 * 未登录访问受保护页、会话中途过期被踢，这两条路径过去都直接把人扔到登录页，
 * 原始目标就地丢失，登录成功后只能落回硬编码的 /overview。这里把「意图」
 * 统一编码进 URL：刷新、分享、整页硬跳转三种场景都能还原。
 *
 * 单独成模块（而不是从 router/index.tsx 导出）有两个原因：一是 oxlint 的
 * only-export-components 不允许组件文件往外导非组件；二是 client.ts 的 401
 * 处理是 window.location.href 整页跳转，拿不到 router 上下文，必须复用同一套
 * 编码规则，否则两条路径拼出来的 next 会不一致。
 */

/** 登录页承载原始意图的查询参数名 */
export const LOGIN_NEXT_PARAM = 'next'

/** 没有意图、或意图非法时的落地页；路由表的 index 与 * 兜底也用它 */
export const DEFAULT_LANDING = '/overview'

/** 登录页自身。next 指向它会让「已登录访问 /login 自动跳走」的守卫自我重定向 */
const LOGIN_PATH = '/login'

/** 正常深链接远小于此；超长说明是畸形或恶意构造的值 */
const MAX_NEXT_LENGTH = 512

/**
 * 把 basename 前缀从浏览器地址栏的 pathname 上剥掉。
 *
 * 两套口径必须分清：router 内 useLocation().pathname **不含** basename
 * （/adventure），window.location.pathname **含**（/dashboard/adventure）。
 * src/api/client.ts 走的是后者。
 *
 * base 由调用方传入，不在这里读 import.meta.env.BASE_URL：vitest 没有配 base，
 * 测试环境里 BASE_URL 是 '/' 而不是 '/dashboard/'，读环境变量就永远测不到
 * 真实的换算逻辑。
 */
export function stripBase(pathname: string, base: string): string {
  const prefix = base.replace(/\/+$/, '')
  if (!prefix) return pathname
  if (pathname === prefix) return '/'
  if (!pathname.startsWith(`${prefix}/`)) return pathname
  // 走到这里 pathname 必然以 `${prefix}/` 开头，slice 至少剩一个 '/'，不会为空
  return pathname.slice(prefix.length)
}

/**
 * 开放重定向守卫：只接受站内相对路径，非法值返回 null 由调用方回落默认页。
 *
 * next 是地址栏里可以随便改的东西，校验松一点就把登录页变成跳板。
 * `//evil.com` 是协议相对 URL——用 window.location.href 跳会真的离开本站，
 * 所以不能依赖「react-router 会加 basename 因而跳不出去」这个巧合。
 * `/\evil.com` 在部分浏览器里等价于 `//evil.com`，同样拒绝。
 *
 * 不做路由白名单：不存在的 URL 会被路由表的 `*` 兜底送回 /overview，
 * 不白屏也不死循环，而维护一份白名单只会和路由表漂移。
 */
export function sanitizeNext(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const path = raw.trim()
  if (!path || path.length > MAX_NEXT_LENGTH) return null
  if (!path.startsWith('/')) return null
  // 第二个字符是 / 或 \ 都构成协议相对 URL
  if (path[1] === '/' || path[1] === '\\') return null
  if (path.includes('\\') || path.includes('://') || /\s/.test(path)) {
    return null
  }
  // 只看 pathname 部分：/login?next=… 与 /login#x 同样是登录页自身
  if (path.split(/[?#]/)[0] === LOGIN_PATH) return null
  return path
}

/**
 * 解析 next，返回「有效的站内意图」，没有或非法时返回 null。
 *
 * 返回 null 而不是直接兜底成默认页，是因为调用方需要区分两种情况：
 * 登录成功后 `intent ?? DEFAULT_LANDING` 决定去哪；而「已登录访问 /login」的
 * 守卫只在 intent 存在时才自动跳走——裸访问 /login 必须照常显示表单，
 * 否则 A 标签页登录着、B 标签页想换账号会被无声跳走。
 *
 * 容忍误粘带 basename 的完整路径（?next=/dashboard/adventure）。剥前缀不会
 * 变成绕过守卫的通道：剥完仍要过一遍 sanitizeNext，
 * `/dashboard//evil.com` 剥成 `//evil.com` 后照样被拒。
 */
export function resolveNextIntent(rawNext: unknown, base = ''): string | null {
  const stripped =
    typeof rawNext === 'string' ? stripBase(rawNext.trim(), base) : rawNext
  return sanitizeNext(stripped)
}

/**
 * 构造登录页的查询串，把原始意图整串编码进去。
 *
 * pathname + search + hash 必须一起带：`/adventure?tab=episodes&episodeId=X`
 * 少了 query 就还原不出抽屉状态，等于把人送到一张空表上。
 */
export function buildLoginSearch(
  pathname: string,
  search = '',
  hash = '',
): string {
  const target = `${pathname}${search}${hash}`
  const params = new URLSearchParams()
  params.set(LOGIN_NEXT_PARAM, target)
  return `?${params.toString()}`
}


/**
 * 会话失效时整页跳登录的目标 URL。
 *
 * src/api/client.ts 的 401/403 处理走的是 window.location.href 整页跳转，
 * 拿不到 router 上下文，只能自己换算 basename：window.location.pathname **含**
 * /dashboard，而 next 里要存的是 router 口径（不含），否则登录成功后
 * navigate 会拼出 /dashboard/dashboard/adventure。
 *
 * base 一律由调用方传 import.meta.env.BASE_URL：函数自己不读环境变量，
 * 这样测试能显式传 '/dashboard/' 覆盖真实换算（vitest 没配 base，
 * 测试环境里 BASE_URL 是 '/'，读环境变量就永远走不到剥前缀那条分支）。
 */
export function buildLoginHref(
  pathname: string,
  search: string,
  base: string,
): string {
  return `${base}login${buildLoginSearch(stripBase(pathname, base), search)}`
}
