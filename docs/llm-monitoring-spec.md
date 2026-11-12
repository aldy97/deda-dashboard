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
  failureDetail    String?  // 失败细节紧凑串（如 "ECONNRESET: socket hang up"），≤200 字符；存量数据为 null
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
    items: [{ id, scene, tier, model, failureReason, failureDetail, latencyMs, deviceId, createdAt }] }
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

## 七、费用口径

### 7.1 接口

```
GET /analytics/llm/cost-daily?startDate=&endDate=
→ { currency: "CNY",
    pricing: { version, peakNote, lines: [{ model, band, kind, tierLabel, label, cnyPerMillionTokens }] },
    range: { startDate, endDate, requestedStartDate, requestedEndDate, clamped, days },
    sources: {
      aliyun: { status, kind, latestBillDate, latestFetchedAt, modelSplit, daysWithData, message },
      deepseek: { status, kind, pricingVersion, rows, pricedRows, cacheHitRows, upperBoundRows, cacheTokenAvailable }
    },
    series: [{ date, smallCny, mainCny, otherCny, totalCny, smallTokens, mainTokens,
               smallCnyPerMillionTokens, mainCnyPerMillionTokens, smallSource, mainSource,
               mainAccuracy, settled }],
    totals: { smallCny, mainCny, otherCny, totalCny, partial, days, unpricedRows, noTokenRows, unpricedTokens },
    month: { cycle, daysInCycle, daysWithData, toDateCny, toDateSmallCny, toDateMainCny,
             projectedEndCny, prevSamePeriodCny, deltaPct },
    unitEconomics: [{ model, tier, source, cny, tokens, pricedTokens, cnyPerMillionTokens,
                      tokenActiveDevices, daysWithData, cnyPerDevicePerDay, unpricedRows, noTokenRows }],
    reconciliation: { status, days, smallEstimatedCny, smallBilledCny, deltaPct }
  }
```

### 7.2 数据源与口径

| 维度 | 小模型（qwen-flash） | 主模型（deepseek-flash） |
|---|---|---|
| 数据源 | 阿里云 BSS 账单，落库表 `llm_cost_daily`（由 `BillingSyncService` 每 6h 幂等补拉 T-1~T-3） | `llm_usage_logs` 埋点，按写库时的定价快照（`costMicroCny`）逐行估算 |
| 精度 | 账单日 `settled=true` 时为真值；`settled=false` 为暂估 | 始终估算（无账单真值），精度字段 `mainAccuracy` 分 exact / upper_bound / mixed |
| 延迟 | 账单延迟 ≤24h 出账（实例信息 48h）；**终账**在次月 3 日 12 点后可查，当月数据不作对账依据 | 即时，埋点写入后立即可查询 |

#### 逐日「合计」的缺源口径（重要，容易踩）

后端逐日装配 `totalCny = smallMicro + otherMicro + mainMicro`，其中**缺账单日的 `smallMicro` 取 0**
（`deda-server/src/modules/analytics/llm-cost.service.ts` 的逐日装配段）。因此「当日有埋点、账单还没出」时：
`smallCny` 如实为 `null`（页面显示「—」），而 `totalCny` 是一个**只含主模型的实数** —— 合计与分项不自洽，
且从数字本身看不出缺源。账单同步只补拉 T-1~T-3，**最近 1–3 天必然处于该状态**，不是边角情况。

`totals.partial` 只覆盖区间级（区间内有任一账单行即为 `false`），救不了逐日。前端统一用
`src/pages/Llm/cost-series.ts` 的 `dayTotalPartial()` 判定（图B / 明细表共用一份，勿各写一遍）：

```ts
totalCny !== null && (smallCny === null || (mainCny === null && mainTokens > 0))
```

`mainTokens === 0` 表示当天确实没有主模型调用，**不算缺源**。落地表现：

- 明细表「合计 ¥」列在缺源日加 warning 色 `*`，列头 InfoTip 解释，表尾统计缺源天数；
- 图B 累计折线在缺源日与 `totalCny === null` 日**断开**（`connectNulls: false`），既不平推前值也不补 0
  （平推前值等于宣称「当日花费 0」）；代价是断点之后的累计值偏低（不含未知日），已在图B InfoTip 声明；
- 图B tooltip 追加 `dayTotalMissing()` 的说明，如「合计不含小模型（当日账单未出）」。

### 7.3 定价模型

- 后端 `OfficialPriceLine` 结构：`{ model, band, kind, tierLabel, label, cnyPerMillionTokens }`
- `band`：peak / off_peak / null；`kind`：input_miss / input_hit / output
- 定价版本号在 `pricing.version`，**前端不硬编码价格，也不硬编码档位标签**：图 C 的参考线值与
  qwen-flash 的 `tierLabel` 一律从 `pricing.lines` 推导（后端按 `QWEN_FLASH_TIERS` 升序 push，
  取 `model==='qwen-flash' && band===null` 的第一条即最低档）。写死 `'0-128k'` 之类字面量的话，
  后端一改档位格式，参考线会静默消失（`filter` 返回空数组，不报错）
- 图 C 只画 `input_miss` 与 `output` 两种 kind（日单价是输入/输出混合值，`input_hit` 单独画无对照意义）；
  主模型取 `off_peak` 一档作量级锚点，`label` 里已带「空闲」字样

### 7.4 对账逻辑

- 只对小模型（有账单真值）做估算 vs 账单对账，且**只比 `settled=true` 的账单日**
- `reconciliation.status === 'ok'`：有已终账账单日，`smallEstimatedCny` vs `smallBilledCny` 计算 `deltaPct`
- `deltaPct > 15%` 时前端 Alert 提示排查
- `deltaPct === null` 表示账单真值为 0 无法计算偏差
- `status === 'insufficient'`：尚无已终账账单日，无法对账

### 7.5 月末预测与账期解耦

- `month.projectedEndCny`：本月至今**有数据天数**（`daysWithData`）的日均 run-rate 外推至月末
- `month.deltaPct`：与上月同期的变化（上月 1 日至同一日）；上月同期无数据时为 `null`
- **`month` 块固定跟随「昨日所在账期」（后端 `cycle = 昨日.slice(0,7)`），与请求区间解耦。**
  用户用历史预设选「上月」时，曲线画的是上月、`month` 说的仍是本月 —— 所以图B 的 markLine label
  必须带账期：`月末预测（{month.cycle}）¥X`，否则张冠李戴
- `toDateCny` / `toDateSmallCny` / `toDateMainCny` / `prevSamePeriodCny` **均可为 null**，
  后端逐字段按「该账期内是否存在该数据源」判定：无账单行 → 小模型 null；无已计价主模型行 →
  主模型 null；两者都无 → 全部 null。**此时卡片必须显示「—」，绝不显示 ¥0.0000**
  （拿不到数据 ≠ 花了 0 元）。反之「有数据源但金额为 0」（如全额被代金券抵扣）仍须显示 ¥0.0000
- `month.partial`：账期内缺账单或缺主模型埋点 → true，卡片⑤ 打 Tag「不完整」+ InfoTip。
  它的窗口是**账期**，`totals.partial` 的窗口是**请求区间**，两者可能不一致且都是对的，
  InfoTip 里要写明各自窗口，否则看起来像自相矛盾
- `cacheTokenAvailable` 有个坑：它的语义是「区间内是否有行拿到缓存命中数」，`pricedRows===0` 时
  必然为 false。卡片② **必须先判 `pricedRows > 0`** 再打「估算·含上界」，否则会给一个不存在的
  估算打标；`pricedRows===0` 时应打「未计价」，并说明历史行需跑 `scripts/backfill-llm-cost.ts`
- 当月账单为暂估值（未终账），UI 标注 InfoTip 说明

### 7.6 前端组件

| 组件 | 文件 | 说明 |
|---|---|---|
| CostCards | `src/pages/Llm/CostCards.tsx` | 5 张指标卡片：区间合计、主模型、小模型、单设备日均、本月。缺源一律显式占位：`unconfigured`→「未接入账单」、`no_data`→「暂无账单」、`totals.partial`→「合计不完整」、`month.partial`→「不完整」、`modelSplit=false`→「账号合计」、`pricedRows===0`→「未计价」、`pricedRows>0` 且 `mainAccuracy` 含 upper_bound/mixed→「估算·含上界」 |
| CostByModelChart | `src/pages/Llm/CostByModelChart.tsx` | 图A：小模型（实线，账单）/主模型（虚线，估算）/其他每日费用折线；`settled===false` 区间用 markArea 标「暂估」；`otherCny` 全为 0/null 时不画第三条 |
| CostTotalChart | `src/pages/Llm/CostTotalChart.tsx` | 图B：每日总费用 + 累计面积（缺源日断开，见 7.2）+ 月末预测 markLine（label 带账期） |
| CostUnitPriceChart | `src/pages/Llm/CostUnitPriceChart.tsx` | 图C：百万 token 单价趋势 + 定价参考线（值与档位均从 `pricing.lines` 推导） |
| CostDailyTable | `src/pages/Llm/CostDailyTable.tsx` | 每日明细表（日期默认倒序）+ 对账条；缺源日合计带 `*`，表尾统计缺源天数 / 未计价行 / 无 token 行 |
| cost-series.ts | `src/pages/Llm/cost-series.ts` | `dayTotalPartial()` / `dayTotalMissing()`：逐日合计缺源判定的唯一口径 |
| cost-format.ts | `src/pages/Llm/cost-format.ts` | 金额格式化：null→—，≥1 元 2 位小数，<1 元 4 位小数，负数保留负号（退款/调账） |

费用区块在模型监控页顶部、「分场景汇总」之上，有独立日期区间控件（`AnalyticsRangePicker` 的
`excludeToday`，默认近 30 天历史口径、终点＝昨日）与独立 Spin / 错误 Alert。
**它刻意不套页面级 `<Spin spinning={loading}>`** —— 否则主区间加载时费用区块会被一起蒙遮罩、转两个圈。

通用铁律：金额 `null` 一律显示「—」，折线 `connectNulls: false`，**任何情况下不得把缺数据当 0**；
y 轴不设 `min: 0`（退款/调账为负数）。
