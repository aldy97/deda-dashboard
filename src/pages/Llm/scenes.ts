/**
 * LLM 场景静态元数据（与 docs/llm-monitoring-spec.md 的调用点盘点一致）。
 * 后端只下发 scene key，中文名与语义由前端维护。
 */
export interface SceneMeta {
  label: string
  description: string
  /** 流式调用：首包时间（TTFT）有值 */
  streaming: boolean
  /** 静默降级设计：失败不报错但质量下降，需重点盯成功率 */
  failOpen: boolean
}

export const SCENE_META: Record<string, SceneMeta> = {
  chat_main: {
    label: '主对话回答',
    description: '大模型正式回答（流式）',
    streaming: true,
    failOpen: false,
  },
  parent_report: {
    label: '家长日报生成',
    description: '每日报告的 LLM 生成',
    streaming: false,
    failOpen: false,
  },
  filler: {
    label: '首响过渡语',
    description: '大模型首 token 前的缓冲话术（流式）',
    streaming: true,
    failOpen: true,
  },
  safety_l2: {
    label: '安全语义分类',
    description: 'L2 小模型安全审核，补关键词盲区',
    streaming: false,
    failOpen: true,
  },
  intent_classify: {
    label: '意图分类',
    description: '判断是否切换/固化对话模式',
    streaming: false,
    failOpen: false,
  },
  adventure_interaction: {
    label: '冒险剧情互动',
    description: '冒险故事中对孩子回答的即时反馈',
    streaming: false,
    failOpen: false,
  },
  memory_extract: {
    label: '记忆抽取',
    description: '从对话抽取候选儿童记忆',
    streaming: false,
    failOpen: false,
  },
  sleep_config_extract: {
    label: '哄睡配置抽取',
    description: '从家长语音文本抽取哄睡配置字段',
    streaming: false,
    failOpen: false,
  },
}

export function sceneLabel(scene: string): string {
  return SCENE_META[scene]?.label ?? scene
}

/** 失败原因着色（Tag color）与中文名 */
export const FAILURE_REASON_META: Record<string, { label: string; color: string }> = {
  timeout: { label: '超时', color: 'orange' },
  rate_limit: { label: '限流', color: 'red' },
  parse_error: { label: '解析失败', color: 'purple' },
  upstream_error: { label: '上游错误', color: 'default' },
  empty_response: { label: '空响应', color: 'cyan' },
}

export function failureReasonLabel(reason: string | null): string {
  if (!reason) return '未知'
  return FAILURE_REASON_META[reason]?.label ?? reason
}

export const formatMs = (ms: number | null) =>
  ms === null ? '—' : ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms} ms`

export const formatRate = (rate: number | null) =>
  rate === null ? '—' : `${(rate * 100).toFixed(1)}%`
