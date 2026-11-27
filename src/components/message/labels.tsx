import { Tag } from 'antd'

/**
 * 消息维度的展示标签：mode / role / status。
 *
 * 单独成模块而不是挂在 MessageDetailDrawer 上，是因为消息明细页、消息详情抽屉、
 * 设备档案页的设备 360、使用行为页的模式下钻链接都要用同一套翻译——共享的常量与
 * 函数不该从组件文件里往外导（fast refresh 也要求组件文件只导出组件）。
 */

/** 与 deda-wechat-app learning-data.ts 的 MODE_LABELS 完全一致（唯一映射来源，勿自行增改） */
const MODE_LABELS: Record<string, string> = {
  // 当前会新写入的平级 mode
  free_chat: '自由对话',
  english_chat: '英语对话',
  english_story: '英语故事',
  idiom_story: '成语故事',
  sleep_story: '哄睡故事',
  adventure_story: '冒险故事',
  free_story: '自由故事',
  // 以下均为 legacy：仅用于翻译历史消息行，服务端永不新写入
  free_chat_casual: '自由闲聊',
  free_chat_roleplay: '角色扮演',
  free_chat_qa: '百科问答',
  daily_adventure: '每日冒险',
  adventure: '每日冒险',
  story: '故事',
  sleep: '哄睡故事',
  bedtime: '哄睡故事',
  music: '音乐',
  device_control: '设备控制',
  unknown: '其他',
}

/** mode 平级化后只认 mode 一个维度；未知值原样透出，缺失显示破折号 */
export function modeLabel(mode: string | null): string {
  if (!mode) return '—'
  return MODE_LABELS[mode] ?? mode
}

/** 角色：孩子=蓝 / AI=绿；服务端出现新角色时原样透出，不吞掉 */
export function roleTag(role: string) {
  return role === 'user' ? (
    <Tag color="blue">孩子</Tag>
  ) : role === 'assistant' ? (
    <Tag color="green">AI</Tag>
  ) : (
    <Tag>{role}</Tag>
  )
}

/** 消息状态：完成=绿 / 失败=红 / 被打断=橙（全站统一，含详情抽屉与详情页） */
export function statusTag(status: string) {
  if (status === 'failed') return <Tag color="error">失败</Tag>
  if (status === 'interrupted') return <Tag color="warning">被打断</Tag>
  if (status === 'completed') return <Tag color="success">完成</Tag>
  return <Tag>{status}</Tag>
}
