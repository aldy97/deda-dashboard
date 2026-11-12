import { Card, Tabs, Typography } from 'antd'
import { useSearchParams } from 'react-router-dom'
import CostTab from './tabs/CostTab'
import IntentTab from './tabs/IntentTab'
import PerfTab from './tabs/PerfTab'
import SafetyTab from './tabs/SafetyTab'

/**
 * 模型监控页：单页拆成四个 tab，不新开路由（菜单仍只有「模型监控」一项）。
 *
 * - 性能监控 / 价格监控：回答「模型调用健康吗」（成功率、延迟、首包、token、费用）
 * - 安全监控 / 意图监控：回答「模型的判定可信吗」（拦了多少、放行里有多少其实没审、
 *   意图有多少是关键词兜底兜出来的），数据源 turn_decision_logs
 *
 * 两条设计约束：
 * 1. activeKey 与 URL 的 ?tab= 双向同步，运营可以直接分享「安全监控」这个链接；
 *    非法值回退到性能监控，不渲染空白页。
 * 2. 只挂载 active tab 的子组件。四个 tab 各自持有独立区间与 10+ 个查询，
 *    一次性全挂载会在进页面时并发打出十几个请求。
 */
const TAB_KEYS = ['perf', 'cost', 'safety', 'intent'] as const

type TabKey = (typeof TAB_KEYS)[number]

function isTabKey(value: string | null): value is TabKey {
  return value !== null && (TAB_KEYS as readonly string[]).includes(value)
}

export default function LlmMonitor() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get('tab')
  const activeKey: TabKey = isTabKey(requested) ? requested : 'perf'

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          模型监控
        </Typography.Title>
        <Typography.Text type="secondary">
          主模型（deepseek-flash）+ 小模型（qwen-flash）全量调用；首包时间仅流式场景有值。
          性能与价格看「调用健康度」，安全与意图看「判定可信度」，两者可按 turnId 互查。
        </Typography.Text>
      </div>
      <Card>
        <Tabs
          activeKey={activeKey}
          onChange={(key) => setSearchParams({ tab: key })}
          items={[
            {
              key: 'perf',
              label: '性能监控',
              children: activeKey === 'perf' ? <PerfTab /> : null,
            },
            {
              key: 'cost',
              label: '价格监控',
              children: activeKey === 'cost' ? <CostTab /> : null,
            },
            {
              key: 'safety',
              label: '安全监控',
              children: activeKey === 'safety' ? <SafetyTab /> : null,
            },
            {
              key: 'intent',
              label: '意图监控',
              children: activeKey === 'intent' ? <IntentTab /> : null,
            },
          ]}
        />
      </Card>
    </div>
  )
}
