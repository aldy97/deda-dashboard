# 监控（ARMS 前端监控）

dashboard 通过 `alife-logger` 接入阿里云 ARMS 前端监控，封装在 `src/monitor/index.ts`。

## 工作原理

- `main.tsx` 在渲染前调用 `initMonitor()`，读取 `import.meta.env.VITE_ARMS_PID`；
- **pid 为空时整体 no-op**（本地开发、CI、未配置环境变量的部署都不会产生上报）；
- JS 错误、API 请求成功率、页面性能由 SDK 自动采集；
- SPA 路由 PV：SDK 自带的 `enableSPA` 只监听 hashchange，本项目是 history 路由，
  因此封装层劫持 `pushState` / `replaceState` / `popstate`，路由变化时 `setPage(pathname)` 重报 PV；
- API 系统级故障（5xx、网络超时/断网）由 `src/api/client.ts` 拦截器额外上报为自定义错误；
  401/403 与业务 `code != 0` 不上报。

## 安全约束

- **登录接口已排除**：`/analytics/auth/login` 是 GET，密码在 query string，
  已通过 `ignore.ignoreApis: [/auth\/login/]` 排除，严禁移除该配置；
- **sourcemap 不上服务器**：构建产物生成 `.map`（`sourcemap: 'hidden'`）供反解混淆堆栈，
  但本仓库是 public 的，deploy workflow 打包时用 `--exclude='*.map'` 排除，
  map 文件以 GitHub Actions artifact 形式保留 30 天，需要时手动上传 ARMS 控制台。

## 环境配置（GitHub）

staging / production 各对应一个 ARMS「前端监控」Web 应用（建议命名
`deda-dashboard-staging` / `deda-dashboard-prod`），pid 不落代码：

仓库 Settings → Environments → 对应 environment → Variables 新增：

| 变量 | 值 |
|---|---|
| `VITE_ARMS_PID` | ARMS 控制台创建站点后生成的 pid |

改完变量无需改代码，下一次部署自动生效。

## 告警

在 ARMS 控制台为两个站点分别配置告警规则（建议：JS 错误率、API 失败率突增），
通知方式接钉钉群，静默期 ≥ 10 分钟防止告警风暴。
