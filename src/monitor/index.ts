// ARMS 前端监控（alife-logger）惰性封装。
// - VITE_ARMS_PID 为空（本地开发 / CI 未配置环境变量）时整体 no-op，不产生任何上报；
// - 所有上报动作 fire-and-forget 并包 try/catch，监控故障绝不影响业务代码；
// - 登录是 GET、密码在 query string 里，必须通过 ignoreApis 排除，防止明文进入 ARMS 日志。
import BrowserLogger from 'alife-logger'
import type { ArmsLogger } from 'alife-logger'

let logger: ArmsLogger | null = null

/**
 * history 模式 SPA 的 PV 上报：SDK 自带的 enableSPA 只监听 hashchange，
 * 本项目用 createBrowserRouter（history 路由），因此劫持 pushState/replaceState/popstate，
 * 路由变化时以 pathname 重新 setPage（默认会触发一次 PV 上报）。
 */
function hookSpaRouteChange(instance: ArmsLogger): void {
  const report = () => {
    try {
      instance.setPage(window.location.pathname)
    } catch {
      /* 上报失败静默 */
    }
  }
  for (const type of ['pushState', 'replaceState'] as const) {
    const original = history[type]
    history[type] = function (this: History, ...args: Parameters<History[typeof type]>) {
      const result = original.apply(this, args)
      report()
      return result
    } as History[typeof type]
  }
  window.addEventListener('popstate', report)
}

/** 在渲染前调用一次；pid 未配置时直接返回，不加载任何监控行为。 */
export function initMonitor(): void {
  const pid = import.meta.env.VITE_ARMS_PID as string | undefined
  if (!pid || typeof window === 'undefined') return
  try {
    logger = BrowserLogger.singleton({
      pid,
      ignore: {
        // 登录接口 /analytics/auth/login?username=..&password=..，严禁进入 RUM 日志
        ignoreApis: [/auth\/login/],
      },
    })
    hookSpaRouteChange(logger)
  } catch {
    logger = null
  }
}

/**
 * API 系统级故障上报。仅由 client.ts 在 5xx 或网络层错误（超时/断网）时调用；
 * 401/403（登录跳转）与业务 code != 0 不上报。
 */
export function reportApiError(
  api: string,
  status: number | undefined,
  message: string,
): void {
  try {
    logger?.error(new Error(`[API] ${api} ${status ?? 'NETWORK'}: ${message}`))
  } catch {
    /* 上报失败静默 */
  }
}
