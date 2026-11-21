import { Button, Layout, Menu, Typography } from 'antd'
import type { MenuProps } from 'antd'
import {
  ApiOutlined,
  AreaChartOutlined,
  AudioOutlined,
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
import { clearToken } from '../utils/auth-token'
import { useAnalyticsMeta } from '../api/meta'
import EnvTag from '../components/EnvTag'
import { selectedMenuKey } from './menu'

const { Sider, Header, Content } = Layout

/**
 * 菜单按阅读动线分四组：概览与增长 → 用户与内容 → 资产与明细 → 运维与配置。
 * 分组只是视觉分隔（antd Menu 的 group），不加折叠层级、不改路由——
 * 12 项扁平排列时「看数据」和「改线上行为」混在一起，分组后运维配置
 * 天然落在最下面，与它「动手改线上」的性质对齐。
 */
const MENU_ITEMS: MenuProps['items'] = [
  {
    type: 'group',
    label: '概览与增长',
    children: [
      { key: '/overview', label: '总览', icon: <DashboardOutlined /> },
      { key: '/retention', label: '留存与激活', icon: <UsergroupAddOutlined /> },
      { key: '/engagement', label: '使用行为', icon: <AreaChartOutlined /> },
    ],
  },
  {
    type: 'group',
    label: '用户与内容',
    children: [
      { key: '/users', label: '用户画像', icon: <TeamOutlined /> },
      { key: '/memories', label: '记忆档案', icon: <DatabaseOutlined /> },
      { key: '/content', label: '内容与质量', icon: <ReadOutlined /> },
      { key: '/adventure', label: '冒险内容', icon: <CompassOutlined /> },
      { key: '/feedback', label: '用户反馈', icon: <CommentOutlined /> },
    ],
  },
  {
    type: 'group',
    label: '资产与明细',
    children: [
      { key: '/fleet', label: '设备舰队', icon: <RobotOutlined /> },
      { key: '/messages', label: '消息明细', icon: <MessageOutlined /> },
    ],
  },
  {
    type: 'group',
    label: '运维与配置',
    children: [
      { key: '/llm', label: '模型监控', icon: <ApiOutlined /> },
      // 技术监控之后是运维配置：改的是线上模型行为，不是看数据
      { key: '/prompts', label: 'Prompt 管理', icon: <FileTextOutlined /> },
      // 语速与音色：改的是线上设备的发声行为，不是看数据
      { key: '/voice', label: '语速与音色', icon: <AudioOutlined /> },
    ],
  },
]

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  // 环境标签只信服务端 meta：同一份 dist 会部署到三个环境，构建期常量给不出答案。
  // 取不到就是「未知环境」，Prompt 管理页据此 fail-closed 禁用全部写操作。
  const metaQuery = useAnalyticsMeta()
  const meta = metaQuery.data ?? null

  const logout = () => {
    clearToken()
    navigate('/login', { replace: true })
  }

  return (
    <Layout style={{ height: '100vh' }}>
      <Sider theme="dark" width={200} style={{ overflowY: 'auto' }}>
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
          selectedKeys={selectedMenuKey(location.pathname)}
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
        <Content style={{ padding: 24, overflow: 'auto' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
