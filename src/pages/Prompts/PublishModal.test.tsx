import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UNKNOWN_ENV_VIEW, resolveEnvTag } from '../../components/env'
import PublishModal from './PublishModal'
import { ACTION_LABEL } from './labels'
import { diffLines } from './diff'

const STAGING = resolveEnvTag('staging')
const PRODUCTION = resolveEnvTag('production')
const CODE = 'DEDA2025'

function setup(overrides: Partial<Parameters<typeof PublishModal>[0]> = {}) {
  const onSubmit = vi.fn()
  const onCancel = vi.fn()
  render(
    <PublishModal
      open
      action="publish"
      env={STAGING}
      confirmCodeHint={CODE}
      target="persona_elly · 草稿 r3"
      consequence="发布后所有设备的下一轮对话就会用新正文。"
      onSubmit={onSubmit}
      onCancel={onCancel}
      {...overrides}
    />,
  )
  return { onSubmit, onCancel }
}

function okButton(name = ACTION_LABEL.publish) {
  // confirmLoading 时 antd 的 loading 图标带 aria-label，会混进可访问名，故用正则
  return screen.getByRole('button', { name: new RegExp(name) })
}

async function fillNote(text = '收紧人设自称') {
  await userEvent.type(screen.getByLabelText('改动说明'), text)
}

async function fillCode(text = CODE) {
  await userEvent.type(screen.getByLabelText('确认码'), text)
}

describe('PublishModal 重大操作标记', () => {
  it.each([
    ['publish', '发布草稿'],
    ['rollback', '回滚到历史版本'],
    ['reset', '恢复代码默认值'],
  ] as const)('%s 的标题、确认键文案都是「%s」', (action, label) => {
    setup({ action })

    expect(screen.getByText('重大操作')).toBeInTheDocument()
    expect(okButton(label)).toBeInTheDocument()
    expect(okButton(label)).toBeDisabled()
  })

  it('警示条复述环境名，让管理员在按按钮前再确认一次自己在哪', () => {
    setup({ env: STAGING })
    expect(screen.getByText(/你正在【测试】环境发布草稿/)).toBeInTheDocument()

    setup({ env: PRODUCTION, action: 'rollback' })
    expect(
      screen.getByText(/你正在【生产】环境回滚到历史版本/),
    ).toBeInTheDocument()
  })

  it('目标与后果都显示出来', () => {
    setup()

    expect(screen.getAllByText('persona_elly · 草稿 r3').length).toBeGreaterThan(0)
    // Alert 的 description 里后果文案与「目标：」同处一个 span，只能按子串匹配
    expect(
      screen.getByText(/发布后所有设备的下一轮对话就会用新正文/),
    ).toBeInTheDocument()
  })
})

describe('PublishModal 解锁条件', () => {
  it('确认码输入框初始为空，只用 placeholder 提示，绝不预填', () => {
    setup()

    const input = screen.getByLabelText('确认码') as HTMLInputElement
    expect(input.value).toBe('')
    expect(input.placeholder).toBe(CODE)
    expect(input.autocomplete).toBe('off')
  })

  it('只填确认码不够：改动说明必填', async () => {
    setup()
    await fillCode()

    expect(okButton()).toBeDisabled()
  })

  it('只填改动说明不够：确认码必须手动输入', async () => {
    setup()
    await fillNote()

    expect(okButton()).toBeDisabled()
  })

  it('两者齐了才解锁，提交时改动说明去首尾空白', async () => {
    const { onSubmit } = setup()
    await fillNote('  收紧自称  ')
    await fillCode()

    const button = okButton()
    expect(button).toBeEnabled()
    await userEvent.click(button)

    expect(onSubmit).toHaveBeenCalledWith({
      changeNote: '收紧自称',
      confirmCode: CODE,
    })
  })

  it.each([CODE.toLowerCase(), ` ${CODE}`, `${CODE} `, 'DEDA2026'])(
    '确认码 %p 不容错：大小写/空格/错字一律不解锁并提示不匹配',
    async (wrong) => {
      setup()
      await fillNote()
      await fillCode(wrong)

      expect(okButton()).toBeDisabled()
      expect(screen.getByText('确认码不匹配')).toBeInTheDocument()
    },
  )

  it('改动说明只有空白字符不算填了', async () => {
    setup()
    await fillNote('   ')
    await fillCode()

    expect(okButton()).toBeDisabled()
  })

  it('submitting 时按钮禁用，避免重复提交', async () => {
    setup({ submitting: true })
    await fillNote()
    await fillCode()

    expect(okButton()).toBeDisabled()
  })
})

describe('PublishModal 生产环境加一档', () => {
  it('非生产环境不出现生产确认勾选', () => {
    setup({ env: STAGING })

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('生产环境未勾选时，即使确认码与说明都填了也不解锁', async () => {
    setup({ env: PRODUCTION })
    await fillNote()
    await fillCode()

    expect(okButton()).toBeDisabled()
    expect(
      screen.getByText('我确认这是生产环境，改动将立即对所有设备生效'),
    ).toBeInTheDocument()
  })

  it('勾选后即可提交', async () => {
    const { onSubmit } = setup({ env: PRODUCTION })
    await fillNote('紧急修复')
    await fillCode()
    await userEvent.click(screen.getByRole('checkbox'))

    await userEvent.click(okButton())
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('取消勾选立刻重新锁死', async () => {
    setup({ env: PRODUCTION })
    await fillNote()
    await fillCode()
    const checkbox = screen.getByRole('checkbox')
    await userEvent.click(checkbox)
    expect(okButton()).toBeEnabled()

    await userEvent.click(checkbox)
    expect(okButton()).toBeDisabled()
  })
})

describe('PublishModal fail-closed', () => {
  it('环境未知时恒禁用，并说明原因', async () => {
    setup({ env: UNKNOWN_ENV_VIEW })
    await fillNote()
    await fillCode()

    expect(okButton()).toBeDisabled()
    expect(
      screen.getByText('无法确认当前环境，已禁用提交'),
    ).toBeInTheDocument()
  })

  it('环境未知时不显示生产勾选（不知道是不是生产，就不假装知道）', () => {
    setup({ env: UNKNOWN_ENV_VIEW })

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
})

describe('PublishModal 变更预览与错误', () => {
  it('传了 diff 就渲染逐行对比', () => {
    setup({ diff: diffLines('你是小象 Elly。', '你是小象 Elly！') })

    expect(screen.getByTestId('prompt-diff')).toBeInTheDocument()
    expect(screen.getByTestId('diff-stat')).toHaveTextContent('+1 行 / -1 行')
  })

  it('没传 diff（如恢复默认）时不渲染空的对比块', () => {
    setup({ action: 'reset', diff: null })

    expect(screen.queryByTestId('prompt-diff')).not.toBeInTheDocument()
  })

  it('服务端报错原样展示，弹窗不自动关闭', () => {
    setup({ errorText: '确认码不正确，操作已取消。请对照弹窗提示重新手动输入。' })

    expect(screen.getByText('操作失败')).toBeInTheDocument()
    expect(screen.getByText(/重新手动输入/)).toBeInTheDocument()
  })

  it('点取消回调 onCancel，不触发提交', async () => {
    const { onSubmit, onCancel } = setup()

    await userEvent.click(screen.getByRole('button', { name: /取\s*消/ }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
