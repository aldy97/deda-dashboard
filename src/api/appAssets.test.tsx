import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { apiClient } from './client'
import {
  APP_ASSETS_KEY,
  APP_ASSET_KEYS_KEY,
  appAssetVersionsKey,
  archiveAppAsset,
  fetchAppAssetKeys,
  fetchAppAssets,
  fetchAppAssetVersions,
  publishAppAsset,
  uploadAppAsset,
  useAppAssetKeys,
  useAppAssets,
  useAppAssetVersions,
  useUploadAppAsset,
} from './appAssets'
import type { AppAsset, AppAssetGroup, AppAssetKey } from '../types/appAssets'

/**
 * 契约守卫 + 写操作缓存一致性。
 * URL / method / body 必须与 deda-server 的 app-assets 控制器逐项对齐；
 * 上传走 multipart，width / height 必须随 FormData 一起发出去；
 * mutation 成功后必须同时作废「列表」与「该 key 的版本历史」两处缓存。
 */
vi.mock('./client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}))

const mockGet = apiClient.get as unknown as ReturnType<typeof vi.fn>
const mockPost = apiClient.post as unknown as ReturnType<typeof vi.fn>

const KEY = 'diagnostics/remote-probe'
const KEY_ITEM: AppAssetKey = {
  key: KEY,
  label: '远程素材探针',
  page: 'diagnostics',
  note: null,
  enabled: true,
  createdBy: null,
  updatedBy: null,
  createdAt: '2026-11-25T10:00:00+08:00',
  updatedAt: '2026-11-25T10:00:00+08:00',
}

const ASSET: AppAsset = {
  id: 'asset-1',
  key: KEY,
  version: 3,
  url: 'https://cdn.example.com/a.png',
  width: 800,
  height: 600,
  mimeType: 'image/png',
  bytes: 2048,
  note: '新版占位图',
  status: 'published',
  createdBy: 'superadmin',
  createdAt: '2026-11-25T10:00:00+08:00',
  updatedAt: '2026-11-25T10:00:00+08:00',
  publishedAt: '2026-11-25T10:05:00+08:00',
}

const GROUP: AppAssetGroup = {
  key: KEY,
  label: '远程素材探针',
  page: 'diagnostics',
  enabled: true,
  published: ASSET,
  latestDraft: null,
  versions: [ASSET],
}

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        retry: false,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

describe('app-assets 读接口', () => {
  it('keys 走 GET /analytics/app-assets/keys', async () => {
    mockGet.mockResolvedValue({ data: [KEY_ITEM] })

    await expect(fetchAppAssetKeys()).resolves.toEqual([KEY_ITEM])
    expect(mockGet).toHaveBeenCalledWith('/analytics/app-assets/keys')
  })

  it('assets 走 GET /analytics/app-assets 并返回分组数组', async () => {
    mockGet.mockResolvedValue({ data: [GROUP] })

    await expect(fetchAppAssets()).resolves.toEqual([GROUP])
    expect(mockGet).toHaveBeenCalledWith('/analytics/app-assets')
  })

  it('versions 把 key 拼进 query', async () => {
    mockGet.mockResolvedValue({ data: [ASSET] })

    await expect(fetchAppAssetVersions(KEY)).resolves.toEqual([ASSET])
    expect(mockGet).toHaveBeenCalledWith('/analytics/app-assets/versions', {
      params: { key: KEY },
    })
  })
})

describe('app-assets 写接口', () => {
  it('上传走 multipart：key / file / width / height 原样进 FormData', async () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    mockPost.mockResolvedValue({ data: ASSET })

    await expect(
      uploadAppAsset({ key: KEY, file, width: 800, height: 600 }),
    ).resolves.toEqual(ASSET)

    const [url, form] = mockPost.mock.calls[0] as [string, FormData]
    expect(url).toBe('/analytics/app-assets/upload')
    expect(form.get('key')).toBe(KEY)
    expect(form.get('width')).toBe('800')
    expect(form.get('height')).toBe('600')
    expect(form.get('file')).toBe(file)
    expect(form.get('note')).toBeNull()
  })

  it('备注 trim 后为空的就不发 note 字段', async () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    mockPost.mockResolvedValue({ data: ASSET })

    await uploadAppAsset({ key: KEY, file, width: 1, height: 1, note: '  ' })

    const form = mockPost.mock.calls[0][1] as FormData
    expect(form.get('note')).toBeNull()
  })

  it('onUploadProgress 把进度换算成整数百分比', async () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    const onProgress = vi.fn()
    mockPost.mockImplementation(
      (_url: string, _form: FormData, config?: Record<string, unknown>) => {
        const handler = config?.onUploadProgress as
          | ((event: { loaded: number; total: number }) => void)
          | undefined
        handler?.({ loaded: 5, total: 10 })
        return Promise.resolve({ data: ASSET })
      },
    )

    await uploadAppAsset(
      { key: KEY, file, width: 1, height: 1 },
      onProgress,
    )

    expect(onProgress).toHaveBeenCalledWith(50)
  })

  it('total 缺失或为 0 时不回调进度（避免除以 0）', async () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    const onProgress = vi.fn()
    mockPost.mockImplementation(
      (_url: string, _form: FormData, config?: Record<string, unknown>) => {
        const handler = config?.onUploadProgress as
          | ((event: { loaded: number; total: number }) => void)
          | undefined
        handler?.({ loaded: 5, total: 0 })
        return Promise.resolve({ data: ASSET })
      },
    )

    await uploadAppAsset({ key: KEY, file, width: 1, height: 1 }, onProgress)

    expect(onProgress).not.toHaveBeenCalled()
  })

  it.each([
    ['publish', publishAppAsset],
    ['archive', archiveAppAsset],
  ] as const)('%s 走 POST :id/%s 并回传 AppAsset', async (_name, fn) => {
    mockPost.mockResolvedValue({ data: ASSET })

    await expect(fn('asset-1')).resolves.toEqual(ASSET)
    expect(mockPost).toHaveBeenCalledWith(
      `/analytics/app-assets/asset-1/${_name}`,
    )
  })
})

describe('app-assets hooks', () => {
  it('key 为 null 时 versions 不发请求', () => {
    const wrapper = createWrapper()
    renderHook(() => useAppAssetVersions(null), { wrapper })

    expect(mockGet).not.toHaveBeenCalled()
  })

  it('queryKey 常量与服务端路径一致', () => {
    expect(APP_ASSET_KEYS_KEY).toEqual(['analytics', 'appAssetKeys'])
    expect(APP_ASSETS_KEY).toEqual(['analytics', 'appAssets'])
    expect(appAssetVersionsKey(KEY)).toEqual([
      'analytics',
      'appAssetVersions',
      KEY,
    ])
  })

  it('keys / assets 各自走自己的 queryKey 去重', async () => {
    mockGet.mockImplementation((url: string) =>
      Promise.resolve({
        data: url.endsWith('/keys') ? [KEY_ITEM] : [GROUP],
      }),
    )
    const wrapper = createWrapper()

    const a = renderHook(
      () => ({ keys: useAppAssetKeys(), assets: useAppAssets() }),
      { wrapper },
    )
    await waitFor(() => expect(a.result.current.assets.isSuccess).toBe(true))
    const b = renderHook(
      () => ({ keys: useAppAssetKeys(), assets: useAppAssets() }),
      { wrapper },
    )
    await waitFor(() => expect(b.result.current.assets.isSuccess).toBe(true))

    expect(mockGet).toHaveBeenCalledTimes(2)
  })

  it('上传成功后列表与该 key 的版本历史缓存全部重取', async () => {
    const wrapper = createWrapper()
    const calls: string[] = []
    mockGet.mockImplementation((url: string) => {
      calls.push(url)
      const data = url.endsWith('/versions') ? [ASSET] : [GROUP]
      return Promise.resolve({ data })
    })
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    mockPost.mockResolvedValue({ data: ASSET })

    const { result } = renderHook(
      () => ({
        assets: useAppAssets(),
        versions: useAppAssetVersions(KEY),
        upload: useUploadAppAsset(),
      }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.assets.isSuccess).toBe(true))
    await waitFor(() => expect(result.current.versions.isSuccess).toBe(true))
    const firstRound = calls.length
    expect(firstRound).toBe(2)

    result.current.upload.mutate({
      key: KEY,
      file,
      width: 800,
      height: 600,
    })
    await waitFor(() => expect(result.current.upload.isSuccess).toBe(true))
    await waitFor(() => expect(calls.length).toBe(firstRound + 2))

    expect(mockPost).toHaveBeenCalledWith(
      '/analytics/app-assets/upload',
      expect.any(FormData),
      expect.any(Object),
    )
  })
})
