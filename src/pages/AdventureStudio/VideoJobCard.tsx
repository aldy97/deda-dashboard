import { useRef, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Input,
  Modal,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd'
import {
  fetchVideoDownloadUrl,
  fetchVideoPreviewUrl,
  useCancelVideoJob,
  useRetryVideoJob,
  useVideoPreviewUrl,
} from '../../api/adventureVideo'
import {
  formatCents,
  isTerminal,
  type VideoJobStatus,
  type VideoJobSummary,
} from '../../types/adventureVideo'
import { fmtDateTime } from './labels'
import StoryboardReview from './StoryboardReview'

/**
 * 单条视频作业卡片。
 *
 * 预览 URL 只活 1 小时，所以只在 succeeded 时请求；失败/运行中没有 URL，
 * 不请求也不会出现「404 把整张卡拖红」。
 * 重试与取消都要理由（服务端 ≥8 字），在卡片内用独立弹窗收，避免 Modal.confirm
 * 里放受控输入导致状态丢失。
 */

const STATUS_META: Record<
  VideoJobStatus,
  { label: string; color: string }
> = {
  queued: { label: '排队中', color: 'default' },
  running: { label: '生成中', color: 'processing' },
  awaiting_review: { label: '待审核', color: 'gold' },
  succeeded: { label: '已完成', color: 'success' },
  failed: { label: '失败', color: 'error' },
  canceled: { label: '已取消', color: 'default' },
}

const STAGE_LABEL: Record<string, string> = {
  queued: '排队',
  storyboard: '分镜',
  voice: '配音',
  review: '待审核',
  visual: '画面',
  assemble: '合成',
  upload: '上传',
  done: '完成',
  canceled: '已取消',
}

const REASON_MIN = 8

type Action = 'retry' | 'cancel'

interface Props {
  job: VideoJobSummary
  authoring: boolean
  canReview?: boolean
}

export default function VideoJobCard({
  job,
  authoring,
  canReview = false,
}: Props) {
  const [action, setAction] = useState<Action | null>(null)
  const [reason, setReason] = useState('')
  const [reviewOpen, setReviewOpen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const resumeAtRef = useRef(0)
  const preview = useVideoPreviewUrl(
    job.id,
    job.status === 'succeeded',
  )
  const retry = useRetryVideoJob()
  const cancel = useCancelVideoJob()

  const busy = retry.isPending || cancel.isPending
  const reasonOk = reason.trim().length >= REASON_MIN

  function openAction(next: Action) {
    setAction(next)
    setReason('')
  }

  function handleVideoError() {
    resumeAtRef.current = videoRef.current?.currentTime ?? 0
    void preview.refetch()
  }

  function handleLoadedMetadata() {
    if (videoRef.current && resumeAtRef.current > 0) {
      videoRef.current.currentTime = resumeAtRef.current
      resumeAtRef.current = 0
    }
  }

  async function handleDownload() {
    const { url } = await fetchVideoDownloadUrl(job.id)
    window.location.assign(url)
  }

  async function handleOpenWindow() {
    const { url } = await fetchVideoPreviewUrl(job.id)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function submitAction() {
    if (!action || !reasonOk) return
    try {
      if (action === 'retry') {
        await retry.mutateAsync({ jobId: job.id, reason: reason.trim() })
      } else {
        await cancel.mutateAsync({ jobId: job.id, reason: reason.trim() })
      }
      setAction(null)
    } catch {
      // 错误由 apiClient 统一抛出；保持弹窗打开，用户可改理由重试
    }
  }

  return (
    <Card
      size="small"
      title={
        <Space size={8} wrap>
          <Tag color={STATUS_META[job.status].color}>
            {STATUS_META[job.status].label}
          </Tag>
          <Typography.Text code>{job.businessKey}</Typography.Text>
          <Typography.Text type="secondary">
            {job.resolution} · {job.aspect} ·{' '}
            {job.ttsMode === 'cloned' ? '复刻音色' : '系统音色试跑'}
          </Typography.Text>
        </Space>
      }
      extra={
        <Space size={8}>
          {job.status === 'failed' || job.status === 'canceled' ? (
            <Button
              size="small"
              disabled={!authoring || busy}
              onClick={() => openAction('retry')}
            >
              重试
            </Button>
          ) : null}
          {job.status === 'awaiting_review' && canReview ? (
            <Button
              size="small"
              type="primary"
              onClick={() => setReviewOpen(true)}
            >
              审核分镜
            </Button>
          ) : null}
          {job.status === 'queued' ||
          job.status === 'running' ||
          job.status === 'awaiting_review' ? (
            <Button
              size="small"
              danger
              disabled={!authoring || busy}
              onClick={() => openAction('cancel')}
            >
              取消
            </Button>
          ) : null}
        </Space>
      }
    >
      <Space orientation="vertical" size={10} style={{ width: '100%' }}>
        <Descriptions size="small" column={{ xs: 1, md: 2 }} items={[
          {
            key: 'stage',
            label: '阶段',
            children: `${STAGE_LABEL[job.stage] ?? job.stage}（第 ${job.attempts + 1} 次）`,
          },
          {
            key: 'created',
            label: '创建',
            children: fmtDateTime(job.createdAt),
          },
          {
            key: 'estimate',
            label: '预估',
            children: formatCents(job.estimatedCostCents),
          },
          {
            key: 'actual',
            label: '实际',
            children:
              job.status === 'succeeded'
                ? formatCents(job.actualCostCents)
                : '—',
          },
        ]} />

        {job.errorCode ? (
          <Alert
            type="error"
            showIcon
            title={`${job.errorCode}`}
            description={job.errorMessage ?? '生成失败，可重试。'}
          />
        ) : null}

        {job.status === 'succeeded' ? (
          preview.isLoading ? (
            <Spin size="small" />
          ) : preview.data?.url ? (
            <Space orientation="vertical" size={6} style={{ width: '100%' }}>
              <video
                ref={videoRef}
                controls
                preload="metadata"
                src={preview.data.url}
                onError={handleVideoError}
                onLoadedMetadata={handleLoadedMetadata}
                // 竖屏成片按自然比例能长到上千像素，手机上会把整页顶走：
                // 宽度跟随容器，高度封顶，留黑边由 object-fit 处理
                style={{
                  width: '100%',
                  maxHeight: 320,
                  objectFit: 'contain',
                  borderRadius: 8,
                  background: '#000',
                }}
              />
              <Space size={12} wrap>
                <Button size="small" onClick={() => void handleOpenWindow()}>
                  在新窗口打开
                </Button>
                <Button size="small" onClick={() => void handleDownload()}>
                  下载
                </Button>
                <Typography.Text type="secondary">
                  链接约 {Math.round(preview.data.expiresInSec / 60)} 分钟内有效；过期后播放器会自动换签
                </Typography.Text>
              </Space>
            </Space>
          ) : (
            <Alert
              type="warning"
              showIcon
              title="成片地址获取失败"
              description={
                (preview.error as Error | null)?.message ??
                'OSS 可能未配置，或签名已过期。'
              }
            />
          )
        ) : null}

        {job.status === 'awaiting_review' ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            配音已完成，等待 superadmin 审核分镜；批准前不会调用视频模型。
          </Typography.Text>
        ) : !isTerminal(job.status) ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            生成中会自动刷新；关掉抽屉也不会中断。
          </Typography.Text>
        ) : null}
      </Space>

      <Modal
        open={action !== null}
        title={action === 'retry' ? '重试这支短片' : '取消这支短片'}
        okText={action === 'retry' ? '重试' : '取消作业'}
        cancelText="返回"
        okButtonProps={{
          danger: action === 'cancel',
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
            placeholder={
              action === 'retry'
                ? '例如：上一版画面角色漂移，换 seed 重跑一次'
                : '例如：这一集先不投放短片了'
            }
            maxLength={500}
            showCount
          />
        </Space>
      </Modal>

      <StoryboardReview
        jobId={job.id}
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
      />
    </Card>
  )
}
