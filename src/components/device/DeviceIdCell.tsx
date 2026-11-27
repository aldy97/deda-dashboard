import { Link } from 'react-router-dom'
import TestWhitelistTag from '../TestWhitelistTag'

interface DeviceIdCellProps {
  /** 第一列文本：设备舰队用设备 ID，消息明细优先用 deviceCode */
  label: string
  /** 传了就渲染成指到设备详情的链接；不传是纯文本 */
  href?: string
  /**
   * 白名单备注：undefined = 不在册（不渲染 Tag）；
   * null = 在册但没写备注（Tag 回落「白名单」）。
   */
  whitelistNote?: string | null
}

const LABEL_STYLE = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const

/**
 * 设备 ID + 白名单备注 Tag 的单元格，设备舰队与消息明细共用。
 *
 * 两处只差「设备标识是不是链接」与数据来源，骨架完全一致；
 * Tag 槽位必须是 flex：普通行内 span 会多出约 3px 行盒高度，
 * 标签看起来比设备标识「高一截」。
 */
export default function DeviceIdCell({
  label,
  href,
  whitelistNote,
}: DeviceIdCellProps) {
  return (
    <div
      data-testid="device-id-cell"
      style={{
        // 第一列固定宽度：设备 ID 长短不影响第二列 Tag 的左边缘。
        display: 'grid',
        gridTemplateColumns: '104px minmax(0, 1fr)',
        alignItems: 'center',
        columnGap: 4,
        minWidth: 0,
      }}
    >
      {href ? (
        <Link
          data-testid="device-id-label"
          to={href}
          onClick={(e) => e.stopPropagation()}
          title={label}
          style={LABEL_STYLE}
        >
          {label}
        </Link>
      ) : (
        <span data-testid="device-id-label" title={label} style={LABEL_STYLE}>
          {label}
        </span>
      )}
      {whitelistNote !== undefined && (
        <span
          data-testid="device-whitelist-tag"
          // 只固定左边缘：不 stretch，Tag 宽度由备注内容决定；
          // flex 去掉行盒的额外高度，与设备标识垂直居中对齐。
          style={{
            justifySelf: 'start',
            display: 'flex',
            alignItems: 'center',
            minWidth: 0,
          }}
        >
          <TestWhitelistTag note={whitelistNote} />
        </span>
      )}
    </div>
  )
}
