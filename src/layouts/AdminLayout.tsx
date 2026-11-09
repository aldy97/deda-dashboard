import { Button, Layout, Menu, Typography } from 'antd'
import {
  ApiOutlined,
  AreaChartOutlined,
  CommentOutlined,
  DashboardOutlined,
  MessageOutlined,
  ReadOutlined,
  RobotOutlined,
  TeamOutlined,
  UsergroupAddOutlined,
} from '@ant-design/icons'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { TOKEN_KEY } from '../api/client'

const { Sider, Header, Content } = Layout

// 顺序按阅读动线：宏观总览 → 增长 → 画像 → 内容运营 → 资产 → 明细 → 技术监控。
// 「记忆档案」（/memories，DatabaseOutlined）在 feature/memories-page 分支，
// 合并后插到「用户画像」之后。
const MENU_ITEMS = [
  { key: '/overview', label: '总览', icon: <DashboardOutlined /> },
  { key: '/retention', label: '留存与激活', icon: <UsergroupAddOutlined /> },
  { key: '/engagement', label: '使用行为', icon: <AreaChartOutlined /> },
  { key: '/users', label: '用户画像', icon: <TeamOutlined /> },
  { key: '/content', label: '内容与质量', icon: <ReadOutlined /> },
  { key: '/feedback', label: '用户反馈', icon: <CommentOutlined /> },
  { key: '/fleet', label: '设备舰队', icon: <RobotOutlined /> },
  { key: '/messages', label: '消息明细', icon: <MessageOutlined /> },
  { key: '/llm', label: '模型监控', icon: <ApiOutlined /> },
]

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()

  const logout = () => {
    sessionStorage.removeItem(TOKEN_KEY)
    navigate('/login', { replace: true })
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="dark" width={200}>
        <div
          style={{
            color: '#fff',
            fontWeight: 600,
            fontSize: 16,
            padding: '18px 20px',
            letterSpacing: 0.5,
          }}
        >
          Deda Dashboard
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={MENU_ITEMS}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <Typography.Text type="secondary">
            儿童 AI 毛绒玩具 · 产品使用分析（内部）
          </Typography.Text>
          <Button size="small" onClick={logout}>
            退出登录
          </Button>
        </Header>
        <Content style={{ padding: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
