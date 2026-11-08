# LLM 监控（模型监控页）后端落地方案与接口约束

> 面向 deda-server 后端实现。dashboard 侧只消费 GET 接口。
> 监控范围：**主模型（deepseek-flash）+ 小模型（qwen-flash）全量调用**，
> 指标含调用量 / 成功率 / 延迟 / token / **首包时间（TTFT，流式调用）**。
> 通用约定：路由前缀 `/analytics/*`，挂 `AnalyticsAuthGuard`；响应信封 `{ code, message, data }`；
> camelCase；ISO 8601；日期 `YYYY-MM-DD` 闭区间 Asia/Shanghai；`deviceId` 对外为业务 ID。

## 一、背景：当前模型调用盘点

所有 LLM 调用收口在 `LlmService.complete()` / `completeStream()`（`src/modules/llm/llm.service.ts`）。

| tier | 模型 | 场景（scene 枚举值） | 调用点 | 说明 |
|---|---|---|---|---|
| small | qwen-flash（DashScope） | `safety_l2` | vendor/child-safety | 语义安全分类，**fail-open** |
| small | 同上 | `intent_classify` | vendor/conversation-session | 对话意图分类 |
| small | 同上 | `filler` | vendor/vendor + llm-adapter | 首响过渡语（流式），失败跳过 |
| small | 同上 | `adventure_interaction` | adventure | 冒险剧情互动反馈 |
| small | 同上 | `memory_extract` | child-memories | 候选记忆抽取 |
| small | 同上 | `sleep_config_extract` | sleep-configs | 哄睡配置字段抽取 |
| main | deepseek-flash | `chat_main` | 主对话链路 | 正式回答（流式） |
| main | 同上 | `parent_report` | learning-stats/parent-report-generator | 家长日报生成 |

**风险特征**：小模型大量场景为静默降级设计（fail-open / 失败跳过 / 解析失败返回 null），
故障不表现为用户报错而表现为质量悄悄下降，必须有指标监控。当前零指标（`quality/llm-usage` 一期恒 501）。

## 二、数据层（新表，与 device_presence_daily 同一批建）

```prisma
// LLM 调用日志（主模型 + 小模型全量）
model LlmUsageLog {
  id               String   @id @default(uuid())
  scene            String   // safety_l2 / intent_classify / filler / adventure_interaction
                            // / memory_extract / sleep_config_extract / chat_main / parent_report
  model            String   // 实际模型名，如 qwen-flash / deepseek-flash
  tier             String   // small / main（冗余字段，查询方便）
  success          Boolean
  failureReason    String?  // timeout / rate_limit / parse_error / upstream_error / empty_response
  latencyMs        Int?     // 请求发出 → 完整响应（流式为末 chunk）的总耗时
  firstTokenMs     Int?     // 首包时间：请求发出 → 首个 chunk；仅流式调用有值，非流式恒 null
  promptTokens     Int?
  completionTokens Int?
  totalTokens      Int?
  deviceId         String?  // FK → devices.id，可空（后台任务无设备上下文）
  createdAt        DateTime @default(now())

  device Device? @relation(fields: [deviceId], references: [id], onDelete: SetNull)

  @@index([createdAt, scene])
  @@index([scene, success, createdAt])
  @@map("llm_usage_logs")
}
```

## 三、埋点方式（单点收口）

在 `LlmService.complete()` 与 `completeStream()` 出入口统一埋点：

1. `LlmCompleteOptions` 新增 **`scene: string` 必填**参数——现有 8 个调用点各自传入场景值；新增调用点编译期强制传值。
2. `latencyMs`：请求开始 → 完整响应结束。
3. **`firstTokenMs`（TTFT）**：仅 `completeStream` 记录——请求开始 → 收到首个 content chunk；`complete()` 恒 null。
4. token 取响应 `usage`（DashScope qwen-flash 流式已验证支持 `stream_options.include_usage`；DeepSeek 网关待复验，拿不到则 null，不影响其他字段）。
5. **埋点写库失败只记日志，绝不影响主链路**（fire-and-forget，try/catch）。
6. `failureReason` 归一化到枚举：timeout / rate_limit / parse_error / upstream_error / empty_response。

## 四、接口契约

### 1. 分场景汇总

```
GET /analytics/llm/summary?startDate=&endDate=
→ { scenes: [{
      scene, tier,
      calls, successRate,                    // 分母 0 时 null
      p50LatencyMs, p90LatencyMs,            // 无数据 null
      p50FirstTokenMs, p90FirstTokenMs,      // 仅流式场景有值，否则 null
      totalTokens,
      failureBreakdown: [{ reason, count }]
    }] }
```

### 2. 趋势

```
GET /analytics/llm/trend?startDate=&endDate=&granularity=day&scene=
→ { granularity,
    series: [{ date, calls, successRate, p50LatencyMs, avgFirstTokenMs, totalTokens }] }
```

- `scene` 缺省 = 全部聚合；非法值 400；无数据日期补零。

### 3. 最近失败明细

```
GET /analytics/llm/recent-failures?page=1&pageSize=20&scene=
→ { total, page, pageSize,
    items: [{ id, scene, tier, model, failureReason, latencyMs, deviceId, createdAt }] }
```

- pageSize 上限 100；按 createdAt 倒序。

## 五、实现约束

1. 全部 GET、只读；非法参数 400（风格同现有 analytics DTO）。
2. fail-open 场景（safety_l2、filler）的成功率必须在 summary 中独立可见——成功率下降意味着防线/体验静默降级，不伴随任何用户侧报错。
3. 首包与延迟分位数在服务端聚合计算（PG `percentile_cont` 或取数内存计算，量级小均可）。
4. 测试：`*.spec.ts` 覆盖埋点（成功/失败/流式 TTFT/null token）、汇总与趋势聚合口径、枚举非法 400；e2e 只打 `TEST_DATABASE_URL`。
5. 老占位接口 `GET /analytics/quality/llm-usage`（一期恒 501）随本批**直接下线**（从未对外 work 过）。
6. 迁移：`prisma migrate` 生成新表 migration；契约同步更新 `docs/analytics-api.md`。

## 六、前端落地方案（deda-dashboard）

新增菜单「模型监控」`/llm`（位于「消息明细」之后），区间控件（默认近 7 天）驱动整页：

1. **场景说明条**：8 个场景的中文名 + 一句话作用（静态文案，帮助读盘）
2. **场景总览表**：每场景一行——tier 标签（小模型/主模型）、调用量、成功率（Progress 条，fail-open 场景带「静默降级」徽标）、延迟 P50/P90、**首包 P50/P90**（非流式场景显示「—」）、总 token、失败 Top1 原因
3. **趋势图**：按日成功率 + 调用量双轴折线，可切场景（含「全部」）；流式场景可叠加首包均值线
4. **最近失败明细表**：服务端分页；失败原因 Tag 着色（timeout 橙 / rate_limit 红 / parse_error 紫 / upstream_error 灰）

文件结构：`src/pages/Llm/index.tsx` + `SceneSummaryTable.tsx` + `LlmTrendChart.tsx` + `RecentFailuresTable.tsx`；类型与 api 函数加入 `src/types/analytics.ts` / `src/api/analytics.ts`（风格同现有页面）。
