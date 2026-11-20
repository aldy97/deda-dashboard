import { Card, Tabs } from 'antd'
import { useUrlQuery, readEnumParam } from '../../utils/url-state'
import PageHeader from '../../components/PageHeader'
import ReportFeedbackPanel from './ReportFeedbackPanel'
import UserFeedbackPanel from './UserFeedbackPanel'
import ParentReportPanel from './ParentReportPanel'

const TAB_KEYS = ['report', 'user', 'parentReport'] as const
type TabKey = (typeof TAB_KEYS)[number]

/**
 * 用户反馈页：日报有用性反馈 + 家长主动提交的使用反馈 + 家长报告生成质量。
 * 家长报告卡片自「内容与质量」页搬迁至此。手机号明文展示（内部看板已确认）。
 * tab 走 ?tab=；非法值读时回退 report，不重写 URL（与 /llm、/adventure 一致）。
 */
export default function Feedback() {
  const { searchParams, setQuery } = useUrlQuery()
  const tab = readEnumParam<TabKey>(searchParams, 'tab', TAB_KEYS, 'report')

  return (
    <div>
      <PageHeader
        title="用户反馈"
        description="日报反馈、使用反馈与家长报告生成质量；报告按日期过滤，反馈按提交时间过滤"
      />
      <Card>
        <Tabs
          activeKey={tab}
          onChange={(key) => setQuery({ tab: key }, { replace: false })}
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
            {
              key: 'parentReport',
              label: '家长报告',
              children: <ParentReportPanel />,
            },
          ]}
        />
      </Card>
    </div>
  )
}
