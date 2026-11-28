import { useState } from 'react'
import { Button, Drawer, Layout, Modal, Typography } from 'antd'
import { MenuOutlined } from '@ant-design/icons'
import { Outlet, useNavigate } from 'react-router-dom'
import { clearToken } from '../utils/auth-token'
import { useAnalyticsMeta } from '../api/meta'
import { useLayoutMode } from '../utils/use-layout-mode'
import EnvTag from '../components/EnvTag'
import { isSuperAdmin } from '../components/access/role'
import SideNav from './SideNav'

const { Sider, Header, Content } = Layout

/**
 * 壳层三档（断点口径见 utils/use-layout-mode）：
 *
 * - desktop（≥992）：左 240px 侧栏常驻，顶栏放站点说明
 * - tablet（768–991）：侧栏收成 64px 图标栏，菜单项靠图标 + tooltip 识别
 * - mobile（<768）：没有侧栏，顶栏一枚「打开菜单」把导航装进 Drawer；
 *   顶栏只留环境标签与退出登录（站点说明那行字在 375 宽会占满两行）
 *
 * 三档共用同一个 SideNav：菜单项、环境标签、分组顺序只有一份实现。
 * 环境标签在手机上挪到顶栏，是因为抽屉关着时它是「我在哪个环境」的唯一提示。
 */
export default function AdminLayout() {
  const navigate = useNavigate()
  const mode = useLayoutMode()
  const isMobile = mode === 'mobile'
  const isTablet = mode === 'tablet'

  // 环境标签只信服务端 meta：同一份 dist 会部署到三个环境，构建期常量给不出答案。
  // 取不到就是「未知环境」，提示词管理页据此 fail-closed 禁用全部写操作。
  const metaQuery = useAnalyticsMeta()
  const meta = metaQuery.data ?? null
  // meta 还没回来时不下结论：既不加锁标也不放行——OpsGate 自己按 fail-closed 处理。
  const roleKnown = Boolean(meta?.admin)
  const opsLocked = roleKnown && !isSuperAdmin(meta)

  const [navOpen, setNavOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)

  // 触发只负责开弹窗；清 token 放到确认之后，避免误点一下就被踢下线
  const confirmLogout = () => {
    setLogoutOpen(false)
    clearToken()
    navigate('/login', { replace: true })
  }

  const navProps = {
    locked: opsLocked,
    nodeEnv: meta?.nodeEnv,
    metaLoading: metaQuery.isPending,
    metaFailed: metaQuery.isError,
  }

  return (
    <Layout className="app-shell">
      {!isMobile && (
        <Sider
          theme="dark"
          width={240}
          collapsedWidth={64}
          // 平板档没有展开入口：宽度在 992 以下时展开会挤掉正文，
          // 需要完整菜单时用手机档的抽屉反过来不可用，所以这里只做收起
          collapsed={isTablet}
          style={{ overflowY: 'auto' }}
        >
          <SideNav {...navProps} collapsed={isTablet} />
        </Sider>
      )}
      <Layout>
        <Header
          style={{
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: isMobile ? '0 12px' : '0 24px',
            borderBottom: '1px solid #f0f0f0',
            gap: 8,
          }}
        >
          {isMobile ? (
            <>
              <Button
                type="text"
                aria-label="打开菜单"
                icon={<MenuOutlined />}
                onClick={() => setNavOpen(true)}
              />
              <span style={{ flex: 1 }} />
              <EnvTag
                nodeEnv={meta?.nodeEnv}
                loading={metaQuery.isPending}
                failed={metaQuery.isError}
              />
            </>
          ) : (
            <Typography.Text type="secondary">
              儿童 AI 毛绒玩具 · 产品使用分析（内部）
            </Typography.Text>
          )}
          <Button size="small" onClick={() => setLogoutOpen(true)}>
            退出登录
          </Button>
        </Header>
        <Content
          style={{
            padding: isMobile ? 12 : 24,
            overflow: 'auto',
            // 底部留出 iPhone 手势条，避免最后一个卡片被 home indicator 压住
            paddingBottom: isMobile
              ? 'calc(12px + env(safe-area-inset-bottom))'
              : 24,
          }}
        >
          <Outlet />
        </Content>
      </Layout>
      {isMobile && (
        <Drawer
          placement="left"
          width={260}
          open={navOpen}
          onClose={() => setNavOpen(false)}
          closable={false}
          // 关掉即卸载：否则 15 个 menuitem 会留在 DOM 里，读屏重复播报，
          // 测试里的「入口数量」断言也会数出两份
          destroyOnHidden
          styles={{ body: { padding: 0, background: '#001529' } }}
        >
          <SideNav {...navProps} onNavigate={() => setNavOpen(false)} />
        </Drawer>
      )}
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
