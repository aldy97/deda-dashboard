import { createBrowserRouter, Navigate } from 'react-router-dom'
import type { ReactElement } from 'react'
import AdminLayout from '../layouts/AdminLayout'
import Login from '../pages/Login'
import Overview from '../pages/Overview'
import Retention from '../pages/Retention'
import Engagement from '../pages/Engagement'
import Users from '../pages/Users'
import UserDeviceDetail from '../pages/Users/DeviceDetail'
import Content from '../pages/Content'
import AdventureStudio from '../pages/AdventureStudio'
import Messages from '../pages/Messages'
import LlmMonitor from '../pages/Llm'
import Memories from '../pages/Memories'
import MemoryDetail from '../pages/Memories/DeviceDetail'
import Feedback from '../pages/Feedback'
import Fleet from '../pages/Fleet'
import Prompts from '../pages/Prompts'
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
        { path: 'retention', element: <Retention /> },
        { path: 'engagement', element: <Engagement /> },
        { path: 'fleet', element: <Fleet /> },
        { path: 'users', element: <Users /> },
        { path: 'users/:deviceId', element: <UserDeviceDetail /> },
        { path: 'content', element: <Content /> },
        { path: 'adventure', element: <AdventureStudio /> },
        { path: 'feedback', element: <Feedback /> },
        { path: 'messages', element: <Messages /> },
        { path: 'llm', element: <LlmMonitor /> },
        { path: 'prompts', element: <Prompts /> },
        { path: 'memories', element: <Memories /> },
        { path: 'memories/:deviceId', element: <MemoryDetail /> },
        { path: '*', element: <Navigate to="/overview" replace /> },
      ],
    },
  ],
  {
    // 生产部署在主域名 /dashboard 路径下（与 deda-server 同域）
    basename: '/dashboard',
  },
)
