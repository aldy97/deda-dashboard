# deda-dashboard 项目指令（数据看板前端）

技术栈：Vite 8 + React 19 + TypeScript + antd 6 + @tanstack/react-query +
axios（src/api/client.ts）+ echarts + react-router 7。Lint：oxlint。

## 联调契约（消费方）

1. 接口契约唯一真相是 deda-server 的实现 + Swagger（/api/docs）+
   MINI_PROGRAM_API.md；跨仓联调口径以 deda-server/docs/integration.md 为准。
   任何接口调用必须能在 MINI_PROGRAM_API.md 中找到，且 payload、response、
   字段类型逐项对齐。
2. 统一响应信封 { code, message, data }，code=0 为成功；
   deviceId 是业务 ID 不是数据库 UUID；时间字段一律 ISO 8601；字段命名 camelCase。
3. 后端请求一律经 src/api/client.ts（apiClient）：自行剥离信封取 data、
   401/403 统一清 token 跳登录。新接口在 src/api/ 下按 analytics.ts /
   queries.ts 的现有模式声明（api 函数 + react-query hooks）。
4. 监控埋点遵循 src/monitor 的现有约定：仅 5xx 与网络层错误上报，
   401/403 与业务 code != 0 不上报。

## 工程规则

5. 构建：npm run build（tsc -b && vite build）必须通过，零 TS 错误；
   提交前跑 npm run lint（oxlint）。
   antd 6 已弃用 Alert 的 message（应改 title），但仓库既有 30+ 处仍用
   message，新代码保持一致；统一迁移另开 PR，不要夹在功能 PR 里。
   其余 antd 6 弃用写法：新代码不要新增 Modal 的 maskClosable（改
   mask={{ closable: false }}）与 Drawer 的 destroyOnClose（改 destroyOnHidden）；
   Drawer 的 width、Space 的 direction 仓库既有代码仍在用，保持一致即可。
   全站没有配 ConfigProvider locale，antd 内置文案默认是英文（Table 列筛选的
   Reset/OK、空态 No data、Pagination 等）；新用到内置文案的组件就地传
   locale 补中文（如 Table 的 locale={{ filterConfirm, filterReset }}），
   不要在功能 PR 里顺手加全局 ConfigProvider。
   antd 两字中文按钮的可访问名会被插空格（「确 定」「取 消」），
   测试里查按钮用 /确\s*定/ 这类正则，不要用全等字符串。
6. TDD 模式为强制要求（见全局铁律第 5 条）：新功能与缺陷修复先补测试再实现。
7. 测试基座已就绪：vitest 5 + jsdom + @testing-library/react（配置见
   vitest.config.ts，全局替身与缺失的浏览器 API 补齐见 src/test/setup.tsx）。
   测试文件与被测文件同目录、命名 *.test.ts(x)；一律显式
   `import { describe, expect, it, vi } from 'vitest'`——globals 刻意关闭，
   因为 tsconfig.app.json 的 types 只有 vite/client，解析不到全局 describe/it。
   新增 dev 依赖前仍必须先征得熊总同意。
   ⚠️ 本机 ~/.npm/_cacache 有 root 属主条目，npm ci / npm install 会 EACCES：
   加 `--cache /tmp/deda-dash-npm-cache` 绕过，禁止用 sudo。
   ⚠️ CI 跑在 UTC、本地是 Asia/Shanghai：断言格式化后的时间**不要硬编码钟点**，
   要么按运行环境算出期望值，要么断言格式正则，否则本地绿、CI 红。
   断言 echarts 图表时：结构读替身渲染出的 data-option（JSON），
   tooltip.formatter 这类函数字段过不了 JSON.stringify，
   改从 src/test/echartsOptions.ts 的活对象注册表取。

## 测试硬性要求

8. 覆盖率口径：只考核**本次新增/改动的文件**，行覆盖率 ≥ 90%；
   既有未测文件不因本次改动被追溯要求。每次变更后跑
   `npm run test:coverage` 并汇报；低于口径的变更不得交付。
   禁止为了达标删断言或加空断言。
   改动既有大文件（如 src/api/analytics.ts、src/api/queries.ts）时，
   文件级百分比会被大量既有未测代码拉低，须用
   `npx vitest run --coverage --coverage.reporter=json` 生成
   coverage-final.json，核对「新增行与未覆盖行零交集」，而不是只看文件级数字。

## 本期豁免：Adventure Studio（2026-11-14，熊总口径）

冒险内容工作台本期**不为界面代码写单测**：第 6 条与第 8 条对下面列出的范围不适用。
依据是熊总本次任务的明确口径「dashboard 先不做测试」，不是本文件的默认规则，
也不构成后续新增页面的先例。

豁免范围：`src/pages/AdventureStudio/**` 全部界面代码，以及 `src/api/adventureAdmin.ts`
与 `src/api/queries.ts` 里 adventure 那一批 hook（均为本特性新增）。
**不**豁免的是 `src/api/client.ts`：它是全站共用文件，改坏会影响每一个页面，
所以按第 6、8 条配了测试（`src/api/client.test.ts`，行覆盖 91.89%）。

已经补的测试（`src/api/client.test.ts` + `src/api/adventureAdmin.test.tsx`，15 例）
守的是本特性风险最高、且回归在界面上完全看不出来的那部分契约：草稿双令牌
（baseVersionId + baseDraftUpdatedAt）必须原样透传、保存后必须采用返回的新令牌、
发布标准校验的 queryKey 必须带双令牌、写成功后必须作废整组 adventure 缓存、
409 的领域码必须挂到 Error 上、内容管理台的 403 不得清 token。
这 15 例做过变异验证：把上述任一契约改坏，对应用例都会红。

没补的部分与理由：`adventureAdmin.ts` 其余读接口（13/49 语句已覆盖）与
queries.ts 里那批 hook 都是 `apiClient.get/post` 的一行包装，没有分支逻辑；
本期口径是 dashboard 不做测试，把预算花在这里性价比低于服务端。
Adventure Studio 的界面代码 0% 覆盖，改由下面第 2 条的实机冒烟兜。

替代验证口径：

1. 契约不得靠猜：字段、枚举、阈值、错误码一律以 deda-server 的实现 +
   该仓 `docs/analytics-api.md`「冒险内容管理（Adventure Studio）」为准，
   前端不重复实现任何校验规则（两套阈值必然漂移）。
2. 写路径必须被真实点通。本期的替代验证是把页面挂进 jsdom、打真实的 deda-server
   （authoring profile）跑临时冒烟，覆盖存草稿（含连存两次不被自己的令牌锁死）/
   同事抢先保存后必须 409 并给出两条出路 / 发布 / 快速回滚 / 下架与恢复上架
   （输错业务键不放行）/ 导出 → dry-run 预览 → 手输确认码导入 / 自愈动作 /
   新建与作废（业务键永久占用）/ 只读账号不清 token / 审计流水。
   临时冒烟文件交付前删除、不进仓库（避免与第 7 条「测试文件与被测文件同目录」
   的约定打架，也避免留下一份没人维护的测试）。
3. 因此 `npm run test:coverage` 的报告里，Adventure Studio 的新增文件会以 0%
   出现，这是预期结果，不算违反第 8 条；核对覆盖率时把这些文件排除后再看数字。
4. 恢复口径：将来给 dashboard 补测试时优先补这一块——它是全站唯一会直接改动
   儿童内容的界面，风险高于任何报表页。

## 子任务验收命令（多代理协作协议第 3 条锚点）

主代理审查子代理产出时，必须亲自运行：
`npm run build`（tsc -b && vite build）零 TS 错误 + `npm run lint`（oxlint）0 error
+ `npm run test`（vitest run）全绿 + `npm run test:coverage` 满足第 8 条口径
（Adventure Studio 按上一节豁免）。


## URL 查询状态契约（跨页下钻，2026-11-15）

全站的可跳转入口与「刷新/分享能还原现场」共用一套 query 契约。唯一读写入口是
`src/utils/url-state.ts`（`useUrlQuery` / `patchParams` / `readParam` /
`readEnumParam` / `readOptionalEnumParam` / `readRangeParams` / `rangePatch`）。
不要在页面里直接 `setSearchParams({ ... })` 整表覆盖——那会把别的模块写进同一条
query 的键抹掉（`/messages` 同时有筛选与抽屉的 `messageId`，`/llm` 同时有 `tab` 与 `scene`）。

1. 写入语义：`patchParams` 只改被点名的键，值为 `null` / `undefined` / `''` 时删键。
   **筛选条件**用 `setQuery(patch, { replace: true })`（连续改筛选不该堆一长串历史）；
   **抽屉与 tab** 用默认的 push（浏览器后退＝关掉抽屉、回到上一个 tab）。
2. 读取语义：枚举型参数（tab / scene / mode）走 `readEnumParam` /
   `readOptionalEnumParam`，非法值**在读取时兜底**，不要写 effect 去「修正」URL
   （`/llm`、`/adventure`、`/feedback` 一律如此）。日期只认 `YYYY-MM-DD`，
   经 `readRangeParams` 校验：单端缺失、格式非法、区间倒挂都算「未设置」。
3. 各页参数如下。新增可跳转入口时，参数名以目标页的常量/filters 模块为准
   （如 `src/pages/Messages/filters.ts`、`src/pages/Llm/scenes.ts`），不要凭记忆拼：

   | 路由 | 查询参数 |
   | --- | --- |
   | `/overview`、`/retention`、`/content`、`/engagement`、`/memories` | 无（只作为出口链接的起点） |
   | `/messages` | `deviceId` `turnId` `messageId`（抽屉）`role` `status` `keyword` `mode` `startDate` `endDate` |
   | `/users/:deviceId` | `messageId`（抽屉） |
   | `/fleet` | `deviceId`（抽屉） |
   | `/memories/:deviceId` | `key` |
   | `/llm` | `tab`=perf\|cost\|safety\|intent；`scene`（仅 perf tab 读） |
   | `/prompts` | `key`（抽屉）`scene`（预筛，可关闭 Tag） |
   | `/feedback` | `tab`=report\|user\|parentReport；`deviceId`（预筛，report 与 user 两个 tab 都吃） |
   | `/adventure` | `tab`=episodes\|transfer\|audit\|recovery；`episodeId`（抽屉） |

4. 跨页下钻必须把上下文一起带过去：跳消息明细要带 `mode` + `startDate`/`endDate`，
   否则从「近 30 天模式分布」落到默认近 7 天，两边数字对不上，看着像数据错了。
5. 权限门控的出口（如「内容与质量 → 冒险内容工作台」）在缺 `adventure-content`
   scope 时渲染**禁用态 + 可见说明文案**，不要隐藏——隐藏会让人以为功能不存在。
   判据是 capabilities 能否读到（服务端 `ContentAdminGuard` 对 capabilities 与
   episodes 用同一个 scope），**不是** `authoring`：`authoring=false` 只表示当前
   环境只读（`CONTENT_ADMIN_PROFILE`），查看入口照常可用。
6. 共享的纯函数与常量不要从组件文件里往外导（oxlint `only-export-components`）：
   放独立模块，例如 `src/layouts/menu.ts`、`src/pages/Messages/filters.ts`、
   `src/components/message/labels.tsx`、`src/pages/Engagement/mode-links.ts`。
7. 设备 360 的正文只有一份：`src/components/device/DeviceProfile.tsx`
   （+ `PresenceCalendar` / `DailyTurnsChart`）。设备舰队页的详情抽屉与用户详情页
   共用它，后端加字段只改这一处；days 控件属于各自容器，不进 DeviceProfile。
