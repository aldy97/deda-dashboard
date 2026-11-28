import { useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Drawer,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Typography,
} from 'antd'
import {
  useApproveVideoStoryboard,
  useRegenerateVideoStoryboard,
  useRevoiceVideoStoryboard,
  useSaveVideoStoryboard,
  useValidateVideoStoryboard,
  useVideoJob,
} from '../../api/adventureVideo'
import type {
  StoryboardBeat,
  VideoEmotion,
  VideoJobDetail,
} from '../../types/adventureVideo'

const EMOTIONS: Array<{ value: VideoEmotion; label: string }> = [
  { value: 'calm', label: '平静' },
  { value: 'curious', label: '好奇' },
  { value: 'excited', label: '兴奋' },
  { value: 'gentle', label: '温柔' },
  { value: 'tense', label: '紧张' },
]

const REASON_MIN = 8

type Action = 'revoice' | 'regenerate' | 'approve'

interface Props {
  jobId: string
  open: boolean
  onClose: () => void
}

/**
 * 分镜审核器。
 *
 * 只编辑文案/画面/情绪/optional；beat 数量、顺序、说话角色与原文溯源由服务端锁定。
 * 校验规则唯一来源是 deda-server 的 validator，本组件只展示服务端的 code/path，
 * 不重复实现阈值。
 */
export default function StoryboardReview({ jobId, open, onClose }: Props) {
  const job = useVideoJob(open ? jobId : null)
  const detail = job.data

  return (
    <Drawer
      title="审核分镜"
      width={760}
      open={open}
      onClose={onClose}
      destroyOnHidden
    >
      {job.isLoading ? (
        <Spin />
      ) : !detail || !detail.review ? (
        <Alert type="warning" showIcon title="作业详情加载失败" />
      ) : (
        <StoryboardEditor
          key={`${detail.id}:${detail.review.revision}`}
          jobId={jobId}
          detail={detail}
          onClose={onClose}
        />
      )}
    </Drawer>
  )
}

function StoryboardEditor({
  jobId,
  detail,
  onClose,
}: {
  jobId: string
  detail: VideoJobDetail
  onClose: () => void
}) {
  const review = detail.review
  const [stylePrompt, setStylePrompt] = useState(
    detail.storyboard?.stylePrompt ?? '',
  )
  const [beats, setBeats] = useState<StoryboardBeat[]>(
    detail.storyboard?.beats.map((beat) => ({ ...beat })) ?? [],
  )
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [action, setAction] = useState<Action | null>(null)
  const [reason, setReason] = useState('')

  const validate = useValidateVideoStoryboard()
  const save = useSaveVideoStoryboard()
  const revoice = useRevoiceVideoStoryboard()
  const regenerate = useRegenerateVideoStoryboard()
  const approve = useApproveVideoStoryboard()

  const draft = { stylePrompt, beats }
  const reasonOk = reason.trim().length >= REASON_MIN
  const busy =
    validate.isPending ||
    save.isPending ||
    revoice.isPending ||
    regenerate.isPending ||
    approve.isPending

  function updateBeat(index: number, patch: Partial<StoryboardBeat>) {
    setBeats((current) =>
      current.map((beat, position) =>
        position === index ? { ...beat, ...patch } : beat,
      ),
    )
    setDirty(true)
    setNotice(null)
  }

  async function handleValidate() {
    setError(null)
    setNotice(null)
    try {
      const result = await validate.mutateAsync({
        jobId,
        storyboard: draft,
      })
      setNotice(
        `校验通过：预估 ${result.estimate.totalSec.toFixed(1)} 秒 / ${result.estimate.chars} 字`,
      )
    } catch (caught) {
      setError((caught as Error).message)
    }
  }

  async function handleSave() {
    setError(null)
    setNotice(null)
    try {
      await save.mutateAsync({
        jobId,
        storyboard: draft,
        expectedRevision: review.revision,
      })
      setDirty(false)
      setNotice('已保存。改过文案的话，还需要重新配音才能审批。')
    } catch (caught) {
      setError((caught as Error).message)
    }
  }

  function openAction(next: Action) {
    if (dirty) {
      setError('有未保存的修改，请先保存再操作。')
      return
    }
    setError(null)
    setAction(next)
    setReason('')
  }

  async function submitAction() {
    if (!action || !reasonOk) return
    setError(null)
    try {
      if (action === 'revoice') {
        await revoice.mutateAsync({
          jobId,
          expectedRevision: review.revision,
          reason: reason.trim(),
        })
        setNotice('已提交重新配音，完成后会回到待审核。')
        onClose()
      } else if (action === 'regenerate') {
        await regenerate.mutateAsync({
          jobId,
          expectedRevision: review.revision,
          reason: reason.trim(),
        })
        setNotice('已提交重新生成分镜，完成后会回到待审核。')
        onClose()
      } else {
        await approve.mutateAsync({
          jobId,
          expectedRevision: review.revision,
          reason: reason.trim(),
        })
        setNotice('已审批，作业进入视频生成。')
        onClose()
      }
      setAction(null)
    } catch (caught) {
      setError((caught as Error).message)
    }
  }

  return (
    <Space orientation="vertical" size={14} style={{ width: '100%' }}>
      <Space size={8} wrap>
        <Tag color="gold">待审核</Tag>
        <Typography.Text type="secondary">
          revision {review.revision}
        </Typography.Text>
        <Typography.Text type="secondary">
          预估 {review.estimate?.totalSec.toFixed(1) ?? '—'} 秒 ·{' '}
          {review.estimate?.chars ?? 0} 字
        </Typography.Text>
        <Typography.Text
          type={review.voice.textMatches ? 'secondary' : 'danger'}
        >
          实测 {review.voice.totalSec?.toFixed(1) ?? '—'} 秒 ·{' '}
          {review.voice.textMatches ? '音频与文案一致' : '文案已改，需重新配音'}
        </Typography.Text>
      </Space>

      {error ? <Alert type="error" showIcon title={error} /> : null}
      {notice ? <Alert type="success" showIcon title={notice} /> : null}

      <Card size="small" title="原文对照">
        <Space orientation="vertical" size={4} style={{ width: '100%' }}>
          {review.sourceSegments.length === 0 ? (
            <Typography.Text type="secondary">没有原文段落</Typography.Text>
          ) : (
            review.sourceSegments.map((segment, index) => (
              <Typography.Text key={index} type="secondary">
                [{index}]（{segment.kind ?? 'narration'}）{segment.text}
              </Typography.Text>
            ))
          )}
        </Space>
      </Card>

      <Card size="small" title="全片画风">
        <Input.TextArea
          rows={2}
          value={stylePrompt}
          onChange={(event) => {
            setStylePrompt(event.target.value)
            setDirty(true)
            setNotice(null)
          }}
        />
      </Card>

      {beats.map((beat, index) => {
        const voice = review.voice.beats.find(
          (item) => item.order === beat.order,
        )
        return (
          <Card
            key={beat.order}
            size="small"
            title={
              <Space size={8} wrap>
                <Typography.Text strong>Beat {index + 1}</Typography.Text>
                <Tag>{beat.speaker}</Tag>
                <Tag>{beat.characters.join(' / ') || '无角色'}</Tag>
                <Typography.Text type="secondary">
                  原文段 {beat.sourceSegmentOrders.join(', ')}
                </Typography.Text>
                {voice ? (
                  <Typography.Text type="secondary">
                    实测 {voice.durationSec.toFixed(1)} 秒
                  </Typography.Text>
                ) : null}
              </Space>
            }
          >
            <Space orientation="vertical" size={8} style={{ width: '100%' }}>
              <Input.TextArea
                rows={3}
                value={beat.text}
                maxLength={120}
                showCount
                onChange={(event) =>
                  updateBeat(index, { text: event.target.value })
                }
              />
              <Input
                value={beat.shot}
                maxLength={120}
                onChange={(event) =>
                  updateBeat(index, { shot: event.target.value })
                }
                placeholder="景别/运镜/动作"
              />
              <Input.TextArea
                rows={2}
                value={beat.visualPrompt}
                maxLength={400}
                onChange={(event) =>
                  updateBeat(index, {
                    visualPrompt: event.target.value,
                  })
                }
                placeholder="画面描述"
              />
              <Space size={12} wrap>
                <Space size={6}>
                  <Typography.Text type="secondary">情绪</Typography.Text>
                  <Select
                    style={{ width: 120 }}
                    value={beat.emotion}
                    options={EMOTIONS}
                    onChange={(value: VideoEmotion) =>
                      updateBeat(index, { emotion: value })
                    }
                  />
                </Space>
                <Space size={6}>
                  <Typography.Text type="secondary">超时长可丢</Typography.Text>
                  <Switch
                    checked={beat.optional}
                    onChange={(checked) =>
                      updateBeat(index, { optional: checked })
                    }
                  />
                </Space>
                {voice?.audioUrl ? (
                  <audio controls src={voice.audioUrl} />
                ) : null}
              </Space>
            </Space>
          </Card>
        )
      })}

      <Space size={8} wrap>
        <Button
          onClick={() => void handleValidate()}
          loading={validate.isPending}
        >
          校验
        </Button>
        <Button
          type="primary"
          onClick={() => void handleSave()}
          loading={save.isPending}
          disabled={!dirty}
        >
          保存
        </Button>
        <Button onClick={() => openAction('revoice')} disabled={busy || dirty}>
          重新配音
        </Button>
        <Button
          type="primary"
          onClick={() => openAction('approve')}
          disabled={!review.canApprove || dirty || busy}
        >
          通过并生成
        </Button>
        <Button danger onClick={() => openAction('regenerate')} disabled={busy}>
          重新生成分镜
        </Button>
      </Space>
      {dirty ? (
        <Typography.Text type="warning">
          有未保存的修改；保存前不能重新配音或审批。
        </Typography.Text>
      ) : null}

      <Modal
        open={action !== null}
        title={
          action === 'revoice'
            ? '重新配音'
            : action === 'regenerate'
              ? '重新生成分镜'
              : '通过并生成'
        }
        okText="提交"
        cancelText="返回"
        okButtonProps={{
          danger: action === 'regenerate',
          disabled: !reasonOk,
          loading: busy,
        }}
        mask={{ closable: false }}
        onCancel={() => setAction(null)}
        onOk={() => void submitAction()}
      >
        <Space orientation="vertical" size={8} style={{ width: '100%' }}>
          <Typography.Text type="secondary">
            理由至少 {REASON_MIN} 个字，会写进内容审计。
          </Typography.Text>
          <Input.TextArea
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            showCount
            placeholder={
              action === 'regenerate'
                ? '例如：分镜结构不对，重新生成一版'
                : action === 'revoice'
                  ? '例如：文案改过，重新配音确认时长'
                  : '例如：实测 57 秒，内容与原文一致，同意出片'
            }
          />
        </Space>
      </Modal>
    </Space>
  )
}
