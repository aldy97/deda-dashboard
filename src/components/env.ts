/**
 * 环境判定：本地 / 测试 / 生产 / 未知。
 *
 * 环境值只从 `GET /analytics/meta` 的 `nodeEnv` 来，**不从前端构建期变量推断**：
 * 同一份 dist 会被部署到三个环境，构建期常量只会给出一个恒定的错误答案。
 *
 * fail-closed 是这套判定存在的理由：拿不到 meta（请求失败 / 尚未返回）时一律
 * 按「未知环境」处理，调用方据此禁用发布、回滚、恢复默认。宁可让管理员多刷新
 * 一次，也不能让人以为自己在测试环境却改动了生产 prompt。
 */

export type EnvTone = 'local' | 'staging' | 'production' | 'unknown'

export interface EnvView {
  tone: EnvTone
  text: string
  /** antd Tag 预设色 */
  color: string
  /** 生产环境：发布弹窗要多加一档勾选确认 */
  production: boolean
  /** false = 环境没认出来，写操作必须禁用 */
  known: boolean
}

const VIEWS: Record<EnvTone, EnvView> = {
  local: {
    tone: 'local',
    text: '本地',
    color: 'green',
    production: false,
    known: true,
  },
  staging: {
    tone: 'staging',
    text: '测试',
    color: 'orange',
    production: false,
    known: true,
  },
  production: {
    tone: 'production',
    text: '生产',
    color: 'red',
    production: true,
    known: true,
  },
  unknown: {
    tone: 'unknown',
    text: '未知环境',
    color: 'default',
    production: false,
    known: false,
  },
}

export const UNKNOWN_ENV_VIEW = VIEWS.unknown

/** NODE_ENV 取值 → 标签。无法识别的值一律落到「未知环境」，不猜 */
export function resolveEnvTag(nodeEnv: string | null | undefined): EnvView {
  switch (nodeEnv) {
    case 'development':
      return VIEWS.local
    case 'staging':
      return VIEWS.staging
    case 'production':
      return VIEWS.production
    default:
      return UNKNOWN_ENV_VIEW
  }
}

/**
 * 写操作是否放开。两个条件都必须成立：
 * 环境认得出来（fail-closed）+ 服务端写开关是开的。
 * meta 还没到手时 `promptWriteEnabled` 是 undefined，同样判为不可写。
 */
export function isPromptWritable(
  env: EnvView,
  promptWriteEnabled: boolean | undefined,
): boolean {
  return env.known && promptWriteEnabled === true
}

export const ENV_TOOLTIP: Record<EnvTone, string> = {
  local: 'NODE_ENV=development：改动只影响本地开发环境',
  staging: 'NODE_ENV=staging：改动影响测试环境设备',
  production: 'NODE_ENV=production：发布将立即对所有线上设备生效',
  unknown:
    '取不到 /analytics/meta，无法确认当前环境。已按 fail-closed 禁用发布、回滚与恢复默认，请刷新或检查登录状态。',
}
