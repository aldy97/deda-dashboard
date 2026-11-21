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
  LintReport,
  ScriptConvertResult,
} from '../../types/adventureAdmin'
import DocxUploadButton from './DocxUploadButton'
import EpisodeEditor from './EpisodeEditor'
import LintPanel from './LintPanel'
import PreviewSimulator from './PreviewSimulator'
import ReasonDialog from './ReasonDialog'
import type { EpisodeContentState } from './useEpisodeContent'
import {
  LINT_BASIS_TITLES,
  LINT_WARNINGS_NOTES,
  fmtDateTime,
  shortHash,
} from './labels'

/**
 * 单集工作台：编辑 + 校验 + 试播 + 全部写动作。
 *
 * 内容状态由抽屉层的 useEpisodeContent 持有（切 tab 不会丢稿子），这里只负责
 * 「把动作做对」，五条规矩：
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
 * 5. **校验只由人触发，且发布这道门 fail closed。** 打字过程中不发校验请求
 *    （见 useEpisodeContent 第 2 条取舍）；点「校验」按钮、或点「发布」时各算一次。
 *    「确认发布」在校验中 / 校验请求失败 / 拿不到发布标准结论时一律禁用——
 *    宁可让人多点一次「校验」，也不能在校验没算出来的时候把内容推向孩子。
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

/**
 * 发布后自检的漂移结论。只告警不回滚：发布已经提交，此时回滚会造成
 * 「孩子刚拿到的内容又被换掉」，比漂移本身更糟。
 */
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
  const [fillPending, setFillPending] = useState<ScriptConvertResult | null>(null)
  const [fillConfirmOpen, setFillConfirmOpen] = useState(false)

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
  const hasExistingContent =
    content !== null &&
    (content.title.trim() !== '' ||
      (content.recap?.trim() ?? '') !== '' ||
      content.segments.length > 0)

  // 只填内容（标题 + 互动），不动这一集的主角与集号：业务键由这一集的身份决定，
  // convert 返回的 characterKey/season/episodeNumber 是给「新建」用的自增值，这里丢弃。
  function onConverted(result: ScriptConvertResult) {
    if (state.dirty || hasExistingContent) {
      setFillPending(result)
      setFillConfirmOpen(true)
      return
    }
    state.change(result.content)
  }
  // 发布按钮不再把校验结论做进禁用条件：结论会变、也可能还没算出来，
  // 「为什么点不动」会变成一个猜谜。门改在弹窗里，且 fail closed（publishGateReason）。
  const canPublish =
    authoring && !state.dirty && summary.hasDraft && !summary.retiredAt

  // 存草稿被服务端拒绝时，拒绝理由里带着完整的 lint 报告，原样摊开给人看：
  // 只有一句「内容不合规」没法改，必须知道是哪一段的哪一条。
  const rejectedLint =
    (error?.detail as { lint?: LintReport } | undefined)?.lint ?? null

  /**
   * 发布这道门的 fail-closed 判定：null = 放行，一句话 = 拦住并说明为什么。
   *
   * 「校验没算出来」和「校验算出错误」同样不放行——放行等于把不确定的内容推向孩子。
   */
  function publishGateReason(): string | null {
    if (state.lintPending) return '发布前检查正在计算，等它出结果（通常几秒）。'
    if (state.lintError) {
      return `发布前检查这次请求失败了，无法确认这一集能不能发布，所以不放行：${state.lintError.message}${
        state.lintError.domainCode ? `（${state.lintError.domainCode}）` : ''
      }。关掉弹窗点「校验」重试一次。`
    }
    if (state.lintStale) {
      return '屏幕上的校验结果已经对不上当前内容了。点「校验」按现在这一份重新算一次再发布。'
    }
    if (state.lintBasis !== 'publish' && state.lintBasis !== 'local') {
      return '还没有按发布标准算出来的校验结果（草稿标准会放过禁用词一类问题，不能拿它当发布依据）。点「校验」重新算一次。'
    }
    if (lintErrors.length > 0) {
      return `还有 ${lintErrors.length} 个阻断项，全部修掉才能发布。就算这里放行，服务端也会再拦一次（PUBLISH_BLOCKED）。`
    }
    return null
  }

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
            '只写草稿，不发布：孩子拿到的永远是已发布的版本快照，正在玩的人不会被打断。草稿是可变行——同一集的草稿会被原地更新，不会每存一次就多一行历史。校验没过也能存：服务端只拦它自己点名的少数阻断项（身份级错误、会被规范化丢掉的段落），其余内容级问题一律放行——这正是草稿的用途：写到一半先落地。真正的闸口在发布：那时会按发布标准重新算一次，禁用词一类问题才拦人。',
          okText: '存草稿',
          danger: false,
        }
      case 'publish':
        return {
          title: `发布 ${businessKey}`,
          description:
            '发布会生成一个新的版本快照并切成当前版本，旧版本转 superseded（历史不删）。已经分配到这一集的设备仍锁在自己开始时的快照上，不会被中途换掉；只有之后新分配的设备才拿到新版本。发布不可撤销——要退回去请用「回滚到某一版」，那同样是新增一个版本。下面这份「发布前检查」是打开弹窗时按发布标准现算的，它有阻断项、算不出来、或请求失败时都不能提交。',
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

  // 弹窗正文按动作补料：发布摊开「发布前检查」，存草稿被拒摊开服务端返回的 lint
  // 报告。两者都放在理由输入框之上——它们是「这一步还要不要继续」的依据，
  // 而不是提交失败之后才给人看的马后炮。
  const dialogExtra = [
    action === 'publish' && state.lint !== null ? (
      <LintPanel
        key="publish-check"
        report={state.lint}
        title="发布前检查（发布标准 · 打开这个弹窗时现算）"
        stale={state.lintStale}
      />
    ) : null,
    action === 'save' && rejectedLint !== null ? (
      <LintPanel
        key="rejected-lint"
        report={rejectedLint}
        title="服务端拒绝这次存草稿的原因"
      />
    ) : null,
    conflictExtra,
  ].filter((part) => part !== null)

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

      {authoring && <DocxUploadButton onConverted={onConverted} />}

      {/* 校验是只读动作，只读环境同样可用（上面那段说明已经这么承诺了），所以这一行
          不受 authoring 门控；写动作仍然只在 authoring 下出现。 */}
      <Space size={8} wrap>
        <Button
          onClick={state.runLintNow}
          // 首次打开抽屉时「发布标准」查询也在飞，转圈是真的在校验，不是骗人
          loading={state.lintPending}
          disabled={content === null}
          title="按发布标准校验当前这一份内容。打字过程中不会自动校验：草稿允许写到一半，实时弹错只会打断写作。"
        >
          校验
        </Button>
        {authoring && (
          <>
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
              onClick={() => {
                // 打开弹窗的同时现算一次发布前检查。门在弹窗里 fail closed，
                // 不在按钮的禁用条件上让人猜「为什么点不动」
                state.runLintNow()
                setAction('publish')
              }}
              title={
                !summary.hasDraft
                  ? '还没有草稿，先存一次草稿'
                  : state.dirty
                    ? '有未保存的改动：先存草稿再发布，否则发出去的还是上一份'
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
          </>
        )}
        {state.dirty && <Tag color="gold">有未保存的改动</Tag>}
        {state.lintStale && <Tag color="gold">校验结果已过期</Tag>}
      </Space>

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
          description={`${state.lintError.message}${
            state.lintError.domainCode ? `（${state.lintError.domainCode}）` : ''
          }。这**不等于**「内容没问题」：发布前检查在这种情况下同样不放行，点「校验」重试一次。`}
        />
      )}

      <LintPanel
        report={state.lint}
        title={LINT_BASIS_TITLES[state.lintBasis]}
        stale={state.lintStale}
        warningsNote={LINT_WARNINGS_NOTES[state.lintBasis]}
      />

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

      <Modal
        open={fillConfirmOpen}
        title="上传会覆盖当前内容"
        okText="覆盖并填充"
        cancelText="取消"
        okButtonProps={{ danger: true }}
        onCancel={() => {
          setFillConfirmOpen(false)
          setFillPending(null)
        }}
        onOk={() => {
          if (fillPending) state.change(fillPending.content)
          setFillConfirmOpen(false)
          setFillPending(null)
        }}
      >
        <Typography.Text>
          编辑器里已有内容，上传 docx 会整份覆盖标题与互动（只填内容，不动这一集的主角与集号），
          且不会自动保存——覆盖后仍需点「存草稿」才会落库。是否继续？
        </Typography.Text>
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
          extra={dialogExtra.length > 0 ? dialogExtra : undefined}
          // 只有发布这道门 fail closed。存草稿刻意不拦：草稿本来就允许写到一半，
          // 服务端只拦身份级错误与会被规范化丢掉的段落，拒绝时会把 lint 报告摊在上面
          blockedReason={action === 'publish' ? publishGateReason() : null}
          onCancel={closeDialog}
          onSubmit={submit}
        />
      )}
    </Space>
  )
}
