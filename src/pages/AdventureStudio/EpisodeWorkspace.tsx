import { useState } from 'react'
import type { ReactNode } from 'react'
import { Alert, Button, Modal, Space, Tag, Typography } from 'antd'
import type { ApiError } from '../../api/client'
import {
  useDiscardAdventureDraft,
  useDiscardAdventureEpisode,
  usePublishAdventureEpisode,
  useRestoreAdventureEpisode,
  useRetireAdventureEpisode,
  useSaveAdventureDraft,
} from '../../api/queries'
import type {
  CapabilitiesResponse,
  DraftConflictDetail,
  EpisodeDetail,
} from '../../types/adventureAdmin'
import EpisodeEditor from './EpisodeEditor'
import LintPanel from './LintPanel'
import PreviewSimulator from './PreviewSimulator'
import ReasonDialog from './ReasonDialog'
import type { EpisodeContentState, LintBasis } from './useEpisodeContent'
import { fmtDateTime, shortHash } from './labels'

/**
 * 单集工作台：编辑 + 校验 + 试播 + 全部写动作。
 *
 * 内容状态由抽屉层的 useEpisodeContent 持有（切 tab 不会丢稿子），这里只负责
 * 「把动作做对」，四条规矩：
 *
 * 1. **每个写动作都要理由**，破坏性动作还要原样手输业务键。闸门在服务端，
 *    前端只做提前提示，不假装自己能挡住。
 * 2. **发布按钮在有未保存改动时禁用。** 「点了发布但改动没出去」是最容易
 *    造成误判的一类事故：界面上看着是新内容，孩子拿到的还是旧快照。
 * 3. **操作结果不用 toast。** 下架 / 恢复上架的返回里带着服务端写好的中文说明
 *    （今日在播几台不动、几台挂起被收走、被收成 abandoned 的进度不会回来），
 *    这些数字必须停在屏幕上可被核对，飘两秒就消失等于没说。
 * 4. **409 DRAFT_CONFLICT 时不关弹窗**，就地给出「加载对方版本 / 覆盖我的改动」
 *    两条路。理由是最难写的那部分，让人白填一遍等于惩罚他说清楚。
 */
interface Props {
  episodeId: string
  detail: EpisodeDetail
  capabilities: CapabilitiesResponse
  authoring: boolean
  state: EpisodeContentState
  /** 重新拉一次详情（乐观锁冲突后「加载对方版本」要用） */
  onReload: () => void
}

type ActionKey =
  | 'save'
  | 'publish'
  | 'discardDraft'
  | 'retire'
  | 'restore'
  | 'discard'

interface ResultNote {
  tone: 'success' | 'info' | 'warning' | 'error'
  text: ReactNode
}

const LINT_BASIS_TITLES: Record<LintBasis, string> = {
  local: '校验结果（发布标准 · 正在编辑的这份）',
  publish: '校验结果（发布标准 · 服务端当前内容）',
  draft: '校验结果（草稿标准 · 发布标准的结果正在计算）',
  none: '校验结果（正在计算…）',
}

/** 只有这些身份级 / 儿童安全级错误连草稿都不许落库，其余允许「写到一半」先存下来 */
function describeSelfCheck(drift: string[] | null): ResultNote | null {
  if (drift === null) {
    return {
      tone: 'warning',
      text: '发布已提交，但发布后自检本身失败了（已记日志与审计）。请人工核对这一集的线上段落是否与刚发布的内容一致。',
    }
  }
  if (drift.length > 0) {
    return {
      tone: 'warning',
      text: `发布已提交，但自检发现内容与库里的段落有漂移（只告警、不回滚）：${drift.join('；')}`,
    }
  }
  return null
}

export default function EpisodeWorkspace({
  episodeId,
  detail,
  capabilities,
  authoring,
  state,
  onReload,
}: Props) {
  const summary = detail.summary
  const businessKey = summary.businessKey

  const [action, setAction] = useState<ActionKey | null>(null)
  const [lastReason, setLastReason] = useState('')
  const [result, setResult] = useState<ResultNote | null>(null)
  const [simulateOpen, setSimulateOpen] = useState(false)

  const save = useSaveAdventureDraft()
  const publish = usePublishAdventureEpisode()
  const discardDraft = useDiscardAdventureDraft()
  const retire = useRetireAdventureEpisode()
  const restore = useRestoreAdventureEpisode()
  const discard = useDiscardAdventureEpisode()

  const activeMutation =
    action === null
      ? null
      : {
          save,
          publish,
          discardDraft,
          retire,
          restore,
          discard,
        }[action]
  const pending = activeMutation?.isPending ?? false
  const error = (activeMutation?.error as ApiError | null) ?? null
  const conflict: DraftConflictDetail | null =
    error?.domainCode === 'DRAFT_CONFLICT'
      ? ((error.detail as { currentDraft?: DraftConflictDetail })?.currentDraft ??
        null)
      : null

  const content = state.content
  const lintErrors = state.lint?.errors ?? []
  const canPublish =
    authoring &&
    !state.dirty &&
    summary.hasDraft &&
    !summary.retiredAt &&
    lintErrors.length === 0

  function closeDialog() {
    setAction(null)
    setLastReason('')
  }

  function submitSave(reason: string, force: boolean) {
    if (!content) return
    setLastReason(reason)
    save.mutate(
      {
        episodeId,
        content,
        reason,
        baseVersionId: state.baseVersionId,
        baseDraftUpdatedAt: state.baseDraftUpdatedAt,
        force,
      },
      {
        onSuccess: (res) => {
          // 采用服务端返回的新令牌，否则下一次保存会被自己刚写的这次顶成 409
          state.adoptSavedDraft(res.draftUpdatedAt)
          closeDialog()
          setResult({
            tone: 'success',
            text: `草稿已保存：v${res.version}（${res.created ? '新建草稿行' : '原地更新同一行草稿'}）· 内容哈希 ${shortHash(res.contentHash)}`,
          })
        },
      },
    )
  }

  function submit(values: { reason: string; confirmText?: string }) {
    if (action === null) return
    setLastReason(values.reason)
    const confirmText = values.confirmText ?? ''

    if (action === 'save') {
      submitSave(values.reason, false)
      return
    }
    if (action === 'publish') {
      publish.mutate(
        { episodeId, reason: values.reason },
        {
          onSuccess: (res) => {
            state.clearLocal()
            closeDialog()
            const drift = describeSelfCheck(res.selfCheckDrift)
            setResult(
              drift ?? {
                tone: 'success',
                text: `已发布为 v${res.version}，成为当前版本（旧版本转 superseded，历史一行未改）· 影响 ${res.impact.devicesPlayingToday} 台今日在播设备（它们仍锁在自己开始时的快照上）`,
              },
            )
          },
        },
      )
      return
    }
    if (action === 'discardDraft') {
      discardDraft.mutate(
        { episodeId, reason: values.reason },
        {
          onSuccess: (res) => {
            state.clearLocal()
            closeDialog()
            setResult({
              tone: 'info',
              text: `已丢弃草稿 v${res.version}，编辑器回到当前发布版。版本行仍在历史里（状态 discarded），没有被删除。`,
            })
          },
        },
      )
      return
    }
    if (action === 'retire') {
      retire.mutate(
        { episodeId, reason: values.reason, confirmText },
        {
          onSuccess: (res) => {
            state.clearLocal()
            closeDialog()
            // message 是服务端写好的中文说明，原样展示，不在前端复述一份
            setResult({
              tone: 'warning',
              text: `${res.message}（本次收走跨天挂起 ${res.staleDailyCount} 台、标记 abandoned 进度 ${res.abandonedProgressCount} 条）`,
            })
          },
        },
      )
      return
    }
    if (action === 'restore') {
      restore.mutate(
        { episodeId, reason: values.reason },
        {
          onSuccess: (res) => {
            closeDialog()
            setResult({
              tone: 'info',
              text: `${res.message}（当初被收成 abandoned 的 ${res.abandonedProgressNotRestored} 条进度不会因此回来）`,
            })
          },
        },
      )
      return
    }
    discard.mutate(
      { episodeId, reason: values.reason, confirmText },
      {
        onSuccess: (res) => {
          state.clearLocal()
          closeDialog()
          setResult({
            tone: 'warning',
            text: `${res.message}（作废草稿 ${res.discardedDraftCount} 个；业务键 ${res.businessKey} 已永久占用，不能再用于新建）`,
          })
        },
      },
    )
  }

  function dialogProps(): {
    title: string
    description: ReactNode
    okText: string
    danger: boolean
    confirmText?: string
    confirmLabel?: string
  } | null {
    switch (action) {
      case 'save':
        return {
          title: '存草稿',
          description:
            '只写草稿，不发布：孩子拿到的永远是已发布的版本快照，正在玩的人不会被打断。草稿是可变行——同一集的草稿会被原地更新，不会每存一次就多一行历史。校验没过也能存（身份级与儿童安全级错误除外），这正是草稿的用途：写到一半先落地。',
          okText: '存草稿',
          danger: false,
        }
      case 'publish':
        return {
          title: `发布 ${businessKey}`,
          description:
            '发布会生成一个新的版本快照并切成当前版本，旧版本转 superseded（历史不删）。已经分配到这一集的设备仍锁在自己开始时的快照上，不会被中途换掉；只有之后新分配的设备才拿到新版本。发布不可撤销——要退回去请用「回滚到某一版」，那同样是新增一个版本。',
          okText: '确认发布',
          danger: false,
        }
      case 'discardDraft':
        return {
          title: '丢弃草稿',
          description:
            '把当前草稿标记为 discarded，编辑器回到已发布的那一版。版本行不会被删除，历史与审计都还在。若这一集从没发布过，草稿就是它唯一的内容，服务端会拒绝（DRAFT_IS_ONLY_CONTENT）。',
          okText: '丢弃草稿',
          danger: true,
        }
      case 'retire':
        return {
          title: `下架 ${businessKey}`,
          description:
            '下架是墓碑，不是删除：孩子不会再被分配到这一集，但版本历史、审计、以及可能仍锁在旧快照上的进度全都保留。今日已经在播的设备不会被打断；跨天仍挂起的设备会被收走，下次开机换一集。被收成 abandoned 的进度不会因为将来「恢复上架」而回来。',
          okText: '确认下架',
          danger: true,
          confirmText: businessKey,
          confirmLabel: '下架确认',
        }
      case 'restore':
        return {
          title: `恢复上架 ${businessKey}`,
          description:
            '这一集会重新参与分配，孩子又可能被带到它面前。请确认当初下架的原因（内容问题 / 季节不合适 / 临时撤回）已经解决。恢复上架只改墓碑状态，不改任何内容；仍然需要先有草稿并发布才能更新内容。',
          okText: '确认恢复上架',
          danger: false,
        }
      case 'discard':
        return {
          title: `作废整集 ${businessKey}`,
          description:
            '只能作废**从未发布过**的集（发布过的请走下架）。作废后草稿转 discarded，但业务键永久占用——这个 IP、这一季、这个集号再也不能用于新建，因为已经有设备可能记录过它。这一步没有恢复入口。',
          okText: '确认作废',
          danger: true,
          confirmText: businessKey,
          confirmLabel: '作废确认',
        }
      default:
        return null
    }
  }

  const dialog = dialogProps()
  const conflictExtra =
    conflict !== null ? (
      <Alert
        type="warning"
        showIcon
        message={`这一集的草稿已经被 ${conflict.updatedBy ?? '另一位创作者'} 改过（v${conflict.version} · ${fmtDateTime(conflict.updatedAt)}）`}
        description={
          <Space orientation="vertical" size={8} style={{ width: '100%' }}>
            <Typography.Text>
              草稿是可变行：对方是往**同一行**里存的，所以版本号没变，只有时间戳能分辨。你的改动还在屏幕上，一个字都没丢。
            </Typography.Text>
            <Space size={8} wrap>
              <Button
                onClick={() => {
                  state.clearLocal()
                  onReload()
                  closeDialog()
                  setResult({
                    tone: 'info',
                    text: '已加载对方版本，你的本地改动被丢弃。',
                  })
                }}
              >
                加载对方版本（丢弃我的改动）
              </Button>
              <Button
                danger
                loading={pending}
                onClick={() => submitSave(lastReason, true)}
              >
                覆盖我的改动上去
              </Button>
            </Space>
          </Space>
        }
      />
    ) : null

  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      {result && (
        <Alert
          type={result.tone}
          showIcon
          closable
          onClose={() => setResult(null)}
          message={result.text}
        />
      )}

      {!authoring && (
        <Alert
          type="info"
          showIcon
          message="本环境是只读环境，内容不能在这里修改"
          description="内容只能在 staging（authoring）改好、验证过，再用「跨环境搬运」整包搬过来。校验与试播仍然可用。"
        />
      )}

      {authoring && (
        <Space size={8} wrap>
          <Button
            type="primary"
            loading={save.isPending}
            disabled={content === null}
            onClick={() => setAction('save')}
          >
            存草稿
          </Button>
          <Button
            loading={publish.isPending}
            disabled={!canPublish}
            onClick={() => setAction('publish')}
            title={
              !summary.hasDraft
                ? '还没有草稿，先存一次草稿'
                : state.dirty
                  ? '有未保存的改动：先存草稿再发布，否则发出去的还是上一份'
                  : lintErrors.length > 0
                    ? '校验还有错误，发布会被服务端拒绝（PUBLISH_BLOCKED）'
                    : undefined
            }
          >
            发布
          </Button>
          <Button onClick={() => setSimulateOpen(true)}>试播</Button>
          <Button
            onClick={() => {
              state.clearLocal()
              onReload()
            }}
          >
            {state.dirty ? '放弃改动并重新加载' : '重新加载'}
          </Button>
          {state.dirty && <Tag color="gold">有未保存的改动</Tag>}
          {state.lintPending && <Tag>校验中…</Tag>}
        </Space>
      )}

      {authoring && (
        <Space size={8} wrap>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            影响面动作：
          </Typography.Text>
          {summary.hasDraft && summary.published && (
            <Button
              size="small"
              danger
              disabled={discardDraft.isPending}
              onClick={() => setAction('discardDraft')}
            >
              丢弃草稿
            </Button>
          )}
          {summary.retiredAt ? (
            <Button
              size="small"
              disabled={restore.isPending}
              onClick={() => setAction('restore')}
            >
              恢复上架
            </Button>
          ) : (
            <Button
              size="small"
              danger
              disabled={retire.isPending}
              onClick={() => setAction('retire')}
            >
              下架
            </Button>
          )}
          {!summary.published && (
            <Button
              size="small"
              danger
              disabled={discard.isPending}
              onClick={() => setAction('discard')}
            >
              作废整集
            </Button>
          )}
        </Space>
      )}

      {state.lintError && (
        <Alert
          type="error"
          showIcon
          message="校验请求失败"
          description={`${state.lintError.message}${state.lintError.domainCode ? `（${state.lintError.domainCode}）` : ''}`}
        />
      )}

      <LintPanel report={state.lint} title={LINT_BASIS_TITLES[state.lintBasis]} />

      <EpisodeEditor
        value={content ?? { title: '', recap: null, segments: [] }}
        capabilities={capabilities}
        lint={state.lint}
        disabled={!authoring}
        onChange={state.change}
      />

      <Modal
        open={simulateOpen}
        onCancel={() => setSimulateOpen(false)}
        footer={null}
        width={860}
        title="试播：按引擎规则走一遍（不写库、不审计）"
      >
        {state.identity && content && (
          <PreviewSimulator
            identity={state.identity}
            content={content}
            capabilities={capabilities}
          />
        )}
      </Modal>

      {dialog && (
        <ReasonDialog
          // key 保证每次打开都是空表单：理由必须重新想，不能沿用上一次
          key={action}
          open
          title={dialog.title}
          description={dialog.description}
          confirmText={dialog.confirmText}
          confirmLabel={dialog.confirmLabel}
          impact={action === 'retire' || action === 'publish' ? detail.impact : null}
          impactVariant={action === 'retire' ? 'retire' : 'publish'}
          okText={dialog.okText}
          danger={dialog.danger}
          pending={pending}
          error={error}
          extra={conflictExtra}
          onCancel={closeDialog}
          onSubmit={submit}
        />
      )}
    </Space>
  )
}
