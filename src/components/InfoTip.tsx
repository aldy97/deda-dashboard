import { QuestionCircleOutlined } from '@ant-design/icons'
import { Tooltip } from 'antd'
import type { ReactNode } from 'react'

/**
 * 全站统一的指标/术语解释入口：问号图标触发悬浮说明。
 * 约定：解释性提示一律用 InfoTip；纯内容预览（如省略文本展开）仍用 Tooltip。
 * 文案必须锚定后端真实口径与业务场景，不写泛泛的词典定义。
 */
export default function InfoTip({ title }: { title: ReactNode }) {
  return (
    <Tooltip title={title} styles={{ root: { maxWidth: 320 } }}>
      {/* antd 图标默认 vertical-align:-0.125em，与文字基线对齐；勿覆盖 */}
      <QuestionCircleOutlined
        style={{
          color: 'rgba(0, 0, 0, 0.35)',
          fontSize: 12,
          marginLeft: 4,
          cursor: 'help',
        }}
      />
    </Tooltip>
  )
}
