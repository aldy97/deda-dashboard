import { useState } from 'react'
import { Card, Tabs, Typography } from 'antd'
import { useSearchParams } from 'react-router-dom'
import CapabilityBanner from './CapabilityBanner'
import EpisodeTable from './EpisodeTable'
import EpisodeDetailDrawer from './EpisodeDetailDrawer'
import AuditLog from './AuditLog'
import HealthPanel from './HealthPanel'

/**
 * 冒险内容工作台（Adventure Studio）。
 *
 * 内容创作者在这里写每一集：草稿 → 校验 → 试播 → 发布 → 出问题回滚 → 彻底不用了下架。
 * 孩子侧的播放引擎只读**已发布的版本快照**，所以「正在改」与「正在播」天然隔离——
 * 这是「已发布的故事不允许原地修改」能成立的实现基础，而不是一条纪律要求。
 *
 * 四个 tab 各自回答一个问题：
 * - 故事集：现在有哪些集、谁在改、改到哪一版
 * - 审计流水：谁在什么时候、以什么理由做了什么（含跨环境搬运与自愈动作）
 * - 自愈与兜底：孩子那一侧有没有兜住，兜底自己是不是也在失败
 *
 * 两条沿用「模型监控」页的约束：activeKey 与 URL 的 ?tab= 双向同步（可以直接分享链接），
 * 且只挂载当前 tab 的子组件（每个 tab 各自持有请求，一次性全挂载会并发打出十几个请求）。
 */
const TAB_KEYS = ['episodes', 'audit', 'recovery'] as const

type TabKey = (typeof TAB_KEYS)[number]

function isTabKey(value: string | null): value is TabKey {
  return value !== null && (TAB_KEYS as readonly string[]).includes(value)
}

export default function AdventureStudio() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get('tab')
  const activeKey: TabKey = isTabKey(requested) ? requested : 'episodes'
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null)

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          冒险内容工作台
        </Typography.Title>
        <Typography.Text type="secondary">
          冒险故事每一集的草稿、校验、发布、回滚与下架。已发布的故事不会被原地修改：
          发布是生成一个新快照，正在玩的孩子锁在自己开始时的版本上，不会被中途换掉。
          内容也没有「删除」——只有下架成墓碑，历史版本、审计与进度都还能追溯。
        </Typography.Text>
      </div>

      <CapabilityBanner />

      <Card>
        <Tabs
          activeKey={activeKey}
          onChange={(key) => setSearchParams({ tab: key })}
          items={[
            {
              key: 'episodes',
              label: '故事集',
              children:
                activeKey === 'episodes' ? (
                  <EpisodeTable onOpen={(episodeId) => setSelectedEpisodeId(episodeId)} />
                ) : null,
            },
            {
              key: 'audit',
              label: '审计流水',
              children: activeKey === 'audit' ? <AuditLog /> : null,
            },
            {
              key: 'recovery',
              label: '自愈与兜底',
              children: activeKey === 'recovery' ? <HealthPanel /> : null,
            },
          ]}
        />
      </Card>

      <EpisodeDetailDrawer
        episodeId={selectedEpisodeId}
        onClose={() => setSelectedEpisodeId(null)}
      />
    </div>
  )
}
