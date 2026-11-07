import axios from 'axios'
import type { AxiosError, AxiosResponse } from 'axios'

/** 与 deda-server 统一响应信封对齐：{ code, message, data }，code=0 为成功 */
export interface ApiEnvelope<T> {
  code: number
  message: string
  data: T
}

export const TOKEN_KEY = 'deda_dashboard_token'

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
    const data = error.response?.data as ApiEnvelope<unknown> | undefined
    const message =
      data && typeof data.code === 'number' && data.message
        ? data.message
        : error.message
    // 401 未登录/凭据错误；403 token 非 analytics scope —— 均清 token 跳登录
    if (status === 401 || status === 403) {
      sessionStorage.removeItem(TOKEN_KEY)
      if (!window.location.pathname.endsWith('/login')) {
        window.location.href = `${import.meta.env.BASE_URL}login`
      }
    }
    const err = new Error(message) as Error & { status?: number }
    err.status = status
    return Promise.reject(err)
  },
)
