import { Alert, Space, Typography } from 'antd'
import type { LintIssue, LintReport } from '../../types/adventureAdmin'

/**
 * 校验报告面板。
 *
 * 只呈现服务端 lint 的结论，前端**不重复实现任何规则**：阈值可被环境变量调整、
 * 禁用词由服务端配置注入，前端若自己再判一遍，两套阈值必然漂移，
 * 最后变成「界面说没问题、发布却被 400 挡回来」。
 *
 * 定位信息优先用 `path`（形如 segments[2].options.choices[0].text）——
 * 它精确到字段，创作者不用靠猜；`segmentOrder` 是 0 基的段号，与内容预览里的
 * `#order` 同源，所以这里也按 `#order` 显示，不做 +1 的「人话」转换，
 * 免得两处编号对不上。
 */
interface Props {
  report: LintReport | null
  /** 标题：编辑器里叫「实时校验」，发布确认弹窗里叫「发布前检查」 */
  title?: string
}

function location(issue: LintIssue): string | null {
  if (issue.path) return issue.path
  if (typeof issue.segmentOrder === 'number') return `segments[${issue.segmentOrder}]`
  return null
}

function IssueList({ issues }: { issues: LintIssue[] }) {
  return (
    <Space orientation="vertical" size={2} style={{ width: '100%' }}>
      {issues.map((issue, index) => {
        const where = location(issue)
        return (
          <Typography.Text key={`${issue.code}-${index}`}>
            <Typography.Text code>{issue.code}</Typography.Text>{' '}
            {issue.message}
            {where && (
              <Typography.Text type="secondary" style={{ marginLeft: 6 }}>
                @ {where}
              </Typography.Text>
            )}
          </Typography.Text>
        )
      })}
    </Space>
  )
}

export default function LintPanel({ report, title }: Props) {
  if (!report) return null

  const errors = report.errors ?? []
  const warnings = report.warnings ?? []

  return (
    <Space orientation="vertical" size={8} style={{ width: '100%' }}>
      {title && (
        <Typography.Text strong style={{ fontSize: 13 }}>
          {title}
        </Typography.Text>
      )}

      {errors.length === 0 ? (
        <Alert
          type="success"
          showIcon
          message={
            warnings.length === 0
              ? '校验通过，没有阻断项也没有提醒项'
              : '没有阻断项，可以发布'
          }
        />
      ) : (
        <Alert
          type="error"
          showIcon
          message={`${errors.length} 个阻断项，全部修掉才能发布`}
          description={<IssueList issues={errors} />}
        />
      )}

      {warnings.length > 0 && (
        <Alert
          type="warning"
          showIcon
          message={`${warnings.length} 条提醒（不影响发布）`}
          description={<IssueList issues={warnings} />}
        />
      )}
    </Space>
  )
}
