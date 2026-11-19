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
   ⚠️ 已踩过的坑（2026-11-18，校验时机改造）：`POST /lint` 的 `forPublish`
   **只在请求同时带 `identity` 时才生效**——服务端 `adventure-admin.controller.ts`
   把 forPublish 合并进 identity，只给 `episodeId` 时它改用库里的身份，
   那份身份不带 forPublish，于是这次校验**静默退回草稿标准**（HTTP 200、
   报告长得正常，只是禁用词从 error 变成 warning）。而 `identity` 里
   **不能再嵌** `forPublish`：LintDto 对 identity 开了 forbidNonWhitelisted，
   嵌了直接 400 `identity.property forPublish should not exist`。
   正确形状：`{ episodeId, identity: {characterKey, season, episodeNumber}, content, forPublish }`。
   这类「静默降级」在界面上完全看不出来，只有实机冒烟能抓到。
2. 写路径必须被真实点通。本期的替代验证是把页面挂进 jsdom、打真实的 deda-server
   （authoring profile）跑临时冒烟，覆盖存草稿（含连存两次不被自己的令牌锁死）/
   同事抢先保存后必须 409 并给出两条出路 / 发布 / 快速回滚 / 下架与恢复上架
   （输错业务键不放行）/ 导出 → dry-run 预览 → 手输确认码导入 / 自愈动作 /
   新建与作废（业务键永久占用）/ 只读账号不清 token / 审计流水 /
   **校验时机**（打字过程中一次 `/lint` 都不发；点「校验」恰好发一次且请求带
   identity + forPublish；出结果后再改字，旧结论留在屏幕上并标「已过期」而不是
   凭空消失）/ **发布闸口 fail closed**（有阻断项、校验请求失败、或拿不到发布标准
   结论时「确认发布」必须禁用，填够理由也不放行）。
   起冒烟后端的办法：deda-server 全仓没有 `getOrThrow`，缺配置一律走默认值，
   所以可以在 worktree 里用命令行 env 起一个**完全自带配置、不碰任何真实密钥**的
   隔离实例——`APP_PORT` / `DATABASE_URL`（指向临时冒烟库）/
   `ANALYTICS_JWT_SECRET`（自己编一个一次性的）/ `CONTENT_ADMIN_PROFILE=authoring` /
   `ADVENTURE_LINT_FORBIDDEN_WORDS`。MQTT_URL 不配就不连，不会抢主实例的 client id。
   注意 `npm run test:e2e` 读的是 **`TEST_DATABASE_URL`**，不是 `DATABASE_URL`
   （传错变量会静默跑到共享脏库上，然后在 `analytics-fleet.e2e-spec.ts:215` 假失败）。
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

## PR 正文规范（模板是唯一事实来源）

段落骨架只写在 `.github/PULL_REQUEST_TEMPLATE/` 里，本节只写「何时用哪个」：
base=staging → `feature-to-staging.md`；base=main → `release-to-main.md`。
**两条创建路径，都要显式指名模板**（仓库内有多个模板时 gh 非交互模式不会自动选）：
- agent 自己写正文：`gh pr create --body-file <已按骨架填好的正文>`；
- 人工/交互式创建：`gh pr create --template <file>` 取骨架再填。
`--template` 与 `--body`/`--body-file` 是两条路径，不要同时传。

「需要人工测试的地方」按责任人分子段，**子段清单由模板决定**（本仓 feature 模板是三段：
作者已实测（合并前）／合并到 staging 后需要人工点／上线 prod 后需要人工点（批准 production 之后））。
每项必须带期望结果，勾上的必须带取证；确实无需人工测试 → 写「无」+ 一句理由。
**禁止留空、禁止删段**：空 = 歧义，`无 + 理由` = 可审计。

`ci.yml` 的 `pr-hygiene` job 跑 `.github/scripts/pr-hygiene.mjs`。**段表不写在脚本里，而是从模板
派生**：base → 模板的映射在 `.github/pr-hygiene.json`（`default` 必填，`byBase` 可省略）。派生规则：
模板最浅一级标题 = 必需段；若最浅一级只有 1 个标题且下面还有更深一级（包裹 H2 + H3 的习惯），必需段
取深一级那批、包裹标题不判定；必需段下再深一级 = 该段的必需子段。段落内容含 `<!-- optional -->` →
该段可整段缺席，但写了标题仍须非空。正文侧对层级宽容（H2/H3 都认）。**改模板即改闸口，不需要同步
改脚本段表**；只有改派生规则时才动脚本与 `src/common/pr-hygiene.test.ts`。
闸口 fail-open：`PR_BODY` 未注入、配置／模板读不到或畸形、脚本自身异常，一律 exit 0 并在 stdout 打印
含 `fail-open` 的原因；只有明确缺段／空段才 exit 1。它**不进**分支保护 required checks，但按「CI 全绿
才允许 merge」的纪律，红了就不许合。
`.github/scripts/pr-hygiene.mjs` 是三仓（deda-server / deda-dashboard / deda-wechat-app）**逐字节
相同**的副本：改它必须三仓同改并用 `shasum -a 256` 比对一致；仓库差异只允许落在
`.github/pr-hygiene.json` 与 `PULL_REQUEST_TEMPLATE/` 两处。

PR 有未勾的「合并到 staging 后需要人工点」项时，创建时带 `--label 人工验证`。

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
   | `/login` | `next`（登录意图，见下节） |

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


## 登录意图与 token 存储（2026-11-17）

1. 未登录访问受保护页、或会话中途 401/403 被踢，都必须把原始目标编码进
   `/login?next=`，登录成功后跳回原处——不要再写死 `/overview`。
   读写一律走 `src/router/redirect.ts`：写侧 `buildLoginSearch`（router 内）与
   `buildLoginHref`（整页跳转），读侧 `resolveNextIntent`（内含开放重定向守卫，
   非法值返回 null，由调用方落 `DEFAULT_LANDING`）。
2. 两个入口的 basename 口径**不同**，这是最容易踩的坑：`RequireAuth` 用
   `useLocation().pathname`，不含 `/dashboard`；`src/api/client.ts` 的 401 处理用
   `window.location.pathname`，**含** `/dashboard`，必须经 `stripBase` 换算，
   否则登录成功后拼出 `/dashboard/dashboard/adventure`。
   `stripBase` / `buildLoginHref` 的 base 一律由调用方传 `import.meta.env.BASE_URL`，
   函数内部不读环境变量——vitest 没配 base，测试里 BASE_URL 是 `/`，
   读环境变量就永远覆盖不到真实的剥前缀分支。
3. `next` 只接受站内相对路径。新增任何写 `next` 的地方都必须过 `sanitizeNext`，
   不要把 location 直接拼进 URL：`//evil.com`、`/\evil.com` 这类协议相对地址
   用 `window.location.href` 跳会真的离开本站。
4. token 存取一律走 `src/utils/auth-token.ts`（`getToken` / `setToken` /
   `clearToken`），介质是 **localStorage**。服务端 TTL 是 7 天（deda-server 的
   `ANALYTICS_JWT_EXPIRES_IN`，见该仓 PR #67），而 sessionStorage 的生命周期就是
   标签页会话，兜不住这个口径。不要再直接摸 localStorage / sessionStorage，
   `TOKEN_KEY` 也不再从 `api/client.ts` 导出。
   代价必须记住：XSS 的窃取窗口等于 token 有效期；存储从 per-tab 变成
   per-origin，一个标签页登出、其它标签页的 token 也一并消失（要到下次请求
   吃 401 才感知）。登出必须走 `clearToken()`，只删 token 会把签发时间留下，
   污染下一次登录的兜底计时。
5. 客户端**不**用 token 里的 `exp` 判过期：`exp` 是服务端时钟签的，本地时钟
   偏快几分钟就会把有效 token 判成过期、把人反复登出，且极难排查。过期判定
   交给服务端 401（拦截器会带着当前页跳登录，重新登录后回到原位）；
   `auth-token` 只留一个阈值偏宽（8 天 > 7 天 TTL）的本地兜底，专治服务端
   TTL 被改短后本地残留的僵尸 token。宁可晚清，不可早清。
6. 登录页的已登录守卫**只在 `next` 有效时**才自动跳走；裸访问 `/login`
   一律显示表单，给换账号留入口。token 跨标签页共享之后，少了这个区分，
   另一个标签页登录着就会把换账号的路堵死。
7. 测试打桩：jsdom 31 的 `window.location` 是 `configurable` 的，要断言整页
   跳转目标就用 `Object.defineProperty` 换成 `{ pathname, search, href }` 并在
   `afterEach` 还原（见 `src/api/client.test.ts`）。不要断言
   `window.location.search` 来验证 router 状态——`MemoryRouter` 不同步真实
   地址栏，那样永远是空串。
