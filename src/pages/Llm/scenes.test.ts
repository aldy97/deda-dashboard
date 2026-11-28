import { describe, expect, it } from 'vitest'
import {
  SCENE_META,
  failureReasonLabel,
  formatMs,
  formatRate,
  sceneLabel,
} from './scenes'

describe('LLM 场景元数据', () => {
  it('adventure_script_convert 有中文名，且不是流式 / 静默降级场景', () => {
    expect(sceneLabel('adventure_script_convert')).toBe('故事稿转换')

    const meta = SCENE_META.adventure_script_convert
    expect(meta).toBeDefined()
    expect(meta.streaming).toBe(false)
    expect(meta.failOpen).toBe(false)
    expect(meta.description).toContain('docx')
    expect(meta.description).toContain('SCRIPT_CONVERT_FAILED')
  })

  it('adventure_video_storyboard 有中文名，且不是流式 / 静默降级场景', () => {
    expect(sceneLabel('adventure_video_storyboard')).toBe('冒险短视频分镜')

    const meta = SCENE_META.adventure_video_storyboard
    expect(meta).toBeDefined()
    expect(meta.streaming).toBe(false)
    expect(meta.failOpen).toBe(false)
    expect(meta.description).toContain('分镜')
  })

  it('未知场景回落原始 key，不凭空翻译', () => {
    expect(sceneLabel('new_scene_key')).toBe('new_scene_key')
    expect(SCENE_META.new_scene_key).toBeUndefined()
  })
})

describe('失败原因与格式化', () => {
  it('已知失败原因翻译成中文，未知原因与空值回落', () => {
    expect(failureReasonLabel('timeout')).toBe('超时')
    expect(failureReasonLabel('rate_limit')).toBe('限流')
    expect(failureReasonLabel('some_new_reason')).toBe('some_new_reason')
    expect(failureReasonLabel(null)).toBe('未知')
  })

  it('formatMs 对 null 显示破折号，毫秒取整，超过 1 秒改用秒', () => {
    expect(formatMs(null)).toBe('—')
    expect(formatMs(12.4)).toBe('12 ms')
    expect(formatMs(1234)).toBe('1.23 s')
  })

  it('formatRate 对 null 显示破折号，其余保留一位小数百分比', () => {
    expect(formatRate(null)).toBe('—')
    expect(formatRate(0.9876)).toBe('98.8%')
  })
})
