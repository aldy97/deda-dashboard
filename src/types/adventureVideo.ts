/**
 * 冒险短视频（60 秒预告）接口类型。
 *
 * 与 deda-server 的 `adventure-video.controller.ts` 逐项对齐：
 * 金额一律分（cent），前端只在展示时除 100；时间一律 ISO 8601 字符串。
 */

export type VideoJobStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'canceled'

export type VideoJobStage =
  | 'queued'
  | 'storyboard'
  | 'voice'
  | 'visual'
  | 'assemble'
  | 'upload'
  | 'done'
  | 'canceled'

export type VideoTtsMode = 'system' | 'cloned'

export interface VideoCapabilities {
  enabled: boolean
  ttsMode: VideoTtsMode
  aspect: string
  resolution: string
  durationSec: number
  budgetCny: number
  voicesReady: boolean
  voiceRoles: string[]
}

export interface VideoJobSummary {
  id: string
  episodeId: string
  episodeVersionId: string
  businessKey: string
  contentHash: string
  kind: string
  status: VideoJobStatus
  stage: VideoJobStage
  aspect: string
  resolution: string
  renderer: string
  ttsMode: VideoTtsMode
  voiceSetVersion: string
  estimatedCostCents: number
  actualCostCents: number
  errorCode: string | null
  errorMessage: string | null
  attempts: number
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
  finalObjectKey: string | null
  finalDurationSec: number | null
}

export interface VideoShot {
  id: string
  order: number
  durationSec: number
  startSec: number
  endSec: number
  status: string
  attempts: number
  errorCode: string | null
  errorMessage: string | null
}

export interface VideoAsset {
  id: string
  kind: string
  objectKey: string
  bytes: number
  durationSec: number | null
  createdAt: string
}

export interface VideoJobDetail extends Omit<VideoJobSummary, 'finalObjectKey' | 'finalDurationSec'> {
  storyboard: unknown
  shots: VideoShot[]
  assets: VideoAsset[]
}

export interface VideoJobListResponse {
  items: VideoJobSummary[]
}

export interface VideoPreviewUrl {
  url: string
  expiresInSec: number
}

export interface CreateVideoJobPayload {
  episodeId: string
  episodeVersionId: string
  requestId: string
  resolution?: string
  reason: string
}

/** 列表价（元/秒），仅用于弹窗预估；账单以百炼为准。 */
export const VIDEO_YUAN_PER_SECOND: Record<string, number> = {
  '480P': 0.3,
  '720P': 0.6,
  '1080P': 1.2,
}

export function isTerminal(status: VideoJobStatus): boolean {
  return status === 'succeeded' || status === 'failed' || status === 'canceled'
}

export function formatCents(cents: number): string {
  return `${(cents / 100).toFixed(2)} 元`
}

/** requestId 只允许 8–64 位字母/数字/下划线/短横线；这里生成一次、整次弹窗复用。 */
export function newRequestId(): string {
  return `video-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
