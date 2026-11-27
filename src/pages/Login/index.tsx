import { useState } from 'react'
import { Alert, Button, ConfigProvider, Form, Input } from 'antd'
import {
  LineChartOutlined,
  LockOutlined,
  RobotOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Navigate, useNavigate } from 'react-router-dom'
import { adminLogin } from '../../api/analytics'
import { getToken, setToken } from '../../utils/auth-token'
import { readParam, useUrlQuery } from '../../utils/url-state'
import {
  DEFAULT_LANDING,
  LOGIN_NEXT_PARAM,
  resolveNextIntent,
} from '../../router/redirect'
import logoHeader from '../../assets/logo-header.png'
import './login.css'

export default function Login() {
  const navigate = useNavigate()
  const { searchParams } = useUrlQuery()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  /**
   * 未登录访问受保护页、或会话中途过期被踢时，闸口会把原始目标编码进 ?next=。
   * 读参数走 url-state 的 readParam（纯空白算未设置），与全站 query 契约一致。
   *
   * base 传进来是为了容忍地址栏里手粘的完整路径（/dashboard/adventure）；
   * router 内的 location 本来就不含 basename，剥前缀对它是无操作。
   */
  const intent = resolveNextIntent(
    readParam(searchParams, LOGIN_NEXT_PARAM),
    import.meta.env.BASE_URL,
  )

  const onFinish = async (values: { username: string; password: string }) => {
    setSubmitting(true)
    setError(null)
    try {
      const { token } = await adminLogin(values.username, values.password)
      // setToken 必须在 navigate 之前：RequireAuth 在渲染期同步读 token，
      // 顺序反了会「跳过去又被弹回登录页」。
      setToken(token)
      navigate(intent ?? DEFAULT_LANDING, { replace: true })
    } catch (err) {
      // 失败时不动 URL：next 留在地址栏里，第二次输对密码才回得到原页面。
      const status = (err as { status?: number } | null)?.status
      setError(
        status === 401
          ? '用户名或密码错误'
          : err instanceof Error
            ? err.message
            : '登录失败，请稍后重试',
      )
    } finally {
      setSubmitting(false)
    }
  }

  /**
   * 已登录且带着有效意图 = 是被闸口重定向过来的，直接送回原页面，
   * 不必让人对着表单再登一次。
   *
   * 裸访问 /login（intent 为 null）刻意**不**跳：那多半是想换账号的人，
   * 表单必须照常显示。token 现在存 localStorage 是跨标签页共享的，
   * 没有这个区分，另一个标签页登录着就会把换账号的路堵死。
   */
  if (getToken() && intent) return <Navigate to={intent} replace />

  return (
    /**
     * 只给登录页局部改主题：品牌蓝比全站默认蓝更贴近侧栏 logo，
     * 不动 App.tsx 的全局 ConfigProvider（那是全站视觉，另开 PR 再谈）。
     */
    <ConfigProvider
      theme={{ token: { colorPrimary: '#2f5d8a', borderRadius: 8 } }}
    >
      <div className="login-page">
        {/* 桌面端品牌区；<960px 时整块隐藏，由下面的移动端顶部条接管 */}
        <aside className="login-brand" aria-label="Deda Dashboard">
          <span
            className="login-brand-glow login-brand-glow-pink"
            aria-hidden="true"
          />
          <span
            className="login-brand-glow login-brand-glow-coral"
            aria-hidden="true"
          />

          <div className="login-brand-head">
            <span className="login-logo-badge">
              <img
                data-testid="login-brand-logo"
                src={logoHeader}
                alt=""
                aria-hidden="true"
                width={40}
                height={40}
              />
            </span>
            <span className="login-wordmark">Deda Dashboard</span>
          </div>

          <div className="login-brand-body">
            <p className="login-slogan-title">儿童 AI 毛绒玩具</p>
            <p className="login-slogan-sub">产品使用分析平台</p>
            <ul className="login-features">
              <li>
                <LineChartOutlined aria-hidden="true" />
                产品数据总览
              </li>
              <li>
                <TeamOutlined aria-hidden="true" />
                用户与对话洞察
              </li>
              <li>
                <RobotOutlined aria-hidden="true" />
                设备与内容运营
              </li>
            </ul>
          </div>

          <p className="login-brand-foot">内部系统 · 仅限授权管理员访问</p>
        </aside>

        {/* 移动端顶部条：sticky 在顶端，表单在下面滚动 */}
        <div className="login-mobile-brand">
          <img src={logoHeader} alt="" aria-hidden="true" width={28} height={28} />
          <span>Deda Dashboard</span>
        </div>

        <main className="login-form-panel">
          <div className="login-form-inner">
            <h1 className="login-title">欢迎回来</h1>
            <p className="login-subtitle">登录以继续访问 Deda Dashboard</p>

            {error && (
              <Alert
                type="error"
                message={error}
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}

            <Form layout="vertical" onFinish={onFinish}>
              <Form.Item
                name="username"
                label="用户名"
                rules={[{ required: true, message: '请输入用户名' }]}
              >
                <Input
                  size="large"
                  prefix={<UserOutlined aria-hidden="true" />}
                  autoComplete="username"
                  placeholder="请输入用户名"
                  autoFocus
                />
              </Form.Item>
              <Form.Item
                name="password"
                label="密码"
                rules={[{ required: true, message: '请输入密码' }]}
              >
                <Input.Password
                  size="large"
                  prefix={<LockOutlined aria-hidden="true" />}
                  autoComplete="current-password"
                  placeholder="请输入密码"
                />
              </Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                block
                loading={submitting}
                className="login-submit"
              >
                登录
              </Button>
            </Form>

            <p className="login-hint">遇到登录问题请联系系统管理员</p>
          </div>
        </main>
      </div>
    </ConfigProvider>
  )
}
