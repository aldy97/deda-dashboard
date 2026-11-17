import { useState } from 'react'
import { Alert, Button, Card, Form, Input, Typography } from 'antd'
import { Navigate, useNavigate } from 'react-router-dom'
import { adminLogin } from '../../api/analytics'
import { getToken, setToken } from '../../utils/auth-token'
import { readParam, useUrlQuery } from '../../utils/url-state'
import {
  DEFAULT_LANDING,
  LOGIN_NEXT_PARAM,
  resolveNextIntent,
} from '../../router/redirect'

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
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Card style={{ width: 380 }}>
        <Typography.Title level={4} style={{ marginTop: 0 }}>
          Deda Dashboard
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          内部产品分析平台，管理员账号登录。
        </Typography.Paragraph>
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
            <Input autoComplete="username" />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={submitting}>
            登录
          </Button>
        </Form>
      </Card>
    </div>
  )
}
