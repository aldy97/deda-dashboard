import { createBrowserRouter, Navigate, useLocation } from 'react-router-dom'
import type { ReactElement } from 'react'
import AdminLayout from '../layouts/AdminLayout'
import Login from '../pages/Login'
import Overview from '../pages/Overview'
import Retention from '../pages/Retention'
import Engagement from '../pages/Engagement'
import Users from '../pages/Users'
import UserDeviceDetail from '../pages/Users/DeviceDetail'
import ParentDetail from '../pages/Parents/Detail'
import Content from '../pages/Content'
import AdventureStudio from '../pages/AdventureStudio'
import TestDevices from '../pages/TestDevices'
import Messages from '../pages/Messages'
import LlmMonitor from '../pages/Llm'
import Memories from '../pages/Memories'
import MemoryDetail from '../pages/Memories/DeviceDetail'
import Feedback from '../pages/Feedback'
import Fleet from '../pages/Fleet'
import Prompts from '../pages/Prompts'
import Voice from '../pages/Voice'
import AppAssets from '../pages/AppAssets'
import OpsGate from '../components/access/OpsGate'
import { OPS_ROUTE_META } from '../layouts/menu'
import { getToken } from '../utils/auth-token'
import { DEFAULT_LANDING, buildLoginSearch } from './redirect'

/**
 * 登录闸口。
 *
 * 重定向到登录页时把原始目标编码进 ?next=：否则用户拿着 /adventure 这样的链接
 * 进来，登录成功后只能落回默认页，链接等于白给。useLocation() 给出的 pathname
 * 不含 basename（/dashboard），正好是 navigate() 需要的口径。
 *
 * useLocation 必须无条件调用（React hooks 规则），所以先取再判 token。
 */
function RequireAuth({ children }: { children: ReactElement }) {
  const token = getToken()
  const location = useLocation()
  if (token) return children
  return (
    <Navigate
      to={{
        pathname: '/login',
        search: buildLoginSearch(
          location.pathname,
          location.search,
          location.hash,
        ),
      }}
      replace
    />
  )
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
        { index: true, element: <Navigate to={DEFAULT_LANDING} replace /> },
        { path: 'overview', element: <Overview /> },
        { path: 'retention', element: <Retention /> },
        { path: 'engagement', element: <Engagement /> },
        { path: 'fleet', element: <Fleet /> },
        { path: 'users', element: <Users /> },
        { path: 'users/:deviceId', element: <UserDeviceDetail /> },
        { path: 'parents/:userId', element: <ParentDetail /> },
        { path: 'content', element: <Content /> },
        {
          path: 'adventure',
          element: (
            <OpsGate {...OPS_ROUTE_META['/adventure']}>
              <AdventureStudio />
            </OpsGate>
          ),
        },
        {
          path: 'test-devices',
          element: (
            <OpsGate {...OPS_ROUTE_META['/test-devices']}>
              <TestDevices />
            </OpsGate>
          ),
        },
        { path: 'feedback', element: <Feedback /> },
        { path: 'messages', element: <Messages /> },
        {
          path: 'llm',
          element: (
            <OpsGate {...OPS_ROUTE_META['/llm']}>
              <LlmMonitor />
            </OpsGate>
          ),
        },
        {
          path: 'prompts',
          element: (
            <OpsGate {...OPS_ROUTE_META['/prompts']}>
              <Prompts />
            </OpsGate>
          ),
        },
        {
          path: 'voice',
          element: (
            <OpsGate {...OPS_ROUTE_META['/voice']}>
              <Voice />
            </OpsGate>
          ),
        },
        {
          path: 'app-assets',
          element: (
            <OpsGate {...OPS_ROUTE_META['/app-assets']}>
              <AppAssets />
            </OpsGate>
          ),
        },
        // 旧路径兜底：改名前的书签与 PR 链接仍能落到同一页。
        // 纯重定向不挂载任何页面，不需要雾层。
        { path: 'speech-rate', element: <Navigate to="/voice" replace /> },
        { path: 'memories', element: <Memories /> },
        { path: 'memories/:deviceId', element: <MemoryDetail /> },
        { path: '*', element: <Navigate to={DEFAULT_LANDING} replace /> },
      ],
    },
  ],
  {
    // 生产部署在主域名 /dashboard 路径下（与 deda-server 同域）
    basename: '/dashboard',
  },
)
