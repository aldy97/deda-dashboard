import { Button, Layout, Menu, Typography } from 'antd'
import {
  ApiOutlined,
  AreaChartOutlined,
  CommentOutlined,
  CompassOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  MessageOutlined,
  ReadOutlined,
  RobotOutlined,
  TeamOutlined,
  UsergroupAddOutlined,
} from '@ant-design/icons'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { TOKEN_KEY } from '../api/client'
import { useAnalyticsMeta } from '../api/meta'
import EnvTag from '../components/EnvTag'

const { Sider, Header, Content } = Layout

// 顺序按阅读动线：宏观总览 → 增长 → 画像/记忆 → 内容运营 → 资产 → 明细 → 技术监控。
const MENU_ITEMS = [
  { key: '/overview', label: '总览', icon: <DashboardOutlined /> },
  { key: '/retention', label: '留存与激活', icon: <UsergroupAddOutlined /> },
  { key: '/engagement', label: '使用行为', icon: <AreaChartOutlined /> },
  { key: '/users', label: '用户画像', icon: <TeamOutlined /> },
  { key: '/memories', label: '记忆档案', icon: <DatabaseOutlined /> },
  { key: '/content', label: '内容与质量', icon: <ReadOutlined /> },
  { key: '/adventure', label: '冒险内容', icon: <CompassOutlined /> },
  { key: '/feedback', label: '用户反馈', icon: <CommentOutlined /> },
  { key: '/fleet', label: '设备舰队', icon: <RobotOutlined /> },
  { key: '/messages', label: '消息明细', icon: <MessageOutlined /> },
  { key: '/llm', label: '模型监控', icon: <ApiOutlined /> },
  // 技术监控之后是运维配置：改的是线上模型行为，不是看数据
  { key: '/prompts', label: 'Prompt 管理', icon: <FileTextOutlined /> },
]

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  // 环境标签只信服务端 meta：同一份 dist 会部署到三个环境，构建期常量给不出答案。
  // 取不到就是「未知环境」，Prompt 管理页据此 fail-closed 禁用全部写操作。
  const metaQuery = useAnalyticsMeta()
  const meta = metaQuery.data ?? null

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
            fontSize: 15,
            padding: '16px 12px 12px',
            letterSpacing: 0.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 6,
            // Sider 只有 200px：「未知环境」四个字放不下时换行，不截断
            flexWrap: 'wrap',
          }}
        >
          <span>Deda Dashboard</span>
          <EnvTag
            nodeEnv={meta?.nodeEnv}
            loading={metaQuery.isPending}
            failed={metaQuery.isError}
          />
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[
            // 记忆详情页 /memories/:deviceId 高亮「记忆档案」菜单
            location.pathname.startsWith('/memories')
              ? '/memories'
              : location.pathname,
          ]}
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
