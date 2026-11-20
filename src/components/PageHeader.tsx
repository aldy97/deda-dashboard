import type { ReactNode } from 'react'
import { Typography } from 'antd'

interface PageHeaderProps {
  title: string
  /** 标题下方的次级说明；缺省不渲染，保证结构不因漏传而漂移。 */
  description?: ReactNode
  /** 右侧操作区（日期选择、刷新、环境标签等）；缺省不渲染。 */
  actions?: ReactNode
}

/**
 * 全站统一的页面头部：标题 + 可选描述在左，操作在右。
 *
 * 之前各页面各自手写 header，间距与结构逐页漂移（fleet / prompts 就是
 * 离群的两个）。收敛到这一个组件后，现有与未来的所有 tab 共用同一套
 * 「flex 两端对齐 + 标题 level 4 + 描述次级色 + 16px 下边距」的样式。
 */
export default function PageHeader({
  title,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        flexWrap: 'wrap',
        gap: 12,
      }}
    >
      <div>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
        {description != null && (
          <Typography.Text type="secondary">{description}</Typography.Text>
        )}
      </div>
      {actions != null && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {actions}
        </div>
      )}
    </div>
  )
}
