import { Tooltip } from 'antd'
import type { CSSProperties, MouseEventHandler, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { isExclusivePath } from '../../layouts/menu'
import { linkHintTitle, type LinkHintTarget } from './link-hints'
import { useViewerRole } from './use-viewer-role'

/**
 * 全站统一的可跳转入口。
 *
 * 1. 目标是非运维页：渲染普通 Link，并挂一个「点下去会到哪」的悬停提示。
 * 2. 目标是运维组（/llm、/prompts、/adventure、/test-devices …）：
 *    - superadmin 看到链接 + 提示；
 *    - 普通 admin（以及 meta 未就绪 / 失败）看到同字号、同字体的灰色纯文本，
 *      不带 href、不带箭头、不出提示——点进去只有雾层，不如不给死链。
 *
 * 是否超管专属由 `to` 派生（isExclusivePath），调用点不声明、也无法漏配；
 * 新增运维页只改 src/layouts/menu.ts 的 OPS_PATHS。
 *
 * 文案只来自 link-hints 的目标键，不接受自由文本：同一目的地散落在多个页面时
 * 文案不会各写一份。
 */
export interface AccessLinkProps
  extends Omit<
    LinkProps,
    'children' | 'className' | 'style' | 'title' | 'onClick'
  > {
  hint: LinkHintTarget
  /** 目标页内的具体位置，如「该集版本快照」 */
  detail?: string
  /** 一起带过去的上下文，如 ['deviceId'] */
  carries?: readonly string[]
  /** 仅 superadmin 侧渲染「 →」；admin 侧文本永远不带箭头 */
  arrow?: boolean
  className?: string
  style?: CSSProperties
  title?: string
  onClick?: MouseEventHandler<HTMLAnchorElement>
  'data-testid'?: string
  children?: ReactNode
}

const TOOLTIP_STYLES = { root: { maxWidth: 320 } }
/** 与 antd 的 secondary 文本同色：admin 侧只保留「这是文本」的观感 */
const RESTRICTED_COLOR = 'rgba(0, 0, 0, 0.45)'

export default function AccessLink({ to, ...rest }: AccessLinkProps) {
  return isExclusivePath(String(to)) ? (
    <ExclusiveLink to={to} {...rest} />
  ) : (
    <PlainLink to={to} {...rest} />
  )
}

/** 非专属目标：不读 meta，因此无 QueryClientProvider 的测试与组件也能直接用 */
function PlainLink({
  hint,
  detail,
  carries,
  arrow,
  children,
  title,
  ...linkProps
}: AccessLinkProps) {
  const tooltipTitle = withNativeTitle(
    linkHintTitle(hint, { detail, carries }),
    title,
  )
  return (
    <Tooltip title={tooltipTitle} styles={TOOLTIP_STYLES}>
      <Link data-hint={hint} {...linkProps}>
        {children}
        {arrow ? ' →' : null}
      </Link>
    </Tooltip>
  )
}

function ExclusiveLink({
  hint,
  detail,
  carries,
  arrow,
  children,
  title,
  style,
  className,
  onClick,
  'data-testid': dataTestId,
  ...linkProps
}: AccessLinkProps) {
  const viewer = useViewerRole()

  if (viewer !== 'superadmin') {
    return (
      <span
        className={className}
        data-testid={dataTestId}
        data-hint={hint}
        data-access="restricted"
        title={title}
        style={{ ...style, color: RESTRICTED_COLOR }}
      >
        {children}
      </span>
    )
  }

  const tooltipTitle = withNativeTitle(
    linkHintTitle(hint, { detail, carries, exclusive: true }),
    title,
  )
  return (
    <Tooltip title={tooltipTitle} styles={TOOLTIP_STYLES}>
      <Link
        data-hint={hint}
        data-testid={dataTestId}
        style={style}
        className={className}
        onClick={onClick}
        {...linkProps}
      >
        {children}
        {arrow ? ' →' : null}
      </Link>
    </Tooltip>
  )
}

/**
 * 原生 title 与 antd Tooltip 同时存在会出两层浮层：把完整值并进提示首行，
 * 并从链接上摘掉 title（admin 侧纯文本仍保留 title，截断值还能看全）。
 */
function withNativeTitle(text: string, nativeTitle?: string): string {
  return nativeTitle ? `${text}（${nativeTitle}）` : text
}
