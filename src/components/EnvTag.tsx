import { Tag, Tooltip } from 'antd'
import { ENV_TOOLTIP, UNKNOWN_ENV_VIEW, resolveEnvTag } from './env'

/**
 * 左上角环境标签：本地 / 测试 / 生产。
 *
 * 判定逻辑在 `./env`（环境值只信服务端 meta，取不到即「未知环境」）；
 * 这里只负责把结论渲染成一枚 Tag。请求中暂时不渲染（不显示任何看似结论的
 * 环境文案）；请求失败落「未知环境」。两态都不退回上一个已知值，否则管理员
 * 会看着「测试」的标签改生产 prompt。
 */

export interface EnvTagProps {
  nodeEnv?: string | null
  /** meta 请求进行中：环境未知，同样 fail-closed */
  loading?: boolean
  /** meta 请求失败 */
  failed?: boolean
}

export default function EnvTag({ nodeEnv, loading, failed }: EnvTagProps) {
  // 加载中暂时隐藏标签：环境未确认时不给任何「看起来像结论」的文案。
  // fail-closed 仍由调用方按 meta 状态执行，不依赖这枚标签是否可见。
  if (loading) return null

  const view = failed ? UNKNOWN_ENV_VIEW : resolveEnvTag(nodeEnv)
  const tooltip = failed ? ENV_TOOLTIP.unknown : ENV_TOOLTIP[view.tone]

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
        {view.text}
      </Tag>
    </Tooltip>
  )
}
