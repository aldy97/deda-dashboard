import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { apiClient, TOKEN_KEY } from './client'
import type { ApiError } from './client'

/**
 * apiClient 拦截器的契约守卫。
 *
 * 这两条都是内容管理台能正常工作的前提，而且都改在**全站共用**的文件上，
 * 回归的代价比看上去大得多：
 *
 * 1. 拒绝时错误上必须挂 domainCode / detail。领域码在信封的 data.code 里，
 *    写侧靠它区分 409 DRAFT_CONFLICT（要就地给「加载对方版本 / 覆盖我的改动」
 *    两条出路）与其它失败（只显示消息）。丢掉它就只能去匹配中文文案，而文案会改。
 * 2. /analytics/adventure-admin 下的 403 是「能力不足」（缺 scope / 本环境只读），
 *    不是「登录失效」。沿用全站行为清 token 跳登录，prod 的作者点一次「存草稿」
 *    就会被踢下线，还会丢掉正在编辑的整集内容。401 仍须照常跳登录。
 *
 * 用自定义 adapter 造出真实的 AxiosError 走完整拦截器链，不去手戳
 * interceptors.handlers——那是 axios 的内部结构，升级就会碎。
 */

vi.mock('../monitor', () => ({ reportApiError: vi.fn() }))

const originalAdapter = apiClient.defaults.adapter

function respond(data: unknown, status = 200) {
  apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) =>
    ({
      data,
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      headers: {},
      config,
    }) as AxiosResponse
}

function rejectWith(data: unknown, status: number) {
  apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    const response = {
      data,
      status,
      statusText: 'Error',
      headers: {},
      config,
    } as AxiosResponse
    throw new axios.AxiosError(
      `Request failed with status code ${status}`,
      'ERR_BAD_REQUEST',
      config,
      null,
      response,
    )
  }
}

async function catchError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise
  } catch (error) {
    return error as ApiError
  }
  throw new Error('预期这次请求会失败，但它成功了')
}

describe('apiClient 拦截器', () => {
  beforeEach(() => {
    sessionStorage.clear()
    // 停在 /login 之外，好让「跳登录」这条分支真的会被走到
    window.history.pushState({}, '', '/')
  })

  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter
    sessionStorage.clear()
    window.history.pushState({}, '', '/')
  })

  it('code=0 时剥掉信封，只把 data 交出去', async () => {
    respond({ code: 0, message: 'success', data: { authoring: true } })
    const resp = await apiClient.get('/analytics/adventure-admin/capabilities')
    expect(resp.data).toEqual({ authoring: true })
  })

  it('没有信封的响应原样返回，不猜结构', async () => {
    respond({ anything: 1 })
    const resp = await apiClient.get('/healthz')
    expect(resp.data).toEqual({ anything: 1 })
  })

  it('409 把领域码与 detail 挂到 Error 上，且不动 token', async () => {
    sessionStorage.setItem(TOKEN_KEY, 'tk')
    rejectWith(
      {
        code: 409,
        message: '这一集的草稿已经被别人改过',
        data: { code: 'DRAFT_CONFLICT', currentDraft: { version: 11 } },
      },
      409,
    )

    const error = await catchError(
      apiClient.post('/analytics/adventure-admin/episodes/e1/draft', {}),
    )

    expect(error.message).toBe('这一集的草稿已经被别人改过')
    expect(error.status).toBe(409)
    expect(error.domainCode).toBe('DRAFT_CONFLICT')
    // detail 要整份留着：写侧从里面取 currentDraft 渲染「对方是谁、什么时候改的」
    expect(error.detail).toEqual({
      code: 'DRAFT_CONFLICT',
      currentDraft: { version: 11 },
    })
    expect(sessionStorage.getItem(TOKEN_KEY)).toBe('tk')
  })

  it('普通路由出错时 data 为 null，domainCode 与 detail 保持 undefined', async () => {
    rejectWith({ code: 400, message: '参数不对', data: null }, 400)

    const error = await catchError(apiClient.get('/analytics/overview'))

    expect(error.message).toBe('参数不对')
    expect(error.status).toBe(400)
    expect(error.domainCode).toBeUndefined()
    expect(error.detail).toBeUndefined()
  })

  it('内容管理台的 403 是能力不足：不清 token、不跳登录', async () => {
    sessionStorage.setItem(TOKEN_KEY, 'tk')
    rejectWith(
      { code: 403, message: '本环境是只读的', data: { code: 'CONTENT_READ_ONLY' } },
      403,
    )

    const error = await catchError(
      apiClient.post('/analytics/adventure-admin/episodes/e1/publish', {}),
    )

    expect(error.status).toBe(403)
    expect(error.domainCode).toBe('CONTENT_READ_ONLY')
    expect(sessionStorage.getItem(TOKEN_KEY)).toBe('tk')
    expect(window.location.pathname).toBe('/')
  })

  it('其它路由的 403 仍按全站行为清 token 跳登录', async () => {
    sessionStorage.setItem(TOKEN_KEY, 'tk')
    // 已经在 /login 时不再跳一次，避免 jsdom 的未实现导航噪声
    window.history.pushState({}, '', '/login')
    rejectWith({ code: 403, message: '没有权限', data: null }, 403)

    const error = await catchError(apiClient.get('/analytics/overview'))

    expect(error.status).toBe(403)
    expect(sessionStorage.getItem(TOKEN_KEY)).toBeNull()
  })

  it('401 一律清 token，内容管理台也不例外', async () => {
    sessionStorage.setItem(TOKEN_KEY, 'tk')
    window.history.pushState({}, '', '/login')
    rejectWith({ code: 401, message: '登录已过期', data: null }, 401)

    await catchError(apiClient.post('/analytics/adventure-admin/export', {}))

    expect(sessionStorage.getItem(TOKEN_KEY)).toBeNull()
  })

  it('有 token 时自动带上 Authorization 头', async () => {
    sessionStorage.setItem(TOKEN_KEY, 'tk-1')
    let seen = ''
    apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      seen = String(config.headers?.Authorization ?? '')
      return { data: { code: 0, message: 'ok', data: null }, status: 200, statusText: 'OK', headers: {}, config } as AxiosResponse
    }

    await apiClient.get('/analytics/adventure-admin/capabilities')

    expect(seen).toBe('Bearer tk-1')
  })
})
