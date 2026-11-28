import { Tag } from 'antd'

/**
 * 手机号重复标记：同一号码被多个家长账号使用。
 *
 * 家长档案与「使用反馈」列表共用同一视觉与文案口径；`duplicate=false`
 * 时不渲染，调用方无需再包条件。灰色 Tag 仍由调用方按场景处理。
 */
export default function PhoneDuplicateTag({
  duplicate,
}: {
  duplicate: boolean
}) {
  if (!duplicate) return null
  return (
    <Tag
      color="gold"
      title="该手机号被多个家长账号使用；点击进入的是本条记录对应的账号"
      style={{ marginInlineEnd: 0 }}
    >
      重复
    </Tag>
  )
}
