import { useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Descriptions,
  Input,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import type { EnvView } from '../../components/env'
import {
  classifyPromptWriteError,
  promptWriteFailureHint,
  usePromptDetail,
  usePromptVersions,
  usePublishPrompt,
  useResetPromptToDefault,
  useRollbackPrompt,
  useSavePromptDraft,
} from '../../api/prompts'
import type { PromptDetail, PromptVersionItem } from '../../types/analytics'
import { diffLines, isSameContent } from './diff'
import PublishModal from './PublishModal'
import type { PublishSubmitInput } from './PublishModal'
import PromptDiff from './PromptDiff'
import VersionHistory from './VersionHistory'
import { categoryLabel, resolvePromptState, sceneLabel, sourceLabel } from './labels'
import type { PublishActionKind } from './labels'

/**
 * 单个 prompt 的查看 / 编辑 / 发布面板（挂在列表页的抽屉里）。
 *
 * 两条不能含糊的语义：
 * 1. **发布的是已保存的草稿，不是屏幕上这段文本**。所以有未保存改动时发布按钮
 *    直接禁用并说明原因，杜绝「我以为发的是我刚改的」。
 * 2. **回滚 = 以目标版本正文新建 revision 再发布**（服务端 git revert 语义），
 *    历史只增不改，因此这里没有任何删除入口。
 */

interface Notice {
  kind: 'success' | 'error'
  text: string
}

export interface PromptEditorProps {
  promptKey: string
  env: EnvView
  /** env.known && meta.promptWriteEnabled === true */
  writable: boolean
  /** writable=false 时展示的理由 */
  disabledReason: string | null
  confirmCodeHint: string
}

export default function PromptEditor(props: PromptEditorProps) {
  const detailQuery = usePromptDetail(props.promptKey)
  // 通知必须放在外壳：保存/发布成功后 draftRevision 或 publishedRevision 变化，
  // 表单会按 key 重挂载，放在表单里的提示会跟着一起消失
  const [notice, setNotice] = useState<Notice | null>(null)

  if (detailQuery.isLoading) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Spin />
      </div>
    )
  }

  if (detailQuery.error) {
    const message =
      detailQuery.error instanceof Error
        ? detailQuery.error.message
        : '加载失败'
    return (
      <Alert
        type="error"
        showIcon
        message="prompt 详情加载失败"
        description={message}
      />
    )
  }

  const detail = detailQuery.data
  if (!detail) return null

  return (
    <>
      {notice && (
        <Alert
          type={notice.kind}
          showIcon
          closable
          message={notice.text}
          onClose={() => setNotice(null)}
          style={{ marginBottom: 16 }}
        />
      )}
      <PromptEditorForm
        // 指针变化即重挂载：表单状态永远从服务端最新真相初始化，
        // 不需要 useEffect 同步，也不会出现「保存成功但输入框还是旧值」
        key={`${props.promptKey}:${detail.draftRevision ?? 0}:${
          detail.publishedRevision ?? 0
        }`}
        detail={detail}
        onNotice={setNotice}
        {...props}
      />
    </>
  )
}

function PromptEditorForm({
  detail,
  promptKey,
  env,
  writable,
  disabledReason,
  confirmCodeHint,
  onNotice,
}: PromptEditorProps & {
  detail: PromptDetail
  onNotice: (notice: Notice | null) => void
}) {
  const versionsQuery = usePromptVersions(promptKey)
  const saveDraft = useSavePromptDraft(promptKey)
  const publish = usePublishPrompt(promptKey)
  const rollback = useRollbackPrompt(promptKey)
  const resetToDefault = useResetPromptToDefault(promptKey)

  const baseline = detail.draftContent ?? detail.effectiveContent
  const [text, setText] = useState(baseline)
  const [note, setNote] = useState(detail.draftChangeNote ?? '')
  const [actionError, setActionError] = useState<string | null>(null)
  const [modal, setModal] = useState<{
    action: PublishActionKind
    version?: PromptVersionItem
  } | null>(null)

  const dirty = !isSameContent(text, baseline)
  const state = resolvePromptState(detail)
  const source = sourceLabel(detail.source)
  const expectedRevision = detail.draftRevision ?? 0
  const editorDiff = useMemo(
    () => diffLines(detail.effectiveContent, text),
    [detail.effectiveContent, text],
  )
  const sameAsDefault = isSameContent(
    detail.effectiveContent,
    detail.defaultContent,
  )

  const submitting =
    publish.isPending || rollback.isPending || resetToDefault.isPending

  const modalConfig = useMemo(() => {
    if (!modal) return null
    if (modal.action === 'publish') {
      return {
        target: `${promptKey} · 草稿 r${detail.draftRevision}`,
        consequence:
          '发布后线上所有设备的下一轮对话立即使用草稿正文。单实例部署下发布方本机即刻生效。',
        diff: diffLines(
          detail.effectiveContent,
          detail.draftContent ?? detail.effectiveContent,
        ),
      }
    }
    if (modal.action === 'rollback' && modal.version) {
      return {
        target: `${promptKey} · 回滚到 r${modal.version.revision}`,
        consequence: `以 r${modal.version.revision} 的正文新建一个版本并立即发布；当前未发布的草稿会被丢弃（正文仍留在版本历史里）。`,
        diff: diffLines(detail.effectiveContent, modal.version.content),
      }
    }
    return {
      target: `${promptKey} · 恢复代码默认值`,
      consequence:
        '以代码默认正文新建一个版本并立即发布；不删除模板行，审计链上留下「谁在什么时候恢复的默认」。',
      diff: diffLines(detail.effectiveContent, detail.defaultContent),
    }
  }, [modal, promptKey, detail])

  const failWith = (err: unknown) =>
    promptWriteFailureHint(classifyPromptWriteError(err), err)

  const handleSubmit = (input: PublishSubmitInput) => {
    if (!modal) return
    setActionError(null)
    const onError = (err: unknown) => setActionError(failWith(err))

    if (modal.action === 'publish') {
      const revision = detail.draftRevision
      if (revision === null) {
        setActionError('没有待发布的草稿，请先保存草稿。')
        return
      }
      publish.mutate(
        { revision, changeNote: input.changeNote, confirmCode: input.confirmCode },
        {
          onSuccess: (data) => {
            setModal(null)
            onNotice({
              kind: 'success',
              text: `已发布 r${data.publishedRevision}，线上立即生效。`,
            })
          },
          onError,
        },
      )
      return
    }

    if (modal.action === 'rollback' && modal.version) {
      const target = modal.version
      rollback.mutate(
        {
          targetRevision: target.revision,
          changeNote: input.changeNote,
          confirmCode: input.confirmCode,
        },
        {
          onSuccess: (data) => {
            setModal(null)
            onNotice({
              kind: 'success',
              text: `已回滚：以 r${target.revision} 的正文发布为 r${data.publishedRevision}${
                data.discardedDraftRevision
                  ? `；被丢弃的草稿是 r${data.discardedDraftRevision}，正文仍在版本历史里`
                  : ''
              }。`,
            })
          },
          onError,
        },
      )
      return
    }

    resetToDefault.mutate(
      { changeNote: input.changeNote, confirmCode: input.confirmCode },
      {
        onSuccess: (data) => {
          setModal(null)
          onNotice({
            kind: 'success',
            text: `已恢复代码默认值并发布为 r${data.publishedRevision}。`,
          })
        },
        onError,
      },
    )
  }

  const handleSaveDraft = () => {
    onNotice(null)
    saveDraft.mutate(
      {
        content: text,
        expectedRevision,
        changeNote: note.trim() || undefined,
      },
      {
        onSuccess: (data) =>
          onNotice({
            kind: 'success',
            text: `草稿已保存为 r${data.draftRevision}；尚未发布，线上仍在用当前生效正文。`,
          }),
        onError: (err) => onNotice({ kind: 'error', text: failWith(err) }),
      },
    )
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Descriptions column={2} size="small" colon={false}>
        <Descriptions.Item label="key">
          <Typography.Text code>{detail.key}</Typography.Text>
        </Descriptions.Item>
        <Descriptions.Item label="名称">{detail.name}</Descriptions.Item>
        <Descriptions.Item label="分类">
          <Tag>{categoryLabel(detail.category)}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="调用场景">
          {sceneLabel(detail.scene)}
        </Descriptions.Item>
        <Descriptions.Item label="生效来源">
          <Tag color={source.color}>{source.text}</Tag>
          {detail.deviatesFromDefault && <Tag color="orange">已偏离默认</Tag>}
        </Descriptions.Item>
        <Descriptions.Item label="状态">
          <Tag color={state.color}>{state.text}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="最近发布">
          {detail.publishedAt
            ? `${detail.publishedAt} · ${detail.publishedBy ?? '—'}`
            : '从未发布'}
        </Descriptions.Item>
        <Descriptions.Item label="正文上限">
          {detail.maxChars} 字符
        </Descriptions.Item>
      </Descriptions>

      <div>
        <Typography.Text strong>用途</Typography.Text>
        <Typography.Paragraph
          type="secondary"
          style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}
        >
          {detail.description}
        </Typography.Paragraph>
      </div>

      <div>
        <Typography.Text strong>变量契约</Typography.Text>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 6 }}>
          变量由服务端代码定义，改正文时占位符必须原样保留；带 * 的必填，
          缺失会在渲染时抛错而不是把 {'{{x}}'} 发给模型。
        </Typography.Paragraph>
        {detail.variables.length === 0 ? (
          <Typography.Text type="secondary">
            无变量（纯静态文本）
          </Typography.Text>
        ) : (
          <Space size={[4, 4]} wrap>
            {detail.variables.map((variable) => (
              <Tooltip key={variable.name} title={variable.description}>
                <Tag color={variable.required ? 'processing' : 'default'}>
                  {`{{${variable.name}}}`}
                  {variable.required ? ' *' : ''}
                </Tag>
              </Tooltip>
            ))}
          </Space>
        )}
      </div>

      <div>
        <Space
          style={{ width: '100%', justifyContent: 'space-between' }}
          align="center"
        >
          <Typography.Text strong>
            {detail.draftRevision !== null
              ? `草稿正文 r${detail.draftRevision}`
              : '正文（当前生效值，保存后生成草稿）'}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {dirty ? '有未保存的改动' : '与服务端一致'}
          </Typography.Text>
        </Space>
        <Input.TextArea
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoSize={{ minRows: 10, maxRows: 26 }}
          maxLength={detail.maxChars}
          showCount
          disabled={!writable}
          aria-label="prompt 正文"
          style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
        />
        {dirty && (
          <div style={{ marginTop: 8 }}>
            <Typography.Text strong style={{ fontSize: 12 }}>
              与当前生效正文的差异
            </Typography.Text>
            <PromptDiff lines={editorDiff} maxHeight={200} />
          </div>
        )}
      </div>

      <div>
        <Typography.Text strong>本次改动说明</Typography.Text>
        <Input.TextArea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={500}
          showCount
          disabled={!writable}
          aria-label="草稿改动说明"
          placeholder="保存草稿时一并写入版本审计链（可留空，发布时必须填）"
        />
      </div>

      {writable ? (
        <Space wrap>
          <Tooltip
            title={dirty ? '' : '没有未保存的改动'}
          >
            <Button
              type="primary"
              loading={saveDraft.isPending}
              disabled={!dirty || submitting}
              onClick={handleSaveDraft}
            >
              保存草稿
            </Button>
          </Tooltip>
          <Tooltip
            title={
              !state.hasDraft
                ? '还没有草稿：先改正文并保存草稿'
                : dirty
                  ? '有未保存的改动：发布的是已保存的草稿，请先保存或撤销改动'
                  : ''
            }
          >
            <Button
              danger
              type="primary"
              disabled={!state.hasDraft || dirty || submitting}
              onClick={() => {
                setActionError(null)
                onNotice(null)
                setModal({ action: 'publish' })
              }}
            >
              发布草稿
            </Button>
          </Tooltip>
          <Tooltip
            title={sameAsDefault ? '当前生效正文已经等于代码默认值' : ''}
          >
            <Button
              disabled={sameAsDefault || submitting}
              onClick={() => {
                setActionError(null)
                onNotice(null)
                setModal({ action: 'reset' })
              }}
            >
              恢复代码默认值
            </Button>
          </Tooltip>
        </Space>
      ) : (
        <Alert
          type="warning"
          showIcon
          message="当前为只读"
          description={disabledReason}
        />
      )}

      <div>
        <Typography.Title level={5}>版本历史</Typography.Title>
        <VersionHistory
          versions={versionsQuery.data ?? []}
          loading={versionsQuery.isLoading}
          canRollback={writable && !dirty}
          disabledReason={
            !writable
              ? disabledReason
              : '有未保存的改动，先保存草稿或还原后再回滚'
          }
          publishedRevision={detail.publishedRevision}
          onRollback={(version) => {
            setActionError(null)
            onNotice(null)
            setModal({ action: 'rollback', version })
          }}
        />
      </div>

      {modal && modalConfig && (
        <PublishModal
          open
          action={modal.action}
          env={env}
          confirmCodeHint={confirmCodeHint}
          target={modalConfig.target}
          consequence={modalConfig.consequence}
          diff={modalConfig.diff}
          submitting={submitting}
          errorText={actionError}
          onCancel={() => setModal(null)}
          onSubmit={handleSubmit}
        />
      )}
    </Space>
  )
}
