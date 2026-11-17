/**
 * dashboard 管理员 token 的存取收口。
 *
 * 之前 token 读写散在 4 个文件里（api/client 的请求拦截器与 401 处理、
 * router 的登录闸口、Login 的写入、AdminLayout 的登出），每处都自己摸
 * sessionStorage。收口到这里之后，换存储介质只改一个文件。
 *
 * ## 为什么是 localStorage
 *
 * 服务端已经把 dashboard token 的有效期提到 7 天（deda-server 的
 * ANALYTICS_JWT_EXPIRES_IN，见该仓 PR #67）。但 sessionStorage 的生命周期
 * 就是「标签页会话」——关掉标签页、重启浏览器即清空，token 再长寿也留不住，
 * 「一周免登录」无从谈起。要兑现 7 天就必须换 localStorage。
 *
 * ## 代价（这是能看到儿童数据的内部看板，必须写清楚）
 *
 * - XSS 的窃取窗口从「标签页会话」扩大到 token 的整个有效期；
 * - 共享电脑、离开工位不锁屏时，浏览器一开就是登录态；
 * - 存储从 per-tab 变成 per-origin：一个标签页登出，其它标签页的 token 也一并
 *   消失，而它们不会立刻感知，要到下次请求吃 401 才被踢回登录页。
 *
 * 换回来的是 7 天内不必每天重新登录。登出必须走 clearToken()，
 * 只删 TOKEN_KEY 会把签发时间留下，污染下一次登录的兜底计时。
 *
 * ## 过期判定为什么不看 token 里的 exp
 *
 * exp 是服务端时钟签的。客户端时钟快几分钟就会把有效 token 判成过期、
 * 把人反复登出，而且这种故障极难排查（换台机器就好了）。所以真正的过期
 * 判定交给服务端 401——api/client.ts 的拦截器会带着当前页跳登录，
 * 重新登录后能回到原位。这里只留一个阈值明显偏宽的本地兜底，
 * 专门挡「服务端 TTL 被改短后，本地还躺着一个早已失效的僵尸 token」。
 */

/** token 在 localStorage 里的键名。全站唯一来源，别再从 api/client 导出 */
export const TOKEN_KEY = 'deda_dashboard_token'

/** 本地签发时间戳的键名，只服务于下面的陈旧兜底，不参与任何鉴权判断 */
export const ISSUED_AT_KEY = 'deda_dashboard_token_issued_at'

/** 兜底上限：比服务端的 7 天 TTL 宽一天，宁可晚清不可早清 */
const STALE_AFTER_MS = 8 * 24 * 60 * 60 * 1000

/**
 * 本地兜底是否认为 token 已经陈旧。
 *
 * 签发时间缺失或被写坏时一律返回 false（不清理）：这两种情况只可能来自
 * 旧版本遗留或人为篡改，交给服务端 401 判定比在客户端猜更安全。
 */
export function isStaleToken(now: number = Date.now()): boolean {
  const raw = localStorage.getItem(ISSUED_AT_KEY)
  if (raw === null) return false
  const issuedAt = Number(raw)
  if (!Number.isFinite(issuedAt)) return false
  return now - issuedAt > STALE_AFTER_MS
}

/** 取当前 token；没有、是空白、或已过本地兜底上限都返回 null */
export function getToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token || !token.trim()) return null
  if (isStaleToken()) {
    clearToken()
    return null
  }
  return token
}

/** 写入 token 并记下本地签发时间，重复登录会整体覆盖 */
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(ISSUED_AT_KEY, String(Date.now()))
}

/** 登出／会话失效时清空。token 与签发时间必须一起清 */
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(ISSUED_AT_KEY)
}
