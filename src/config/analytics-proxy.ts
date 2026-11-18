/**
 * dev proxy 的 target 解析。本地设备已绑定 staging 服务器，本地开发不再跑
 * 后端与数据库：`/analytics` 默认转发 staging，环境标签也随之从 staging 的
 * `/analytics/meta` 取 `nodeEnv: 'staging'`。
 * 要临时联调本地后端，建 `.env.development.local`（已被 gitignore）覆盖
 * VITE_ANALYTICS_PROXY_TARGET，不要改仓库代码。
 */
export const DEFAULT_DEV_PROXY_TARGET = 'https://staging.valleyletters.com'

const ENV_KEY = 'VITE_ANALYTICS_PROXY_TARGET'

export function resolveAnalyticsProxyTarget(
  env: Record<string, string | undefined>,
): string {
  const raw = env[ENV_KEY]?.trim()
  if (!raw) return DEFAULT_DEV_PROXY_TARGET
  const target = raw.replace(/\/+$/, '')
  if (!/^https?:\/\/\S+$/.test(target)) {
    throw new Error(
      `${ENV_KEY} 必须是 http(s) URL，当前值：${raw}（留空则回落 ${DEFAULT_DEV_PROXY_TARGET}）`,
    )
  }
  return target
}
