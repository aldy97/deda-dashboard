import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { modeLabel, roleTag, statusTag } from './labels'

/**
 * 消息标签的翻译契约（mode / role / status）。
 *
 * mode 平级化之后 conversationModeKey 已从服务端契约中消失，modeLabel 只认 mode 一个维度。
 * 这里考核三件事：
 * 1. 七个平级 mode（含本次保留的 english_chat）都有中文名，free_story 现在是真实统计桶；
 * 2. legacy 值仍要能翻译——历史消息行里还躺着 free_chat_casual / daily_adventure 这些旧标签；
 * 3. 服务端新增未知 mode 时原样透出、mode 缺失显示破折号，都不渲染成 undefined。
 *
 * 18 条期望值刻意写成测试内的独立清单，而不是反向断言组件里的 MODE_LABELS 常量
 * 自身（那样等于拿实现比实现）。这份清单是 deda-wechat-app learning-data.ts 的镜像，
 * 改任何一侧都必须同步改这里，测试会红。
 */
const EXPECTED_LABELS: Array<[string, string]> = [
  // 当前会新写入的平级 mode
  ['free_chat', '自由对话'],
  ['english_chat', '英语对话'],
  ['english_story', '英语故事'],
  ['idiom_story', '成语故事'],
  ['sleep_story', '哄睡故事'],
  ['adventure_story', '冒险故事'],
  ['free_story', '自由故事'],
  // 以下为 legacy：仅翻译历史数据，服务端永不新写入
  ['free_chat_casual', '自由闲聊'],
  ['free_chat_roleplay', '角色扮演'],
  ['free_chat_qa', '百科问答'],
  ['daily_adventure', '每日冒险'],
  ['adventure', '每日冒险'],
  ['story', '故事'],
  ['sleep', '哄睡故事'],
  ['bedtime', '哄睡故事'],
  ['music', '音乐'],
  ['device_control', '设备控制'],
  ['unknown', '其他'],
]

describe('modeLabel · 18 条模式标签（与 deda-wechat-app 逐条对齐）', () => {
  it.each(EXPECTED_LABELS)('%s → %s', (mode, label) => {
    expect(modeLabel(mode)).toBe(label)
  })

  it('清单本身就是 18 条，增删 mode 时必须同步改这里', () => {
    expect(EXPECTED_LABELS).toHaveLength(18)
  })
})

describe('modeLabel · 边界', () => {
  it('mode 为 null 或空串显示破折号', () => {
    expect(modeLabel(null)).toBe('—')
    expect(modeLabel('')).toBe('—')
  })

  it('服务端新增未知 mode 时原样透出，不渲染 undefined', () => {
    expect(modeLabel('brand_new_mode')).toBe('brand_new_mode')
  })
})

describe('roleTag · 角色标签', () => {
  it('user → 孩子，assistant → AI', () => {
    render(roleTag('user'))
    expect(screen.getByText('孩子')).toBeTruthy()
    render(roleTag('assistant'))
    expect(screen.getByText('AI')).toBeTruthy()
  })

  it('服务端新增角色时原样透出，不吞掉', () => {
    render(roleTag('system'))
    expect(screen.getByText('system')).toBeTruthy()
  })
})

describe('statusTag · 消息状态标签', () => {
  it('completed / failed / interrupted 三态各有中文标签', () => {
    render(statusTag('completed'))
    expect(screen.getByText('完成')).toBeTruthy()
    render(statusTag('failed'))
    expect(screen.getByText('失败')).toBeTruthy()
    render(statusTag('interrupted'))
    expect(screen.getByText('被打断')).toBeTruthy()
  })

  it('未知状态原样透出，不渲染成空标签', () => {
    render(statusTag('queued'))
    expect(screen.getByText('queued')).toBeTruthy()
  })
})
