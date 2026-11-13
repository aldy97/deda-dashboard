import { useState } from 'react'
import { Alert, Drawer, Modal, Space, Spin, Tabs, Tag, Typography } from 'antd'
import {
  useAdventureAuthoring,
  useAdventureCapabilities,
  useAdventureEpisode,
} from '../../api/queries'
import ContentPreview from './ContentPreview'
import EpisodeWorkspace from './EpisodeWorkspace'
import ImpactPanel from './ImpactPanel'
import LintPanel from './LintPanel'
import VersionHistory from './VersionHistory'
import AuditLog from './AuditLog'
import { useEpisodeContent } from './useEpisodeContent'
import { characterLabel, fmtDateTime } from './labels'

/**
 * 单集详情抽屉：内容 / 版本 / 影响面 / 本集审计四张视图收在一处。
 *
 * 放在抽屉而不是新路由，是因为创作者的动线是「在列表里扫到一集 → 立刻看它现在
 * 什么样、谁在改、动了会影响谁」，中途跳走会丢掉列表的筛选与分页状态。
 *
 * `contentSource` 必须显式告诉人现在看的是哪一份：草稿优先，其次当前发布版，
 * 最后是空壳。三者的处置方式完全不同（草稿可以丢、发布版只能被新版本覆盖、
 * 空壳说明这一集从没写过内容），不标出来就会有人以为自己在改线上内容。
 *
 * 只挂载当前 tab：版本历史与审计各自带请求，四个 tab 一次性全挂载会在打开抽屉的
 * 瞬间打出四个请求。
 *
 * 编辑状态由这一层的 useEpisodeContent 持有，而不是放在工作台组件里——正因为只挂载
 * 当前 tab，切去「版本历史」再切回来会卸载工作台，稿子会凭空消失。同理，有未保存
 * 改动时遮罩点击不再关闭抽屉，关闭前必须先明确「丢弃改动」。
 */
interface Props {
  episodeId: string | null
  onClose: () => void
}

const TAB_KEYS = ['content', 'versions', 'impact', 'audit'] as const

type TabKey = (typeof TAB_KEYS)[number]

const CONTENT_SOURCE_META: Record<string, { label: string; color: string }> = {
  draft: { label: '正在看草稿', color: 'gold' },
  published: { label: '正在看当前发布版', color: 'green' },
  empty: { label: '还没有内容', color: 'default' },
}

export default function EpisodeDetailDrawer({ episodeId, onClose }: Props) {
  const authoring = useAdventureAuthoring()
  const capabilitiesQuery = useAdventureCapabilities()
  const capabilities = capabilitiesQuery.data ?? null
  const episodeQuery = useAdventureEpisode(episodeId)
  const detail = episodeQuery.data ?? null
  const summary = detail?.summary ?? null
  const state = useEpisodeContent(episodeId, detail)
  const [closePromptOpen, setClosePromptOpen] = useState(false)

  function requestClose() {
    if (state.dirty) {
      setClosePromptOpen(true)
      return
    }
    onClose()
  }

  function closeAndDiscard() {
    setClosePromptOpen(false)
    state.clearLocal()
    onClose()
  }

  // tab 记在「哪一集的 tab」上：换一集自动回到「内容」。否则上一集停在「本集审计」，
  // 打开下一集就直接是审计，会让人以为看的是同一集的历史。派生值而非 effect，少一轮渲染。
  const [tabState, setTabState] = useState<{
    episodeId: string | null
    tab: TabKey
  }>({ episodeId: null, tab: 'content' })
  const tab: TabKey = tabState.episodeId === episodeId ? tabState.tab : 'content'
  const setTab = (next: TabKey) => setTabState({ episodeId, tab: next })

  const sourceMeta = detail
    ? (CONTENT_SOURCE_META[detail.contentSource] ?? {
        label: detail.contentSource,
        color: 'default',
      })
    : null

  return (
    <Drawer
      open={episodeId !== null}
      onClose={requestClose}
      size={1040}
      // 有未保存改动时遮罩点击不关闭：误触一下就丢掉半集稿子，代价太高
      maskClosable={!state.dirty}
      destroyOnHidden
      title={
        summary ? (
          <Space size={8} wrap>
            <Typography.Text code>{summary.businessKey}</Typography.Text>
            <Typography.Text strong>{summary.title || '（未填标题）'}</Typography.Text>
            <Tag>{characterLabel(summary.characterKey)}</Tag>
            {summary.retiredAt ? (
              <Tag color="red">已下架</Tag>
            ) : summary.published ? (
              <Tag color="green">已发布 v{summary.currentVersion}</Tag>
            ) : (
              <Tag color="gold">未发布</Tag>
            )}
            {summary.hasDraft && <Tag color="blue">有草稿 v{summary.draftVersion}</Tag>}
          </Space>
        ) : (
          '故事集详情'
        )
      }
    >
      <Spin spinning={episodeQuery.isLoading}>
        {episodeQuery.error && (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 12 }}
            message="故事集详情加载失败"
            description={(episodeQuery.error as Error).message}
          />
        )}

        {detail && (
          <>
            <Space size={8} wrap style={{ marginBottom: 12 }}>
              {sourceMeta && (
                <Tag color={sourceMeta.color}>{sourceMeta.label}</Tag>
              )}
              {!authoring && <Tag color="orange">本环境只读，不能修改</Tag>}
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                最近更新 {fmtDateTime(summary?.updatedAt)}
                {summary?.draftUpdatedBy
                  ? ` · 草稿由 ${summary.draftUpdatedBy} 于 ${fmtDateTime(summary.draftUpdatedAt)} 保存`
                  : ''}
              </Typography.Text>
            </Space>

            {summary?.retiredAt && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
                message={`这一集已于 ${fmtDateTime(summary.retiredAt)} 下架`}
                description="下架是墓碑不是删除：孩子不会被分配到它，但历史版本、审计与可能仍锁在旧快照上的进度都还在。不能直接发布，需要先「恢复上架」。当初被收成 abandoned 的进度不会因为恢复上架而回来。"
              />
            )}

            <Tabs
              activeKey={tab}
              onChange={(key) => setTab(key as TabKey)}
              items={[
                {
                  key: 'content',
                  label: authoring ? '内容与编辑' : '内容',
                  children:
                    tab === 'content' ? (
                      authoring && capabilities && episodeId ? (
                        <EpisodeWorkspace
                          episodeId={episodeId}
                          detail={detail}
                          capabilities={capabilities}
                          authoring={authoring}
                          state={state}
                          onReload={() => void episodeQuery.refetch()}
                        />
                      ) : (
                        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                          <LintPanel report={state.lint} title="当前内容的校验结果" />
                          <ContentPreview content={detail.content} />
                        </Space>
                      )
                    ) : null,
                },
                {
                  key: 'versions',
                  label: '版本历史',
                  children:
                    tab === 'versions' && episodeId ? (
                      <VersionHistory key={episodeId} episodeId={episodeId} />
                    ) : null,
                },
                {
                  key: 'impact',
                  label: '影响面',
                  children:
                    tab === 'impact' ? (
                      <ImpactPanel impact={detail.impact} variant="retire" />
                    ) : null,
                },
                {
                  key: 'audit',
                  label: '本集审计',
                  children:
                    tab === 'audit' && episodeId ? (
                      <AuditLog key={episodeId} episodeId={episodeId} />
                    ) : null,
                },
              ]}
            />
          </>
        )}
      </Spin>

      <Modal
        open={closePromptOpen}
        title="有未保存的改动"
        okText="丢弃改动并关闭"
        cancelText="留在这一页"
        okButtonProps={{ danger: true }}
        onCancel={() => setClosePromptOpen(false)}
        onOk={closeAndDiscard}
      >
        <Space orientation="vertical" size={8} style={{ width: '100%' }}>
          <Typography.Text>
            这一集的编辑器里有还没存成草稿的改动。关掉抽屉就会丢掉它们，
            审计里也不会有任何痕迹（没落库的东西不存在）。
          </Typography.Text>
          <Typography.Text type="secondary">
            想留着就点「留在这一页」，然后先存一次草稿——草稿允许写到一半，
            校验没过也能存（身份级与儿童安全级错误除外）。
          </Typography.Text>
        </Space>
      </Modal>
    </Drawer>
  )
}
