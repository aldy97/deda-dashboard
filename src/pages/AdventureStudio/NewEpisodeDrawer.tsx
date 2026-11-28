import { useState } from 'react'
import {
  Alert,
  Button,
  Drawer,
  InputNumber,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd'
import { drawerWidth } from '../../utils/drawer-width'
import type { ApiError } from '../../api/client'
import {
  useAdventureLint,
  useAdventureNextEpisodeNumber,
  useCreateAdventureEpisode,
} from '../../api/queries'
import type {
  AdventureCharacterKey,
  CapabilitiesResponse,
  EpisodeContent,
  EpisodeIdentity,
  LintReport,
  ScriptConvertResult,
} from '../../types/adventureAdmin'
import DocxUploadButton from './DocxUploadButton'
import EpisodeEditor from './EpisodeEditor'
import LintPanel from './LintPanel'
import PreviewSimulator from './PreviewSimulator'
import ReasonDialog from './ReasonDialog'
import { characterLabel } from './labels'

/**
 * 新建一集的抽屉（取代原来的 CreateEpisodeDialog 弹窗）。
 *
 * 两个入口都落到这里：
 * - 手动「新建故事集」：seed=null，空内容 + 默认主角 elly + 自动集号；
 * - 上传 docx「生成草稿」：seed = 服务端 LLM 转换结果（标题=正文首行、主角识别、集号自增）。
 *
 * 除此之外，抽屉里还能随时「从 docx 填充」：用同一接口（POST /script/convert）把转换结果
 * 写回主角/集号/标题/互动。seed 只在 useState 初始化时读一次，抽屉内填充则走 applyFill
 * 后写这些 state；因此主角识别告警与原文回看也改成由 state 驱动，而不是只认 seed。
 *
 * 与 EpisodeDetailDrawer 的区别：这里**还没有 episodeId**，编辑的内容只存在于本地，
 * 「存草稿」走 POST /episodes 真正落库，成功后才切到 EpisodeDetailDrawer。
 * 集号与主角都可改；集号缺省用服务端自增值，业务键会摆在显眼处（业务键永久占用）。
 */
interface Props {
  open: boolean
  seed: ScriptConvertResult | null
  capabilities: CapabilitiesResponse
  onClose: () => void
  onCreated: (episodeId: string) => void
}

const EMPTY_CONTENT: EpisodeContent = { title: '', recap: null, segments: [] }

export default function NewEpisodeDrawer({
  open,
  seed,
  capabilities,
  onClose,
  onCreated,
}: Props) {
  const manual = seed === null
  const defaultKey = capabilities.characterKeys[0] ?? 'elly'
  const [characterKey, setCharacterKey] = useState<AdventureCharacterKey>(
    seed?.characterKey ?? defaultKey,
  )
  // null = 还没手填：展示服务端自增集号（手动模式）或 seed 里的集号
  const [episodeNumber, setEpisodeNumber] = useState<number | null>(
    seed?.episodeNumber ?? null,
  )
  const [content, setContent] = useState<EpisodeContent>(
    seed?.content ?? EMPTY_CONTENT,
  )
  const [saveOpen, setSaveOpen] = useState(false)
  const [simulateOpen, setSimulateOpen] = useState(false)
  const [closePromptOpen, setClosePromptOpen] = useState(false)
  const [lint, setLint] = useState<LintReport | null>(seed?.lint ?? null)
  // 抽屉内「从 docx 填充」的来源：seed 初始化，之后可被 applyFill 后写
  const [sourceText, setSourceText] = useState<string | null>(
    seed?.sourceText ?? null,
  )
  const [characterDetected, setCharacterDetected] = useState<boolean>(
    seed?.characterDetected ?? true,
  )
  const [fillPending, setFillPending] = useState<ScriptConvertResult | null>(null)
  const [fillConfirmOpen, setFillConfirmOpen] = useState(false)

  // 手动模式下按当前主角取下一集集号；换主角会自动重取（集号还没被手填时）
  const nextNumber = useAdventureNextEpisodeNumber(manual ? characterKey : null)
  const effectiveEpisodeNumber =
    episodeNumber ?? nextNumber.data?.episodeNumber ?? null

  const create = useCreateAdventureEpisode()
  const lintMutation = useAdventureLint()
  const createError = (create.error as ApiError | null) ?? null

  const businessKey =
    effectiveEpisodeNumber === null
      ? null
      : `${characterKey}/${capabilities.season}/${effectiveEpisodeNumber}`
  const identity: EpisodeIdentity | null =
    effectiveEpisodeNumber === null
      ? null
      : {
          characterKey,
          season: capabilities.season,
          episodeNumber: effectiveEpisodeNumber,
        }

  const hasContent =
    content.title.trim() !== '' ||
    (content.recap?.trim() ?? '') !== '' ||
    content.segments.length > 0

  function applyFill(result: ScriptConvertResult) {
    setCharacterKey(result.characterKey)
    setEpisodeNumber(result.episodeNumber)
    setContent(result.content)
    setLint(result.lint)
    setSourceText(result.sourceText)
    setCharacterDetected(result.characterDetected)
  }

  function onConverted(result: ScriptConvertResult) {
    if (hasContent) {
      // 已有内容：整份覆盖前先确认，避免手填/上一份填充被静默冲掉
      setFillPending(result)
      setFillConfirmOpen(true)
      return
    }
    applyFill(result)
  }

  function requestClose() {
    if (hasContent) {
      setClosePromptOpen(true)
      return
    }
    onClose()
  }

  function runLint() {
    if (identity === null) return
    lintMutation.mutate(
      { identity, content, forPublish: true },
      {
        onSuccess: (report) => setLint(report),
      },
    )
  }

  function submitCreate(values: { reason: string }) {
    if (identity === null) return
    create.mutate(
      {
        identity,
        content,
        reason: values.reason,
      },
      {
        onSuccess: (res) => {
          setSaveOpen(false)
          onCreated(res.episodeId)
        },
      },
    )
  }

  return (
    <Drawer
      open={open}
      onClose={requestClose}
      size={1040}
      maskClosable={false}
      title={
        <Space size={8} wrap>
          <Typography.Text strong>
            {seed ? '生成草稿预览' : '新建故事集'}
          </Typography.Text>
          {businessKey && <Typography.Text code>{businessKey}</Typography.Text>}
          <Tag>{characterLabel(characterKey)}</Tag>
        </Space>
      }
    >
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        {!characterDetected && (
          <Alert
            type="warning"
            showIcon
            message="没识别出这一集的主角，已默认小象 Elly"
            description="请在上方确认主角；选错了业务键（elly/… vs polly/…）就换错了频道。"
          />
        )}

        <Space size={8} wrap>
          <Select
            style={{ width: 200 }}
            value={characterKey}
            onChange={(value) => setCharacterKey(value)}
            options={capabilities.characterKeys.map((key) => ({
              value: key,
              label: `${characterLabel(key)}（${key}）`,
            }))}
          />
          <Typography.Text type="secondary">第 {capabilities.season} 季</Typography.Text>
          <InputNumber
            style={{ width: 140 }}
            min={1}
            step={1}
            precision={0}
            value={effectiveEpisodeNumber}
            onChange={(value) => setEpisodeNumber(value as number | null)}
            placeholder="自动"
          />
          <Typography.Text type="secondary">集号（留空 = 自动下一集）</Typography.Text>
        </Space>

        <DocxUploadButton onConverted={onConverted} />

        <Alert
          type="info"
          showIcon
          message="业务键一旦占用即永久占用"
          description={
            <>
              新建只落草稿，孩子看不到，直到你显式发布。但业务键{' '}
              {businessKey ? (
                <Typography.Text code>{businessKey}</Typography.Text>
              ) : (
                '（填好集号后显示）'
              )}{' '}
              会永久占用：即使之后作废这一集，同 IP 同季同集号也不能再用于新建。
            </>
          }
        />

        {sourceText && (
          <Alert
            type="info"
            showIcon
            message="原文回看"
            description={
              <Typography.Paragraph
                style={{ marginBottom: 0, whiteSpace: 'pre-wrap', fontSize: 12 }}
              >
                {sourceText}
              </Typography.Paragraph>
            }
          />
        )}

        <Space size={8} wrap>
          <Button
            onClick={runLint}
            loading={lintMutation.isPending}
            disabled={identity === null}
            title="按发布标准校验当前这一份内容（新建集号可能提示前置集未发布，那是发布时的门，存草稿不受影响）"
          >
            校验
          </Button>
          <Button type="primary" disabled={identity === null} onClick={() => setSaveOpen(true)}>
            存草稿
          </Button>
          <Button disabled={identity === null} onClick={() => setSimulateOpen(true)}>
            试播
          </Button>
        </Space>

        <LintPanel
          report={lint}
          title="校验结果"
          stale={false}
          warningsNote={
            lint && lint.errors.length === 0
              ? undefined
              : '（存草稿不阻断；其中一部分在发布标准下会变成阻断项）'
          }
        />

        <EpisodeEditor
          value={content}
          capabilities={capabilities}
          lint={lint}
          onChange={setContent}
        />
      </Space>

      <Modal
        open={closePromptOpen}
        title="有未保存的草稿内容"
        okText="丢弃并关闭"
        cancelText="留在这一页"
        okButtonProps={{ danger: true }}
        onCancel={() => setClosePromptOpen(false)}
        onOk={() => {
          setClosePromptOpen(false)
          onClose()
        }}
      >
        <Typography.Text>
          这一集的编辑内容还没有存成草稿。关掉抽屉就会丢掉它们（LLM
          转换结果也一样），审计里不会有任何痕迹。
        </Typography.Text>
      </Modal>

      <Modal
        open={fillConfirmOpen}
        title="上传会覆盖当前表单"
        okText="覆盖并填充"
        cancelText="取消"
        okButtonProps={{ danger: true }}
        onCancel={() => {
          setFillConfirmOpen(false)
          setFillPending(null)
        }}
        onOk={() => {
          if (fillPending) applyFill(fillPending)
          setFillConfirmOpen(false)
          setFillPending(null)
        }}
      >
        <Typography.Text>
          当前表单里已经有内容，上传 docx 会整份覆盖主角、集号、标题与互动，且无法撤销。
          是否继续？
        </Typography.Text>
      </Modal>

      {saveOpen && (
        <ReasonDialog
          key="create"
          open
          title="新建故事集"
          okText="存草稿"
          danger={false}
          pending={create.isPending}
          error={createError}
          onCancel={() => setSaveOpen(false)}
          onSubmit={submitCreate}
          description={
            <Space orientation="vertical" size={8} style={{ width: '100%' }}>
              <Typography.Text>
                会创建一集草稿{identity ? `（业务键 ${businessKey}）` : ''}
                ，不会发布，孩子看不到它，直到你显式发布。
              </Typography.Text>
              <Typography.Text type="secondary">
                集号与主角都可以在上面改；存草稿允许写到一半（服务端只拦身份级错误与
                会被丢掉的畸形段），真正的儿童内容闸口在发布那一步。
              </Typography.Text>
            </Space>
          }
        />
      )}

      <Modal
        open={simulateOpen}
        onCancel={() => setSimulateOpen(false)}
        footer={null}
        width={drawerWidth(860)}
        title="试播：按引擎规则走一遍（不写库、不审计）"
      >
        {identity && (
          <PreviewSimulator
            identity={identity}
            content={content}
            capabilities={capabilities}
          />
        )}
      </Modal>
    </Drawer>
  )
}
