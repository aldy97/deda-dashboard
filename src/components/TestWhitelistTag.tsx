import { Tag } from 'antd'

/**
 * 测试设备白名单备注标签：设备舰队与消息明细共用同一视觉口径。
 *
 * 有备注显示备注，备注为空（null / 全空白）回落「白名单」；
 * 单行省略且不参与压缩，同行的设备标识让出宽度。只对超管可见——
 * 数据源 `/analytics/test-devices` 由服务端 SuperAdminGuard 把守。
 */
export default function TestWhitelistTag({
  note,
}: {
  note: string | null | undefined
}) {
  const text = note?.trim() || '白名单'
  return (
    <Tag
      color="gold"
      title={text}
      style={{
        marginInlineEnd: 0,
        flexShrink: 0,
        maxWidth: 96,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </Tag>
  )
}
