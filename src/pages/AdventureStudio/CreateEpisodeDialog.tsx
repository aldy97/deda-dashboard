import { useState } from 'react'
import { Alert, Form, Input, InputNumber, Select, Space, Typography } from 'antd'
import type { ApiError } from '../../api/client'
import { useCreateAdventureEpisode } from '../../api/queries'
import type {
  CapabilitiesResponse,
  EpisodeContent,
} from '../../types/adventureAdmin'
import ReasonDialog from './ReasonDialog'
import { characterLabel } from './labels'

/**
 * 新建故事集。
 *
 * 熊总的原话是「加一个故事不能只有一个按钮」——新建同样走破坏性确认，理由是
 * **业务键一旦占用就永久占用**：`elly/1/7` 建过一次，就算这一集后来被作废
 * （discard），这个 IP + 季 + 集号也不能再用于新建，因为可能已经有设备的
 * 进度记录指向过它。填错集号的代价不是「改一下」，而是永久烧掉一个集号，
 * 所以这里要求把业务键原样手输一遍。
 *
 * 本期只做 season=1：季号直接取服务端能力清单，不给输入框——能被填错的字段
 * 就不要放出来。新建只落一个空壳草稿（标题 + 可选回顾），段落在工作台里写；
 * 「写到一半」正是草稿的用途，服务端只拦身份级与儿童安全级错误。
 */
interface Props {
  capabilities: CapabilitiesResponse
  onClose: () => void
  onCreated: (episodeId: string) => void
}

export default function CreateEpisodeDialog({
  capabilities,
  onClose,
  onCreated,
}: Props) {
  const [characterKey, setCharacterKey] = useState<string>(
    capabilities.characterKeys[0] ?? 'elly',
  )
  const [episodeNumber, setEpisodeNumber] = useState<number | null>(null)
  const [title, setTitle] = useState('')
  const [recap, setRecap] = useState('')
  const create = useCreateAdventureEpisode()
  const error = (create.error as ApiError | null) ?? null

  const numberValid =
    episodeNumber !== null &&
    Number.isInteger(episodeNumber) &&
    episodeNumber >= 1
  const businessKey = numberValid
    ? `${characterKey}/${capabilities.season}/${episodeNumber}`
    : ''
  // 业务键还没凑齐时不给确认框：先让人把集号填对，再让他为这个键负责
  const confirmText = businessKey === '' ? undefined : businessKey

  const identityIncomplete = businessKey === '' || title.trim() === ''

  function submit(values: { reason: string; confirmText?: string }) {
    if (!numberValid) return
    const content: EpisodeContent = {
      title: title.trim(),
      recap: recap.trim() === '' ? null : recap.trim(),
      segments: [],
    }
    create.mutate(
      {
        identity: {
          characterKey: characterKey as CapabilitiesResponse['characterKeys'][number],
          season: capabilities.season,
          episodeNumber: episodeNumber as number,
        },
        content,
        reason: values.reason,
      },
      {
        onSuccess: (res) => {
          onCreated(res.episodeId)
        },
      },
    )
  }

  return (
    <ReasonDialog
      open
      title="新建故事集"
      okText="创建草稿"
      danger={false}
      confirmText={confirmText}
      confirmLabel="业务键确认"
      pending={create.isPending}
      error={error}
      onCancel={onClose}
      onSubmit={submit}
      description={
        <Space orientation="vertical" size={8} style={{ width: '100%' }}>
          <Typography.Text>
            会创建一集**空壳草稿**（标题 + 可选回顾，段落稍后在工作台里写）。创建不会发布，
            孩子看不到它，直到你显式发布。
          </Typography.Text>
          <Typography.Text type="danger">
            业务键 {characterKey}/{capabilities.season}/集号 一旦占用即**永久占用**：
            即使之后作废这一集，这个集号也不能再用于新建。请确认集号没有填错。
          </Typography.Text>
        </Space>
      }
      extra={
        <Form layout="vertical" size="middle">
          <Space size={12} wrap align="start">
            <Form.Item label="IP 形象" style={{ marginBottom: 8 }}>
              <Select
                style={{ width: 200 }}
                value={characterKey}
                onChange={(value) => setCharacterKey(value)}
                options={capabilities.characterKeys.map((key) => ({
                  value: key,
                  label: `${characterLabel(key)}（${key}）`,
                }))}
              />
            </Form.Item>
            <Form.Item label="季" style={{ marginBottom: 8 }}>
              <Input style={{ width: 100 }} value={`第 ${capabilities.season} 季`} disabled />
            </Form.Item>
            <Form.Item
              label="集号"
              style={{ marginBottom: 8 }}
              required
              help={
                numberValid
                  ? undefined
                  : '从 1 开始的整数。第 N 集必须先发布 1..N-1 集才能发布（PREDECESSOR_NOT_PUBLISHED）。'
              }
            >
              <InputNumber
                style={{ width: 120 }}
                min={1}
                step={1}
                precision={0}
                value={episodeNumber}
                onChange={(value) => setEpisodeNumber(value as number | null)}
                placeholder="例如 7"
              />
            </Form.Item>
          </Space>

          <Form.Item label="标题" required style={{ marginBottom: 8 }}>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={capabilities.lintThresholds.maxTitleChars}
              showCount
              placeholder="孩子听到的这一集名字"
            />
          </Form.Item>

          <Form.Item
            label="开场回顾（可选）"
            style={{ marginBottom: 0 }}
            help="上一集讲了什么，播正文之前先念给孩子听"
          >
            <Input.TextArea
              rows={2}
              value={recap}
              onChange={(event) => setRecap(event.target.value)}
              maxLength={capabilities.lintThresholds.maxNarrationTextChars}
              showCount
            />
          </Form.Item>

          {identityIncomplete && (
            <Alert
              style={{ marginTop: 12 }}
              type="info"
              showIcon
              message="先把集号与标题填完整，确认框才会出现"
            />
          )}
          {error?.domainCode === 'BUSINESS_KEY_TAKEN' && (
            <Alert
              style={{ marginTop: 12 }}
              type="error"
              showIcon
              message="这个业务键已经被占用了"
              description="同 IP、同季、同集号必须唯一。换一个集号；被作废（discard）的集号也算占用，不会释放。"
            />
          )}
        </Form>
      }
    />
  )
}
