import axios from 'axios'
import type { AxiosError, AxiosResponse } from 'axios'
import { reportApiError } from '../monitor'

/** 与 deda-server 统一响应信封对齐：{ code, message, data }，code=0 为成功 */
export interface ApiEnvelope<T> {
  code: number
  message: string
  data: T
}

export const TOKEN_KEY = 'deda_dashboard_token'

/**
 * 请求失败时抛出的错误。除 message / status 外还带上服务端的领域错误码与附带字段——
 * 内容管理台的响应形如 { code: 409, message: '中文', data: { code: 'DRAFT_CONFLICT',
 * currentDraft: {...} } }，`data.code` 才是给代码看的（见 types/adventureAdmin.ts）。
 * 其余路由出错时 data 为 null，这两个字段保持 undefined，既有行为逐字不变。
 */
export interface ApiError extends Error {
  status?: number
  domainCode?: string
  detail?: Record<string, unknown>
}

/**
 * 这些前缀下的 403 表示「能力不足」（缺 adventure-content scope / 本环境只读），
 * 而不是「登录失效」。若沿用全站行为清 token 跳登录，prod 的作者点一次「存草稿」
 * 就会被踢下线，还会丢掉正在编辑的整集内容。401 仍然照常跳登录。
 */
const CAPABILITY_DENIED_PREFIXES = ['/analytics/adventure-admin']

export const apiClient = axios.create({
  timeout: 15000,
})

apiClient.interceptors.request.use((config) => {
  const token = sessionStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(
  (resp: AxiosResponse) => {
    const envelope = resp.data as ApiEnvelope<unknown> | null
    if (envelope && typeof envelope.code === 'number') {
      if (envelope.code === 0) {
        resp.data = envelope.data
        return resp
      }
      return Promise.reject(new Error(envelope.message || '请求失败'))
    }
    return resp
  },
  (error: AxiosError) => {
    const status = error.response?.status
    const url = error.config?.url
    const data = error.response?.data as ApiEnvelope<unknown> | undefined
    const message =
      data && typeof data.code === 'number' && data.message
        ? data.message
        : error.message
    // 401 未登录/凭据错误；403 token 非 analytics scope —— 均清 token 跳登录。
    // 例外见 CAPABILITY_DENIED_PREFIXES：那里的 403 是能力不足，不是会话失效。
    const capabilityDenied =
      status === 403 &&
      CAPABILITY_DENIED_PREFIXES.some((prefix) => url?.startsWith(prefix))
    if ((status === 401 || status === 403) && !capabilityDenied) {
      sessionStorage.removeItem(TOKEN_KEY)
      if (!window.location.pathname.endsWith('/login')) {
        window.location.href = `${import.meta.env.BASE_URL}login`
      }
    }
    // 仅上报系统级故障：5xx 服务端错误、网络层错误（超时/断网，无 response）。
    // 401/403 与业务 code != 0 属正常流程，不上报。
    if (status === undefined || status >= 500) {
      reportApiError(url ?? 'unknown', status, message)
    }
    const err = new Error(message) as ApiError
    err.status = status
    const payload = data?.data
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      const detail = payload as Record<string, unknown>
      if (typeof detail.code === 'string') {
        err.domainCode = detail.code
      }
      err.detail = detail
    }
    return Promise.reject(err)
  },
)
