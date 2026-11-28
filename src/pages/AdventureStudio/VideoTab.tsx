import { useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Empty,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Typography,
} from 'antd'
import {
  useCreateVideoJob,
  useVideoCapabilities,
  useVideoJobs,
} from '../../api/adventureVideo'
import {
  newRequestId,
  VIDEO_YUAN_PER_SECOND,
  type VideoJobSummary,
} from '../../types/adventureVideo'
import VideoJobCard from './VideoJobCard'

/**
 * 「短视频」tab。
 *
 * 只对当前发布版开放：草稿/历史版本/已下架都禁用按钮，并说明原因——
 * 视频必须绑定不可变快照，否则内容一改，之前的片子就对不上故事了。
 *
 * 确认弹窗里固定三项：分辨率、理由（≥8 字）、预估费用；requestId 在打开时生成一次，
 * 重复点「确定」不会重复扣费。
 */

const REASON_MIN = 8
const RESOLUTIONS = ['480P', '720P', '1080P'] as const

interface Props {
  episodeId: string
  currentVersionId: string | null
  published: boolean
  retiredAt: string | null
  authoring: boolean
}

export default function VideoTab({
  episodeId,
  currentVersionId,
  published,
  retiredAt,
  authoring,
}: Props) {
  const capabilities = useVideoCapabilities()
  const jobs = useVideoJobs(episodeId)
  const create = useCreateVideoJob()

  const [open, setOpen] = useState(false)
  const [resolution, setResolution] = useState<string>('720P')
  const [reason, setReason] = useState('')
  const [requestId, setRequestId] = useState<string>('')
  const [submitError, setSubmitError] = useState<string | null>(null)

  const caps = capabilities.data ?? null
  const durationSec = caps?.durationSec ?? 60
  const reasonOk = reason.trim().length >= REASON_MIN
  const canGenerate =
    authoring &&
    published &&
    !retiredAt &&
    Boolean(currentVersionId) &&
    caps?.enabled === true

  const sortedJobs: VideoJobSummary[] = useMemo(
    () => jobs.data ?? [],
    [jobs.data],
  )

  function openDialog() {
    setResolution(caps?.resolution ?? '720P')
    setReason('')
    setSubmitError(null)
    setRequestId(newRequestId())
    setOpen(true)
  }

  async function submit() {
    if (!currentVersionId || !reasonOk) return
    setSubmitError(null)
    try {
      await create.mutateAsync({
        episodeId,
        episodeVersionId: currentVersionId,
        requestId,
        resolution,
        reason: reason.trim(),
      })
      setOpen(false)
    } catch (error) {
      setSubmitError((error as Error).message || '建单失败，请重试。')
    }
  }

  if (capabilities.isLoading) {
    return <Spin />
  }

  if (!caps?.enabled) {
    return (
      <Alert
        type="info"
        showIcon
        title="短视频工作台在本环境未开启"
        description="需要服务端 ADVENTURE_VIDEO_ENABLED=true，并配置百炼与 OSS。"
      />
    )
  }

  const blockedReason = retiredAt
    ? '这一集已下架，不能生成故事短片。'
    : !published || !currentVersionId
      ? '只有已发布的故事才能生成故事短片；先发布草稿。'
      : !authoring
        ? '当前账号/环境只读，不能生成。'
        : null

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <Space size={8} wrap>
        <Button
          type="primary"
          disabled={!canGenerate}
          onClick={openDialog}
          loading={create.isPending}
        >
          生成故事短片
        </Button>
      </Space>

      {blockedReason ? (
        <Alert type="warning" showIcon title={blockedReason} />
      ) : null}

      {caps.ttsMode === 'cloned' && !caps.voicesReady ? (
        <Alert
          type="error"
          showIcon
          title="复刻音色未就绪"
          description="先跑 scripts/clone-adventure-video-voices.ts 并确认三条角色音色状态为 ready。"
        />
      ) : null}

      {caps.ttsMode === 'system' ? (
        <Alert
          type="info"
          showIcon
          title="当前为系统音色试跑"
          description="三条角色音色样本到位并复刻后，把 VIDEO_TTS_MODE 切到 cloned；见 docs/adventure-video.md。"
        />
      ) : null}

      {jobs.error ? (
        <Alert
          type="error"
          showIcon
          title="作业列表加载失败"
          description={(jobs.error as Error).message}
        />
      ) : null}

      {sortedJobs.length === 0 ? (
        <Empty
          description={
            jobs.isLoading ? '加载中…' : '这一集还没有生成过故事短片'
          }
        />
      ) : (
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          {sortedJobs.map((job) => (
            <VideoJobCard
              key={job.id}
              job={job}
              authoring={authoring}
              canReview={caps.reviewWritable === true}
            />
          ))}
        </Space>
      )}

      <Modal
        open={open}
        title="生成故事短片"
        okText="开始生成"
        cancelText="取消"
        okButtonProps={{ disabled: !reasonOk, loading: create.isPending }}
        mask={{ closable: false }}
        onCancel={() => setOpen(false)}
        onOk={() => void submit()}
      >
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <Space size={8}>
            <Typography.Text>分辨率</Typography.Text>
            <Select
              style={{ width: 120 }}
              value={resolution}
              onChange={setResolution}
              options={RESOLUTIONS.map((value) => ({
                value,
                label: value,
              }))}
            />
            <Typography.Text type="secondary">
              预估 {(VIDEO_YUAN_PER_SECOND[resolution] * durationSec).toFixed(2)} 元
              （列表价，实际以账单为准）
            </Typography.Text>
          </Space>

          <div>
            <Typography.Text type="secondary">
              绑定版本 v{currentVersionId?.slice(0, 8)}：内容再改也不会影响这支片子
            </Typography.Text>
          </div>

          <div>
            <Typography.Text type="secondary">
              理由至少 {REASON_MIN} 个字，会写进内容审计。
            </Typography.Text>
            <Input.TextArea
              style={{ marginTop: 6 }}
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="例如：给第 3 集做一支抖音/小红书短片，验证投放素材"
              maxLength={500}
              showCount
            />
          </div>

          {submitError ? (
            <Alert type="error" showIcon title="建单失败" description={submitError} />
          ) : null}
        </Space>
      </Modal>
    </Space>
  )
}
