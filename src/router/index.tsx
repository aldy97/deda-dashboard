import { createBrowserRouter, Navigate } from 'react-router-dom'
import type { ReactElement } from 'react'
import AdminLayout from '../layouts/AdminLayout'
import Login from '../pages/Login'
import Overview from '../pages/Overview'
import PlaceholderPage from '../pages/PlaceholderPage'
import { TOKEN_KEY } from '../api/client'

function RequireAuth({ children }: { children: ReactElement }) {
  const token = sessionStorage.getItem(TOKEN_KEY)
  return token ? children : <Navigate to="/login" replace />
}

export const router = createBrowserRouter(
  [
    { path: '/login', element: <Login /> },
    {
      path: '/',
      element: (
        <RequireAuth>
          <AdminLayout />
        </RequireAuth>
      ),
      children: [
        { index: true, element: <Navigate to="/overview" replace /> },
        { path: 'overview', element: <Overview /> },
        {
          path: 'retention',
          element: (
            <PlaceholderPage
              title="留存与激活"
              description="cohort 留存热力表、D1/D7/D30/D90 留存曲线、激活→首聊→7/30 日留存漏斗。BP 核心页。"
              apis={[
                'GET /analytics/retention/cohorts',
                'GET /analytics/retention/curve',
                'GET /analytics/activation/funnel',
              ]}
            />
          ),
        },
        {
          path: 'engagement',
          element: (
            <PlaceholderPage
              title="使用行为"
              description="使用时长分桶分布（估算口径）、对话轮次、7×24 时段热力、模式分布、哄睡/冒险/习惯功能渗透率。"
              apis={[
                'GET /analytics/engagement/summary',
                'GET /analytics/engagement/duration-distribution',
                'GET /analytics/engagement/hourly-heatmap',
                'GET /analytics/engagement/mode-usage',
                'GET /analytics/engagement/feature-adoption',
              ]}
            />
          ),
        },
        {
          path: 'fleet',
          element: (
            <PlaceholderPage
              title="设备舰队"
              description="开机率趋势、实时在线数、固件版本分布、流失预警池、单设备明细下钻。"
              apis={['二期：依赖 device_presence_daily 落库，契约待定义']}
            />
          ),
        },
        {
          path: 'users',
          element: (
            <PlaceholderPage
              title="用户画像"
              description="家长注册趋势、孩子年龄段/性别分布、IP 型号（elly/polly）分布、家庭绑定结构。聚合数据，不出 PII。"
              apis={[
                'GET /analytics/users/summary',
                'GET /analytics/users/demographics',
              ]}
            />
          ),
        },
        {
          path: 'content',
          element: (
            <PlaceholderPage
              title="内容与质量"
              description="冒险故事完集率、学习数据、家长报告有用率、对话失败率与安全拦截。LLM 单机日成本二期上线。"
              apis={[
                'GET /analytics/content/adventure',
                'GET /analytics/content/learning',
                'GET /analytics/content/parent-report',
                'GET /analytics/quality/conversation',
                'GET /analytics/quality/llm-usage（一期 501，二期上线）',
              ]}
            />
          ),
        },
        { path: '*', element: <Navigate to="/overview" replace /> },
      ],
    },
  ],
  {
    // 生产部署在主域名 /dashboard 路径下（与 deda-server 同域）
    basename: '/dashboard',
  },
)
