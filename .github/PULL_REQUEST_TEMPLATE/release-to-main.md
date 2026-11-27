---
name: Release → main
about: staging 合入 main 的发布 PR（聚合各 feature 的人工验证项）
---

## 发布 PR（前端看板侧）：`staging` → `main`

> 下面七段一个都不许删（只有 `已知待办` 标了 `<!-- optional -->`，可整段省略）。
> 本行上面这个**包裹标题不参与闸口判定**，措辞随你写；七段写成 H3（本模板的样子）或提级成 H2 都认。

### 本次带入

> 每个 feature PR 一行，**并把它的人工验证项数汇总上来**——release PR 的责任是把多个 feature 的人工验证项聚合给审批人，不是只写自己的。
>
> | feature PR | 标题 | 人工验证项数 |
> | --- | --- | --- |
> | #… | … | 0 |

### prod 实际影响面

> 路由/页面、env（`VITE_` 前缀变量）、prod 特有闸口。

### 验证

> staging 上已取到的证据：CI run 链接与计数、实机冒烟 N/N。

### UI 变更截图

> 本次发布若包含界面变更（页面、抽屉、图表、布局、文案排版），贴 staging 上对应页面的截图，
> 可直接引用各 feature PR 已提供的截图链接；没有界面变更写「无」+ 一句理由。

### 上线后人工验证清单

> 开头必须写明：**合并本 PR 不自动上线，需先在 Actions 批准 production environment**（production 配了 required reviewers，这是实测事实）。
> 每项给可复制粘贴的命令 + 期望输出。

### 回滚

> 本仓 deploy-prod.yml 不含 `failure()` 自动回滚步骤。手动回滚：ssh 到 ECS，
> `mv /opt/deda/dashboard/prod.old /opt/deda/dashboard/prod`（每次部署保留上一版在 prod.old，
> 更早版本已丢失）。静态资源无数据回滚问题，前端看板无需额外数据库操作。

### 改动截图

> 聚合本次发布涉及的 UI 改动截图（逐页/状态），标注路由与视口；无 UI 改动写「无」+ 理由。

### 已知待办（不阻塞发布）

<!-- optional -->

> 没有就写「无」，或整段删掉（本段标了 optional，缺席不判红；写了标题就必须填）。
