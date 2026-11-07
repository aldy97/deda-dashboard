# deda-dashboard

儿童 AI 毛绒玩具 · 内部产品使用分析平台（React 19 + TypeScript + Vite 8）。

服务两个场景：**内部分析**（产品/运营日常）与**资本对接**（截图进 BP）。

## 技术栈

- React 19 + TypeScript + Vite 8
- react-router v7：路由与登录守卫（`basename: /dashboard`）
- axios：请求封装（统一信封 `{ code, message, data }` 解包、401 全局跳登录）
- antd v6：组件（专业简洁的内部系统风格）
- echarts + echarts-for-react：图表（留存热力表、时段热力图等，随页面接入启用）

## 目录结构

```
src/
├── api/          # 请求封装与按域接口函数（client.ts 信封/401 处理；analytics.ts 接口）
├── types/        # 与后端契约对齐的类型（analytics.ts）
├── layouts/      # AdminLayout：侧边栏 + 顶栏
├── pages/        # overview / retention / engagement / fleet / users / content
└── router/       # 路由表与登录守卫
```

## 接口契约

唯一真相：deda-server 仓库 `docs/analytics-api.md`（实现：`src/modules/analytics/`，路由前缀 `/analytics/*`）。

- 所有接口均为 **GET**；日期参数 `YYYY-MM-DD`、闭区间、Asia/Shanghai
- 时长类字段为估算口径（每条 user 消息 × 0.5 分钟），UI 固定标注「估算口径」
- fleet 组接口为二期（依赖 `device_presence_daily` 落库）；`/analytics/quality/llm-usage` 一期返回 501
- 字段命名 camelCase，时间为 ISO 8601

## 页面与接口对应

| 页面 | 路由 | 接口 |
|------|------|------|
| 登录 | `/login` | `GET /analytics/auth/login` |
| 总览 | `/overview` | `GET /analytics/overview` `/overview/trend` |
| 留存与激活 | `/retention` | `GET /analytics/retention/cohorts` `/retention/curve` `/activation/funnel` |
| 使用行为 | `/engagement` | `GET /analytics/engagement/*`（5 个） |
| 设备舰队 | `/fleet` | 二期，契约待定义 |
| 用户画像 | `/users` | `GET /analytics/users/summary` `/users/demographics` |
| 内容与质量 | `/content` | `GET /analytics/content/*` `/quality/*` |

## 开发

```bash
npm install
npm run dev      # 默认 5173，访问 http://localhost:5173/dashboard/；/analytics 由 Vite proxy 转发到 http://127.0.0.1:3000
npm run build    # tsc -b && vite build
```

## 部署

部署在主域名 **`/dashboard`** 路径下，与 deda-server 同域：nginx 将 `/dashboard` 指向本项目静态产物（`base: /dashboard/`），`/analytics` 反代后端，不改后端 CORS。

## 协作约定

- commit / push 仅在熊总显式指令后执行。
- 前端只按 `docs/analytics-api.md` 契约对齐，不发明字段；契约疑问回 deda-server 确认。
