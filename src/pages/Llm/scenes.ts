/**
 * LLM 场景静态元数据（与 docs/llm-monitoring-spec.md 的调用点盘点一致）。
 * 后端只下发 scene key，中文名与语义由前端维护。
 *
 * 分工：这里解释「模型调用健康吗」（scene 枚举，供性能/价格 tab 用）；
 * 「模型的判定可信吗」（safetySource / safetyCategory / intent / intentSource
 * 枚举）在 ./decisions.ts，供安全/意图 tab 用。
 */
export interface SceneMeta {
  label: string
  description: string
  /** 流式调用：首包时间（TTFT）有值 */
  streaming: boolean
  /** 静默降级设计：失败不报错但质量下降，需重点盯成功率 */
  failOpen: boolean
  /** 已下线场景：仅历史区间有数据，UI 需标「历史」 */
  deprecated?: boolean
}

export const SCENE_META: Record<string, SceneMeta> = {
  chat_main: {
    label: '主对话回答',
    description:
      '主对话链路流式生成给孩子的正式回答，是对话体验延迟的主指标。' +
      '流式被提前打断时按已观测部分记账，可能记为失败。',
    streaming: true,
    failOpen: false,
  },
  parent_report: {
    label: '家长日报生成',
    description: '每日定时任务汇总当日使用与学习数据，由模型生成给家长的日报文案。',
    streaming: false,
    failOpen: false,
  },
  filler: {
    label: '首响过渡语（历史）',
    description:
      '2026-11 起 live 链路不再写入，仅历史区间可见。原为确定性模板池的即时过渡语，' +
      '为主回答争取时间；静默降级：失败只跳过、不影响正式回答。' +
      '上游流式未回传 usage，Token 恒为 0。',
    streaming: true,
    failOpen: true,
    deprecated: true,
  },
  safety_l2: {
    label: '安全语义分类',
    description:
      '关键词过滤之后的第二层安全审核：分类模型做语义分类，补关键词盲区。' +
      '静默降级：调用失败时走兜底判定，不阻塞对话。',
    streaming: false,
    failOpen: true,
  },
  intent_classify: {
    label: '意图分类',
    description:
      '判断孩子这句话是否要进入/切换对话模式（自由聊天/冒险/哄睡等）。' +
      '有活跃会话时由规则匹配接管，所以调用量远小于对话轮次。',
    streaming: false,
    failOpen: false,
  },
  adventure_interaction: {
    label: '冒险剧情互动',
    description:
      '冒险故事模式中，对孩子每轮回答的即时剧情反馈（角色人设驱动）；二选一互动点在确定性匹配失败时，同一 scene 还负责判定孩子选了哪个选项（受 ADVENTURE_CHOICE_LLM_ENABLED 控制，默认关）。',
    streaming: false,
    failOpen: false,
  },
  adventure_script_convert: {
    label: '故事稿转换',
    description:
      '冒险内容工作台「从 docx 填充 / 生成草稿」时调用：模型把带标注的中文故事稿转成结构化段落 JSON' +
      '（温度 0.2、关闭思考、maxTokens 8000）。只在 authoring 环境生成预览，不落库、不面向孩子；' +
      '失败会返回 SCRIPT_CONVERT_FAILED 让作者重试。',
    streaming: false,
    failOpen: false,
  },
  adventure_video_storyboard: {
    label: '冒险短视频分镜',
    description:
      '冒险内容工作台生成故事短片时调用：把已发布剧集压成 54–58 秒竖屏分镜 JSON' +
      '（温度 0.4、关闭思考、maxTokens 4000）。校验失败会带着错误原因重试，' +
      '耗尽后作业失败。',
    streaming: false,
    failOpen: false,
  },
  memory_extract: {
    label: '记忆抽取',
    description:
      '每轮孩子发言后异步调用，抽取长期偏好写入记忆档案' +
      '（置信度 <0.75 的候选不入库）。不阻塞主链路，几乎每轮一次。',
    streaming: false,
    failOpen: false,
  },
  sleep_config_extract: {
    label: '哄睡配置抽取',
    description: '从家长语音指令中解析哄睡设置字段（哄睡时间/时长/内容偏好）。',
    streaming: false,
    failOpen: false,
  },
  sleep_story_generate: {
    label: '哄睡故事生成',
    description: '哄睡调度器到点触发，按配置生成睡前故事/儿歌内容。',
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

export const formatMs = (ms: number | null) => {
  if (ms === null) return '—'
  // 后端 percentile_cont 可能返回长小数，统一取整
  const rounded = Math.round(ms)
  return rounded >= 1000 ? `${(rounded / 1000).toFixed(2)} s` : `${rounded} ms`
}

export const formatRate = (rate: number | null) =>
  rate === null ? '—' : `${(rate * 100).toFixed(1)}%`
