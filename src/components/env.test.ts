import { describe, expect, it } from 'vitest'
import { UNKNOWN_ENV_VIEW, isPromptWritable, resolveEnvTag } from './env'

describe('resolveEnvTag', () => {
  it.each([
    ['development', '本地', 'green', 'local'],
    ['staging', '测试', 'orange', 'staging'],
    ['production', '生产', 'red', 'production'],
  ] as const)('NODE_ENV=%s → %s', (nodeEnv, text, color, tone) => {
    const view = resolveEnvTag(nodeEnv)
    expect(view.text).toBe(text)
    expect(view.color).toBe(color)
    expect(view.tone).toBe(tone)
    expect(view.known).toBe(true)
  })

  it('只有 production 被标记为生产（发布弹窗据此多加一档确认）', () => {
    expect(resolveEnvTag('production').production).toBe(true)
    expect(resolveEnvTag('staging').production).toBe(false)
    expect(resolveEnvTag('development').production).toBe(false)
  })

  it.each([undefined, null, '', 'prod', 'Production', 'dev', 'unknown'])(
    '无法识别的 %p 一律落「未知环境」，不猜',
    (nodeEnv) => {
      const view = resolveEnvTag(nodeEnv)
      expect(view).toEqual(UNKNOWN_ENV_VIEW)
      expect(view.known).toBe(false)
      expect(view.production).toBe(false)
    },
  )
})

describe('isPromptWritable', () => {
  const staging = resolveEnvTag('staging')
  const production = resolveEnvTag('production')

  it('环境认得出来且服务端写开关开着才放开', () => {
    expect(isPromptWritable(staging, true)).toBe(true)
    expect(isPromptWritable(production, true)).toBe(true)
  })

  it('写开关关掉 → 不放开', () => {
    expect(isPromptWritable(staging, false)).toBe(false)
  })

  it('meta 还没到手（undefined）→ 不放开，不能默认开', () => {
    expect(isPromptWritable(staging, undefined)).toBe(false)
  })

  it('fail-closed：环境未知时即便写开关是开的也不放开', () => {
    expect(isPromptWritable(UNKNOWN_ENV_VIEW, true)).toBe(false)
  })
})
