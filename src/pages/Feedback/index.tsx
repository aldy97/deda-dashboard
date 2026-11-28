import { Card, Tabs } from 'antd'
import { useUrlQuery, readEnumParam } from '../../utils/url-state'
import PageHeader from '../../components/PageHeader'
import RefreshButton from '../../components/RefreshButton'
import { usePageRefresh } from '../../api/refresh'
import ReportFeedbackPanel from './ReportFeedbackPanel'
import UserFeedbackPanel from './UserFeedbackPanel'

// parentReport 已并入 report：老链接读时回退，不再重写 URL
const TAB_KEYS = ['report', 'user'] as const
type TabKey = (typeof TAB_KEYS)[number]

/**
 * 用户反馈页：日报有用性反馈 + 家长主动提交的使用反馈。
 * 家长报告生成质量已并入日报反馈 tab（同一区间、同一张统计卡）。
 * 手机号明文展示（内部看板已确认）。
 * tab 走 ?tab=；非法值（含已下线的 parentReport）读时回退 report，不重写 URL
 * （与 /llm、/adventure 一致）。
 */
export default function Feedback() {
  const { searchParams, setQuery } = useUrlQuery()
  const tab = readEnumParam<TabKey>(searchParams, 'tab', TAB_KEYS, 'report')
  const { refresh, isRefreshing } = usePageRefresh('feedback')

  return (
    <div>
      <PageHeader
        title="用户反馈"
        description="日报反馈（含家长报告生成质量）与使用反馈；报告按日期过滤，反馈按提交时间过滤"
        actions={<RefreshButton loading={isRefreshing} onClick={refresh} />}
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
          ]}
        />
      </Card>
    </div>
  )
}
