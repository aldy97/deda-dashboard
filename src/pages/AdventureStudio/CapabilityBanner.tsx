import { Alert, Space, Tag, Typography } from 'antd'
import type { ApiError } from '../../api/client'
import { useAdventureCapabilities } from '../../api/queries'
import { characterLabel } from './labels'

/**
 * 环境与能力横幅。
 *
 * 它回答管理员进页面后的第一个问题：「我现在能不能改？」
 * 答案完全来自服务端 capabilities，不看前端猜测——因为能不能写由两道正交的闸决定
 * （人的 scope + 环境的 CONTENT_ADMIN_PROFILE），前端无从得知，尤其是 prod 即使把
 * 账号白名单误配成和 staging 一样，profile 不是 authoring 依然写不动。
 *
 * 403 在这里是**正常结果**而不是故障：看板管理员默认没有 adventure-content scope，
 * 对他们连读都是 403。src/api/client.ts 对这个前缀的 403 刻意不清 token 不跳登录，
 * 否则一个没权限的人点开菜单就会被踢下线。
 */
export default function CapabilityBanner() {
  const caps = useAdventureCapabilities()

  if (caps.isPending) return null

  if (caps.error) {
    const error = caps.error as ApiError
    if (error.status === 403) {
      return (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="你没有冒险内容管理权限"
          description="内容管理台需要账号带 adventure-content scope，看板管理员默认没有。需要开通请联系后端管理员在 ANALYTICS_ADMIN_USERS 里加上这个 scope，然后重新登录。"
        />
      )
    }
    return (
      <Alert
        type="error"
        showIcon
        style={{ marginBottom: 16 }}
        message="能力清单加载失败"
        description={error.message}
      />
    )
  }

  const data = caps.data
  if (!data) return null

  const lint = data.lintThresholds
  const sim = data.simulationThresholds

  return (
    <Space orientation="vertical" size={8} style={{ width: '100%', marginBottom: 16 }}>
      {!data.authoring && (
        <Alert
          type="warning"
          showIcon
          message={`当前环境只读（CONTENT_ADMIN_PROFILE=${data.profile}），所有写操作会被服务端拒绝`}
          description="这是设计如此，不是故障：内容请先在 staging 改好、验证过，再用「跨环境搬运」整包导入到这里（导入同样需要 authoring，所以 prod 的写入只能由部署侧显式开放）。校验、试播、导入预览、审计与自愈面板在只读环境照常可用。"
        />
      )}

      <Space size={8} wrap>
        <Tag color={data.authoring ? 'green' : 'orange'}>
          {data.authoring ? '可写环境 · authoring' : `只读环境 · ${data.profile}`}
        </Tag>
        <Tag>第 {data.season} 季</Tag>
        {data.characterKeys.map((key) => (
          <Tag key={key}>{characterLabel(key)}</Tag>
        ))}
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          交互原语：
          {data.interactionTypes
            .map((type) => `${type}${data.replyWaitingInteractionTypes.includes(type) ? '（需孩子开口）' : ''}`)
            .join('、')}
        </Typography.Text>
      </Space>

      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        生效阈值（服务端可配，改环境变量即生效）：旁白 ≤ {lint.maxNarrationTextChars}{' '}
        字 · 互动引导词 ≤ {lint.maxInteractionTextChars} 字 · 标题 ≤{' '}
        {lint.maxTitleChars} 字 · 单集星光 ≤ {lint.maxStarsPerEpisode} 颗 · 开口次数 ≤{' '}
        {sim.maxAwaitPoints} 次 · 预计时长 ≤ {Math.round(sim.maxSessionSeconds / 60)}{' '}
        分钟{lint.forbiddenWords.length > 0 && ` · 禁用词 ${lint.forbiddenWords.length} 个`}
      </Typography.Text>
    </Space>
  )
}
