import { useState } from 'react'
import { Card, Tabs } from 'antd'
import { useUrlQuery } from '../../utils/url-state'
import { useAdventureAuthoring, useAdventureCapabilities } from '../../api/queries'
import type { ScriptConvertResult } from '../../types/adventureAdmin'
import PageHeader from '../../components/PageHeader'
import CapabilityBanner from './CapabilityBanner'
import EpisodeTable from './EpisodeTable'
import EpisodeDetailDrawer from './EpisodeDetailDrawer'
import NewEpisodeDrawer from './NewEpisodeDrawer'
import AuditLog from './AuditLog'
import HealthPanel from './HealthPanel'
import ImportExport from './ImportExport'

/**
 * 冒险内容工作台（Adventure Studio）。
 *
 * 内容创作者在这里写每一集：草稿 → 校验 → 试播 → 发布 → 出问题回滚 → 彻底不用了下架。
 * 孩子侧的播放引擎只读**已发布的版本快照**，所以「正在改」与「正在播」天然隔离——
 * 这是「已发布的故事不允许原地修改」能成立的实现基础，而不是一条纪律要求。
 *
 * 四个 tab 各自回答一个问题：
 * - 故事集：现在有哪些集、谁在改、改到哪一版（新建与逐集编辑都从这里进）
 * - 跨环境搬运：staging 验证过的整份配置怎么搬到 prod（导出 → dry-run → 手输确认码）
 * - 审计流水：谁在什么时候、以什么理由做了什么（含跨环境搬运与自愈动作）
 * - 自愈与兜底：孩子那一侧有没有兜住，兜底自己是不是也在失败
 *
 * 两条沿用「模型监控」页的约束：activeKey 与 URL 的 ?tab= 双向同步（可以直接分享链接），
 * 且只挂载当前 tab 的子组件（每个 tab 各自持有请求，一次性全挂载会并发打出十几个请求）。
 */
const TAB_KEYS = ['episodes', 'transfer', 'audit', 'recovery'] as const

type TabKey = (typeof TAB_KEYS)[number]

function isTabKey(value: string | null): value is TabKey {
  return value !== null && (TAB_KEYS as readonly string[]).includes(value)
}

export default function AdventureStudio() {
  const { searchParams, setQuery } = useUrlQuery()
  const requested = searchParams.get('tab')
  const activeKey: TabKey = isTabKey(requested) ? requested : 'episodes'
  const selectedEpisodeId = searchParams.get('episodeId') || null
  const [newDraft, setNewDraft] = useState<{
    seed: ScriptConvertResult | null
    nonce: number
  } | null>(null)
  const authoring = useAdventureAuthoring()
  const capabilities = useAdventureCapabilities().data ?? null

  return (
    <div>
      <PageHeader
        title="冒险内容工作台"
        description="冒险故事每一集的草稿、校验、发布、回滚与下架。已发布的故事不会被原地修改：发布是生成一个新快照，正在玩的孩子锁在自己开始时的版本上，不会被中途换掉。内容也没有「删除」——只有下架成墓碑，历史版本、审计与进度都还能追溯。"
      />

      <CapabilityBanner />

      <Card>
        <Tabs
          activeKey={activeKey}
          onChange={(key) => setQuery({ tab: key }, { replace: false })}
          items={[
            {
              key: 'episodes',
              label: '故事集',
              children:
                activeKey === 'episodes' ? (
                  <>
                    <EpisodeTable
                      onOpen={(episodeId) =>
                        setQuery({ episodeId }, { replace: false })
                      }
                      onCreate={
                        authoring
                          ? () => setNewDraft({ seed: null, nonce: Date.now() })
                          : undefined
                      }
                    />
                  </>
                ) : null,
            },
            {
              key: 'transfer',
              label: '跨环境搬运',
              children: activeKey === 'transfer' ? <ImportExport /> : null,
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
        onClose={() => setQuery({ episodeId: null }, { replace: true })}
      />

      {/* 用 key 强制每次打开都是全新表单：集号、主角、内容都不沿用上一次 */}
      {newDraft && capabilities && (
        <NewEpisodeDrawer
          key={newDraft.nonce}
          open
          seed={newDraft.seed}
          capabilities={capabilities}
          onClose={() => setNewDraft(null)}
          onCreated={(episodeId) => {
            setNewDraft(null)
            setQuery({ episodeId }, { replace: false })
          }}
        />
      )}
    </div>
  )
}
