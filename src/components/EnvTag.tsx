import { Tag, Tooltip } from 'antd'
import { ENV_TOOLTIP, UNKNOWN_ENV_VIEW, resolveEnvTag } from './env'

/**
 * 左上角环境标签：本地 / 测试 / 生产。
 *
 * 判定逻辑在 `./env`（环境值只信服务端 meta，取不到即「未知环境」）；
 * 这里只负责把结论渲染成一枚 Tag，并且 fail-closed 的两态——请求中与请求失败
 * ——都不许退回上一个已知值，否则管理员会看着「测试」的标签改生产 prompt。
 */

export interface EnvTagProps {
  nodeEnv?: string | null
  /** meta 请求进行中：环境未知，同样 fail-closed */
  loading?: boolean
  /** meta 请求失败 */
  failed?: boolean
}

export default function EnvTag({ nodeEnv, loading, failed }: EnvTagProps) {
  const view = failed || loading ? UNKNOWN_ENV_VIEW : resolveEnvTag(nodeEnv)
  const tooltip = loading
    ? '正在确认当前环境…'
    : failed
      ? ENV_TOOLTIP.unknown
      : ENV_TOOLTIP[view.tone]

  return (
    <Tooltip title={tooltip}>
      <Tag
        color={view.color}
        data-testid="env-tag"
        data-tone={view.tone}
        style={{
          marginInlineEnd: 0,
          fontWeight: view.production ? 700 : 400,
        }}
      >
        {loading ? '环境识别中' : view.text}
      </Tag>
    </Tooltip>
  )
}
