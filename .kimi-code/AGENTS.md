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
6. TDD 模式为强制要求（见全局铁律第 5 条）：新功能与缺陷修复先补测试再实现。
7. 测试基座已就绪：vitest 5 + jsdom + @testing-library/react（配置见
   vitest.config.ts，全局替身与缺失的浏览器 API 补齐见 src/test/setup.tsx）。
   测试文件与被测文件同目录、命名 *.test.ts(x)；一律显式
   `import { describe, expect, it, vi } from 'vitest'`——globals 刻意关闭，
   因为 tsconfig.app.json 的 types 只有 vite/client，解析不到全局 describe/it。
   新增 dev 依赖前仍必须先征得熊总同意。
   ⚠️ 本机 ~/.npm/_cacache 有 root 属主条目，npm ci / npm install 会 EACCES：
   加 `--cache /tmp/deda-dash-npm-cache` 绕过，禁止用 sudo。
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

