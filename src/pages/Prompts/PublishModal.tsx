import { useState } from 'react'
import { Alert, Checkbox, Input, Modal, Space, Tag, Typography } from 'antd'
import type { EnvView } from '../../components/env'
import { CHANGE_NOTE_MAX_CHARS } from '../../api/prompts'
import type { DiffLine } from './diff'
import PromptDiff from './PromptDiff'
import { ACTION_LABEL } from './labels'
import type { PublishActionKind } from './labels'

/**
 * 发布 / 回滚 / 恢复默认共用的确认弹窗。
 *
 * 三个动作都会立即改变线上所有设备的模型行为，所以这个弹窗的唯一职责是让
 * 管理员在按下按钮之前把「我在哪个环境、改了哪几行、为什么改」看清楚：
 *
 * 1. 标题栏恒定红色「重大操作」标记，警示条里复述当前环境名；
 * 2. changeNote 必填（进版本审计链，是事后唯一能看到的动机）；
 * 3. 确认码必须手动逐字输入才解锁按钮——刻意不预填、不缓存、不自动补全，
 *    meta 下发的确认码只用于提示文案；
 * 4. 生产环境再加一档勾选确认；
 * 5. 环境认不出来（meta 请求失败 / 未返回）时 fail-closed，按钮恒禁用。
 *
 * 这不是安全边界：真正的闸口是服务端 assertConfirmCode + AnalyticsAuthGuard。
 *
 * 三个输入都是组件内部状态，**调用方必须按需挂载**（open 时渲染、关闭时卸载，
 * 见 PromptEditor），确认码与改动说明才不会留到下一次打开；组件自身不做
 * 「关闭后清空」的动画回调——那依赖 antd 的关闭动画结束事件，既不可测也不可靠。
 */

export interface PublishSubmitInput {
  changeNote: string
  confirmCode: string
}

export interface PublishModalProps {
  open: boolean
  action: PublishActionKind
  env: EnvView
  /** meta 下发的确认码，仅用于提示文案，禁止预填输入框 */
  confirmCodeHint: string
  /** 操作目标，如「persona_elly · 草稿 r3」 */
  target: string
  /** 一句话说清后果，显示在红色警示条里 */
  consequence: string
  diff?: DiffLine[] | null
  submitting?: boolean
  errorText?: string | null
  onCancel: () => void
  onSubmit: (input: PublishSubmitInput) => void
}

export default function PublishModal({
  open,
  action,
  env,
  confirmCodeHint,
  target,
  consequence,
  diff,
  submitting = false,
  errorText = null,
  onCancel,
  onSubmit,
}: PublishModalProps) {
  const [changeNote, setChangeNote] = useState('')
  const [confirmCode, setConfirmCode] = useState('')
  const [productionAck, setProductionAck] = useState(false)

  const label = ACTION_LABEL[action]
  const noteOk = changeNote.trim().length > 0
  const codeOk = confirmCode.length > 0 && confirmCode === confirmCodeHint
  const productionOk = !env.production || productionAck
  const canSubmit = env.known && noteOk && codeOk && productionOk && !submitting

  return (
    <Modal
      open={open}
      title={
        <Space size={8}>
          <Tag color="red" style={{ fontWeight: 700, marginInlineEnd: 0 }}>
            重大操作
          </Tag>
          <span>{label}</span>
          <Typography.Text code style={{ fontSize: 12 }}>
            {target}
          </Typography.Text>
        </Space>
      }
      okText={label}
      cancelText="取消"
      // 危险动作：确认键用 danger 红色，避免被当成普通「保存」顺手点掉
      okButtonProps={{ danger: true, disabled: !canSubmit }}
      confirmLoading={submitting}
      onCancel={onCancel}
      onOk={() => onSubmit({ changeNote: changeNote.trim(), confirmCode })}
      width={720}
      // antd 6 用 mask 对象取代 maskClosable：点遮罩不许关掉这个弹窗
      mask={{ closable: false }}
      keyboard={false}
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Alert
          type="error"
          showIcon
          message={`你正在【${env.production ? '生产' : env.text}】环境${label}`}
          description={
            <span>
              {consequence}
              <br />
              目标：<Typography.Text strong>{target}</Typography.Text>
              {env.production && (
                <>
                  <br />
                  提交后立即对所有线上设备生效，没有灰度、没有自动撤回；
                  改错只能再做一次回滚。
                </>
              )}
            </span>
          }
        />

        {!env.known && (
          <Alert
            type="warning"
            showIcon
            message="无法确认当前环境，已禁用提交"
            description="取不到 /analytics/meta。请刷新页面或重新登录后再操作；确认环境之前不允许改动 prompt。"
          />
        )}

        {env.production && (
          <Checkbox
            checked={productionAck}
            onChange={(e) => setProductionAck(e.target.checked)}
          >
            <Typography.Text strong>
              我确认这是生产环境，改动将立即对所有设备生效
            </Typography.Text>
          </Checkbox>
        )}

        {diff && diff.length > 0 && (
          <div>
            <Typography.Text strong>正文变更预览</Typography.Text>
            <PromptDiff lines={diff} />
          </div>
        )}

        <div>
          <Typography.Text strong>
            改动说明（必填，写入版本审计链，≤{CHANGE_NOTE_MAX_CHARS} 字）
          </Typography.Text>
          <Input.TextArea
            value={changeNote}
            onChange={(e) => setChangeNote(e.target.value)}
            rows={2}
            maxLength={CHANGE_NOTE_MAX_CHARS}
            showCount
            placeholder="为什么改？改了什么？出问题时怎么判断要不要回滚？"
            aria-label="改动说明"
          />
        </div>

        <div>
          <Typography.Text strong>
            请输入 <Typography.Text code>{confirmCodeHint}</Typography.Text>{' '}
            以确认（必须手动逐字输入，不会预填）
          </Typography.Text>
          <Input
            value={confirmCode}
            onChange={(e) => setConfirmCode(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            name="prompt-publish-confirm-code"
            placeholder={confirmCodeHint}
            aria-label="确认码"
          />
          {confirmCode.length > 0 && !codeOk && (
            <Typography.Text type="danger" style={{ fontSize: 12 }}>
              确认码不匹配
            </Typography.Text>
          )}
        </div>

        {errorText && (
          <Alert type="error" showIcon message="操作失败" description={errorText} />
        )}
      </Space>
    </Modal>
  )
}
