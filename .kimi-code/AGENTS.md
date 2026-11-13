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

## 子任务验收命令（多代理协作协议第 3 条锚点）

主代理审查子代理产出时，必须亲自运行：
`npm run build`（tsc -b && vite build）零 TS 错误 + `npm run lint`（oxlint）0 error
+ `npm run test`（vitest run）全绿 + `npm run test:coverage` 满足第 8 条口径。

