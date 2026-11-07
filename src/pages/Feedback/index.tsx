import { Card, Tabs, Typography } from 'antd'
import ReportFeedbackPanel from './ReportFeedbackPanel'
import UserFeedbackPanel from './UserFeedbackPanel'

/**
 * 用户反馈页：日报有用性反馈 + 家长主动提交的使用反馈。
 * 手机号明文展示（内部看板已确认）。
 */
export default function Feedback() {
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          用户反馈
        </Typography.Title>
        <Typography.Text type="secondary">
          日报反馈按报告日期（reportDate）过滤；使用反馈按提交时间过滤
        </Typography.Text>
      </div>
      <Card>
        <Tabs
          items={[
            {
              key: 'report',
              label: '日报反馈',
              children: <ReportFeedbackPanel />,
            },
            {
              key: 'user',
              label: '使用反馈',
              children: <UserFeedbackPanel />,
            },
          ]}
        />
      </Card>
    </div>
  )
}
