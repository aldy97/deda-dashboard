import type { CSSProperties, ReactNode } from 'react'
import { Typography } from 'antd'

/**
 * 复制入口的唯一实现：antd Typography 的 copyable 图标。
 *
 * 行为与消息详情 drawer 的设备 ID 一致——点图标复制，图标 hover 提示「复制 X」，
 * 复制成功后提示变「已复制」。不弹 message，不额外上报。
 * 只传 text 时渲染纯图标（放在 ID 文本/链接旁边）；传 children 时文本与图标一起渲染。
 */
interface Props {
  /** 复制到剪贴板的文本 */
  text: string
  /** 复制前的提示文案，默认「复制」；已复制后固定「已复制」 */
  tip?: string
  /** 可见文本；不传则只渲染复制图标 */
  children?: ReactNode
  style?: CSSProperties
  ellipsis?: boolean
}

export default function CopyableText({
  text,
  tip = '复制',
  children,
  style,
  ellipsis,
}: Props) {
  return (
    <Typography.Text
      copyable={{ text, tooltips: [tip, '已复制'] }}
      style={style}
      ellipsis={ellipsis}
    >
      {children}
    </Typography.Text>
  )
}
