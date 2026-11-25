import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { apiClient } from './client'
import {
  APP_ASSETS_KEY,
  APP_ASSET_KEYS_KEY,
  createAppAssetKey,
  updateAppAssetKey,
  useAppAssetKeys,
  useAppAssets,
  useCreateAppAssetKey,
  useUpdateAppAssetKey,
} from './appAssets'
import type { AppAssetKey } from '../types/appAssets'

/**
 * 展示位写接口：URL / method / body 必须与 deda-server 的
 * `POST|PATCH /analytics/app-assets/keys` 逐项对齐；
 * 写成功后必须同时作废 keys 与 assets 两处缓存。
 */
vi.mock('./client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}))

const mockGet = apiClient.get as unknown as ReturnType<typeof vi.fn>
const mockPost = apiClient.post as unknown as ReturnType<typeof vi.fn>
const mockPatch = apiClient.patch as unknown as ReturnType<typeof vi.fn>

const SLOT: AppAssetKey = {
  key: 'device-home/hero',
  label: '首页主视觉',
  page: 'device-home',
  note: '设计稿 A',
  enabled: true,
  createdBy: 'alice',
  updatedBy: 'alice',
  createdAt: '2026-11-25T10:00:00+08:00',
  updatedAt: '2026-11-25T10:00:00+08:00',
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

describe('app-assets 展示位写接口', () => {
  it('create 走 POST /analytics/app-assets/keys', async () => {
    mockPost.mockResolvedValue({ data: SLOT })

    await expect(
      createAppAssetKey({
        page: 'device-home',
        suffix: 'hero',
        label: '首页主视觉',
        note: '设计稿 A',
      }),
    ).resolves.toEqual(SLOT)

    expect(mockPost).toHaveBeenCalledWith('/analytics/app-assets/keys', {
      page: 'device-home',
      suffix: 'hero',
      label: '首页主视觉',
      note: '设计稿 A',
    })
  })

  it('update 走 PATCH /analytics/app-assets/keys（key 放 body）', async () => {
    mockPatch.mockResolvedValue({ data: { ...SLOT, enabled: false } })

    await expect(
      updateAppAssetKey({ key: SLOT.key, enabled: false }),
    ).resolves.toEqual({ ...SLOT, enabled: false })

    expect(mockPatch).toHaveBeenCalledWith('/analytics/app-assets/keys', {
      key: SLOT.key,
      enabled: false,
    })
  })

  it('create hook 成功后重取 keys 与 assets', async () => {
    const calls: string[] = []
    mockGet.mockImplementation((url: string) => {
      calls.push(url)
      return Promise.resolve({ data: url.endsWith('/keys') ? [SLOT] : [] })
    })
    mockPost.mockResolvedValue({ data: SLOT })
    const wrapper = createWrapper()

    const { result } = renderHook(
      () => ({
        keys: useAppAssetKeys(),
        assets: useAppAssets(),
        create: useCreateAppAssetKey(),
      }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.keys.isSuccess).toBe(true))
    await waitFor(() => expect(result.current.assets.isSuccess).toBe(true))
    const firstRound = calls.length
    expect(firstRound).toBe(2)

    result.current.create.mutate({
      page: 'device-home',
      suffix: 'hero',
      label: '首页主视觉',
    })
    await waitFor(() => expect(result.current.create.isSuccess).toBe(true))
    await waitFor(() => expect(calls.length).toBe(firstRound + 2))
  })

  it('update hook 成功后重取 keys 与 assets', async () => {
    const calls: string[] = []
    mockGet.mockImplementation((url: string) => {
      calls.push(url)
      return Promise.resolve({ data: url.endsWith('/keys') ? [SLOT] : [] })
    })
    mockPatch.mockResolvedValue({ data: SLOT })
    const wrapper = createWrapper()

    const { result } = renderHook(
      () => ({
        keys: useAppAssetKeys(),
        assets: useAppAssets(),
        update: useUpdateAppAssetKey(),
      }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.keys.isSuccess).toBe(true))
    await waitFor(() => expect(result.current.assets.isSuccess).toBe(true))
    const firstRound = calls.length
    expect(firstRound).toBe(2)

    result.current.update.mutate({ key: SLOT.key, label: '新标签' })
    await waitFor(() => expect(result.current.update.isSuccess).toBe(true))
    await waitFor(() => expect(calls.length).toBe(firstRound + 2))
  })

  it('queryKey 常量保持稳定', () => {
    expect(APP_ASSET_KEYS_KEY).toEqual(['analytics', 'appAssetKeys'])
    expect(APP_ASSETS_KEY).toEqual(['analytics', 'appAssets'])
  })
})
