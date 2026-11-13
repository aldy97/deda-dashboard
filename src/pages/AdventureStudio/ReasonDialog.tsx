import { useState } from 'react'
import type { ReactNode } from 'react'
import { Alert, Input, Modal, Space, Typography } from 'antd'
import type { ApiError } from '../../api/client'
import type { EpisodeImpact } from '../../types/adventureAdmin'
import ImpactPanel from './ImpactPanel'

/**
 * 所有写操作共用的「先说清楚再动手」弹窗。
 *
 * 熊总的要求是：加一个故事集不能只有一个按钮，要有 GitHub 删库那样的破坏性确认。
 * 落地成三件强制的事，且**由服务端而不是前端强制**（前端只做提前提示，
 * 让人不必提交一次才知道理由太短）：
 *
 * 1. 理由 ≥ 8 字。审计的意义在于半年后还能看懂，「改一下」等于没写。
 * 2. 破坏性动作额外要求原样输入确认文本（业务键 / 导入确认码）。
 *    这里**刻意不提供复制按钮**——摩擦本身就是目的，能一键复制的确认等于没有确认。
 * 3. 影响面数字摆在正文里。「下架很安全」只有把「今日在播 N 台不受影响、
 *    跨天挂起 M 台会被收走」并排写出来才可被核对。
 *
 * 服务端拒绝后错误留在弹窗内显示、**不关弹窗**：关掉等于让人白填一遍理由，
 * 而理由往往是最难写的那部分。
 */

/** 与 deda-server 的 MIN_REASON_CHARS / MAX_REASON_CHARS 对齐。服务端才是权威，
 *  这里只用于让人在提交前就知道字数不够（否则要等一次 400 REASON_REQUIRED）。 */
const MIN_REASON_CHARS = 8
const MAX_REASON_CHARS = 300

interface Props {
  open: boolean
  title: string
  /** 这一步到底会发生什么。破坏性动作必须写清楚哪一部分不可逆 */
  description: ReactNode
  /** 需要原样输入才能提交；不传则只要求理由 */
  confirmText?: string
  confirmLabel?: string
  /** 破坏性动作把影响面数字摆在正文里 */
  impact?: EpisodeImpact | null
  impactVariant?: 'retire' | 'publish' | 'info'
  okText: string
  danger?: boolean
  pending?: boolean
  error?: ApiError | null
  /** 附加正文，放在错误之上（例如草稿冲突时的「加载对方版本 / 覆盖我的改动」） */
  extra?: ReactNode
  onCancel: () => void
  onSubmit: (values: { reason: string; confirmText?: string }) => void
}

export default function ReasonDialog({
  open,
  title,
  description,
  confirmText,
  confirmLabel,
  impact,
  impactVariant = 'info',
  okText,
  danger = false,
  pending = false,
  error = null,
  extra,
  onCancel,
  onSubmit,
}: Props) {
  const [reason, setReason] = useState('')
  const [typed, setTyped] = useState('')

  const trimmed = reason.trim()
  const reasonTooShort = trimmed.length < MIN_REASON_CHARS
  const reasonTooLong = trimmed.length > MAX_REASON_CHARS
  const confirmMismatch = confirmText !== undefined && typed.trim() !== confirmText
  const ready = !reasonTooShort && !reasonTooLong && !confirmMismatch

  return (
    <Modal
      open={open}
      title={title}
      okText={okText}
      cancelText="取消"
      width={680}
      maskClosable={false}
      okButtonProps={{ danger, disabled: !ready, loading: pending }}
      // 关弹窗时清空输入：下一次动作的理由必须是重新想的，不能沿用上一次
      onCancel={() => {
        setReason('')
        setTyped('')
        onCancel()
      }}
      onOk={() => {
        if (!ready) return
        onSubmit({
          reason: trimmed,
          confirmText: confirmText === undefined ? undefined : typed.trim(),
        })
      }}
    >
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          {description}
        </Typography.Paragraph>

        {impact && <ImpactPanel impact={impact} variant={impactVariant} />}

        {extra}

        {error && (
          <Alert
            type="error"
            showIcon
            message="服务端拒绝了这次操作"
            description={
              <Space orientation="vertical" size={4}>
                <Typography.Text>{error.message}</Typography.Text>
                {error.domainCode && (
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    错误码 <Typography.Text code>{error.domainCode}</Typography.Text>
                    {error.status ? ` · HTTP ${error.status}` : ''}
                  </Typography.Text>
                )}
              </Space>
            }
          />
        )}

        <div>
          <Typography.Text strong style={{ fontSize: 13 }}>
            变更理由（必填，至少 {MIN_REASON_CHARS} 个字）
          </Typography.Text>
          <Input.TextArea
            rows={3}
            maxLength={MAX_REASON_CHARS}
            showCount
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="半年后别人（包括你自己）只能靠这条审计看懂当时为什么这么改"
            style={{ marginTop: 6 }}
          />
          {reasonTooShort && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              还差 {MIN_REASON_CHARS - trimmed.length} 个字
            </Typography.Text>
          )}
        </div>

        {confirmText !== undefined && (
          <div>
            <Typography.Text strong style={{ fontSize: 13 }}>
              {confirmLabel ?? '确认'}：请原样输入{' '}
              <Typography.Text code>{confirmText}</Typography.Text>
            </Typography.Text>
            <Input
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              placeholder={confirmText}
              autoComplete="off"
              status={typed.length > 0 && confirmMismatch ? 'error' : undefined}
              style={{ marginTop: 6 }}
            />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              不提供复制按钮：手输一遍就是这一步的全部意义。
            </Typography.Text>
          </div>
        )}
      </Space>
    </Modal>
  )
}
