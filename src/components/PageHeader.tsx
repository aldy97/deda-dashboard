import type { ReactNode } from 'react'
import { Typography } from 'antd'

interface PageHeaderProps {
  title: string
  /** 标题下方的次级说明；缺省不渲染，保证结构不因漏传而漂移。 */
  description?: ReactNode
  /** 右侧操作区（日期选择、刷新等）；缺省不渲染。 */
  actions?: ReactNode
}

/**
 * 全站统一的页面头部：标题 + 可选描述在左，操作在右。
 *
 * 之前各页面各自手写 header，间距与结构逐页漂移（fleet / prompts 就是
 * 离群的两个）。收敛到这一个组件后，现有与未来的所有 tab 共用同一套
 * 「flex 两端对齐 + 标题 level 4 + 描述次级色 + 16px 下边距」的样式。
 *
 * 换行规则交给 index.css：手机（<768）时操作区整行独占，日期选择与刷新按钮
 * 不再和标题挤在同一行；这里只挂 class，不写断点判断。
 */
export default function PageHeader({
  title,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <div className="page-header">
      <div className="page-header-title" style={{ minWidth: 0 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
        {description != null && (
          <Typography.Text type="secondary" style={{ display: 'block' }}>
            {description}
          </Typography.Text>
        )}
      </div>
      {actions != null && <div className="page-header-actions">{actions}</div>}
    </div>
  )
}
