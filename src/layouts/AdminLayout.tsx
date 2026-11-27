import { useState } from 'react'
import { Button, Layout, Menu, Modal, Tooltip, Typography } from 'antd'
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
  FileImageOutlined,
  LockOutlined,
  MessageOutlined,
  ReadOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UsergroupAddOutlined,
} from '@ant-design/icons'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { clearToken } from '../utils/auth-token'
import { useAnalyticsMeta } from '../api/meta'
import EnvTag from '../components/EnvTag'
import { isSuperAdmin } from '../components/access/role'
import { selectedMenuKey } from './menu'
import logoHeader from '../assets/logo-header.png'

const { Sider, Header, Content } = Layout

/**
 * 菜单按阅读动线分四组：概览与增长 → 用户与体验 → 资产与明细 → 运维与配置。
 * 分组只是视觉分隔（antd Menu 的 group），不加折叠层级、不改路由。
 *
 * 运维与配置是**全部破坏性操作**的入口（模型监控、冒险内容、提示词管理、语速设置），
 * 只对 superadmin 开放。普通 admin 仍然看得到、点得进——进去后由路由层的 OpsGate
 * 渲染雾与原因；隐藏菜单会让人以为功能不存在，反而来问「为什么没有这个页面」。
 */
function buildMenuItems(locked: boolean): MenuProps['items'] {
  return [
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
      label: '用户与体验',
      children: [
        { key: '/users', label: '用户画像', icon: <TeamOutlined /> },
        { key: '/memories', label: '记忆档案', icon: <DatabaseOutlined /> },
        { key: '/content', label: '内容与质量', icon: <ReadOutlined /> },
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
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          运维与配置
          {locked && (
            <Tooltip title="仅超级管理员可访问">
              <LockOutlined aria-label="仅超级管理员可访问" />
            </Tooltip>
          )}
        </span>
      ),
      children: [
        { key: '/llm', label: '模型监控', icon: <ApiOutlined /> },
        // 冒险内容改的是线上内容快照，性质与下面的配置项相同，不再属于「用户与体验」
        { key: '/adventure', label: '冒险内容', icon: <CompassOutlined /> },
        // 测试设备白名单管冒险测试，必须与冒险内容相邻但不能藏在其中
        {
          key: '/test-devices',
          label: '测试设备白名单',
          icon: <SafetyCertificateOutlined />,
        },
        { key: '/prompts', label: '提示词管理', icon: <FileTextOutlined /> },
        { key: '/voice', label: '语速与音色', icon: <AudioOutlined /> },
        { key: '/app-assets', label: '图片素材', icon: <FileImageOutlined /> },
      ],
    },
  ]
}

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  // 环境标签只信服务端 meta：同一份 dist 会部署到三个环境，构建期常量给不出答案。
  // 取不到就是「未知环境」，提示词管理页据此 fail-closed 禁用全部写操作。
  const metaQuery = useAnalyticsMeta()
  const meta = metaQuery.data ?? null
  // meta 还没回来时不下结论：既不加锁标也不放行——OpsGate 自己按 fail-closed 处理。
  const roleKnown = Boolean(meta?.admin)
  const opsLocked = roleKnown && !isSuperAdmin(meta)

  const [logoutOpen, setLogoutOpen] = useState(false)

  // 触发只负责开弹窗；清 token 放到确认之后，避免误点一下就被踢下线
  const confirmLogout = () => {
    setLogoutOpen(false)
    clearToken()
    navigate('/login', { replace: true })
  }

  return (
    <Layout style={{ height: '100vh' }}>
      <Sider theme="dark" width={240} style={{ overflowY: 'auto' }}>
        <div
          data-testid="brand-header"
          style={{
            // 菜单列超过一屏时 Sider 整体滚动；品牌头 sticky 在顶端，
            // 环境标签必须常驻可见（它是「我在哪个环境」的唯一提示）。
            // 底色必须不透明，否则滚上来的菜单会从底下透出来。
            position: 'sticky',
            top: 0,
            zIndex: 1,
            background: '#001529',
            boxShadow: '0 1px 0 rgba(255, 255, 255, 0.06)',
            color: '#fff',
            fontWeight: 600,
            fontSize: 15,
            padding: '16px 12px 12px',
            letterSpacing: 0.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 6,
            // logo + 标题 + 环境标签必须同一行；实测「生产」标签整行约 230px，
            // 240px 留出字体回退余量，不会把标签挤到第二行
            flexWrap: 'nowrap',
          }}
        >
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              minWidth: 0,
            }}
          >
            <img
              data-testid="brand-logo"
              src={logoHeader}
              alt=""
              aria-hidden="true"
              width={28}
              height={28}
              style={{ display: 'block', flex: '0 0 auto' }}
            />
            <span style={{ whiteSpace: 'nowrap' }}>Deda Dashboard</span>
          </span>
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
          items={buildMenuItems(opsLocked)}
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
          <Button size="small" onClick={() => setLogoutOpen(true)}>
            退出登录
          </Button>
        </Header>
        <Content style={{ padding: 24, overflow: 'auto' }}>
          <Outlet />
        </Content>
      </Layout>
      {logoutOpen && (
        <Modal
          open
          title="退出登录？"
          okText="确认退出"
          cancelText="取消"
          centered
          width={420}
          onOk={confirmLogout}
          onCancel={() => setLogoutOpen(false)}
        >
          退出后需要重新输入管理员账号密码才能继续访问数据看板。
        </Modal>
      )}
    </Layout>
  )
}
