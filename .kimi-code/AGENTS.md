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
6. TDD 模式为强制要求（见全局铁律第 5 条）：新功能与缺陷修复先补测试再实现。
7. 注意：本仓库当前未安装任何测试框架（package.json 无 vitest/jest）。
   落地 TDD 前必须先引入测试基座（建议 vitest + @testing-library/react），
   新增 dev 依赖前必须先征得熊总同意。

## 测试硬性要求

8. unit 与 integration 测试合计覆盖率必须 ≥ 90%（测试基座就绪后生效）。
   每次变更后主动跑覆盖率并汇报结果；低于 90% 的变更不得交付。
