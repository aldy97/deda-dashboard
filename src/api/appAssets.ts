import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'
import type {
  AppAsset,
  AppAssetGroup,
  AppAssetKey,
} from '../types/appAssets'

/**
 * 图片素材管理接口层。
 *
 * 展示位注册表与素材列表是纯读；写操作（上传 / 发布 / 下架 / 展示位 CRUD）
 * 统一走 POST / PATCH。上传用 multipart（FormData），其余只传业务字段。
 *
 * mutation 与它要失效的 queryKey 写在一起：素材写操作要同时作废「列表」与
 * 「该 key 的版本历史」；展示位写操作要同时作废「注册表」与「素材列表」，
 * 否则会出现「弹窗说改成功、页面还是旧值」的自相矛盾。
 */

export const APP_ASSET_KEYS_KEY = ['analytics', 'appAssetKeys'] as const
export const APP_ASSETS_KEY = ['analytics', 'appAssets'] as const
export const appAssetVersionsKey = (key: string) =>
  ['analytics', 'appAssetVersions', key] as const

// ---- 读 ----

/** 展示位注册表；空 DB 时只有服务端内置的诊断位 */
export async function fetchAppAssetKeys(): Promise<AppAssetKey[]> {
  const resp = await apiClient.get('/analytics/app-assets/keys')
  return resp.data as AppAssetKey[]
}

/** 素材列表（按 key 分组，含 published / latestDraft / versions） */
export async function fetchAppAssets(): Promise<AppAssetGroup[]> {
  const resp = await apiClient.get('/analytics/app-assets')
  return resp.data as AppAssetGroup[]
}

/** 单个 key 的版本历史，服务端已按 version 降序返回 */
export async function fetchAppAssetVersions(
  key: string,
): Promise<AppAsset[]> {
  const resp = await apiClient.get('/analytics/app-assets/versions', {
    params: { key },
  })
  return resp.data as AppAsset[]
}

// ---- 写：素材 ----

export interface UploadAppAssetPayload {
  key: string
  file: File
  width: number
  height: number
  note?: string
}

/** 上传新版本（draft）。onProgress 只给 0-100 的整数百分比。 */
export async function uploadAppAsset(
  payload: UploadAppAssetPayload,
  onProgress?: (percent: number) => void,
): Promise<AppAsset> {
  const form = new FormData()
  form.append('key', payload.key)
  form.append('file', payload.file)
  form.append('width', String(payload.width))
  form.append('height', String(payload.height))
  const note = payload.note?.trim()
  if (note) form.append('note', note)

  const resp = await apiClient.post('/analytics/app-assets/upload', form, {
    onUploadProgress: onProgress
      ? (event) => {
          if (event.total != null && event.total > 0) {
            onProgress(Math.round((event.loaded / event.total) * 100))
          }
        }
      : undefined,
  })
  return resp.data as AppAsset
}

export async function publishAppAsset(id: string): Promise<AppAsset> {
  const resp = await apiClient.post(`/analytics/app-assets/${id}/publish`)
  return resp.data as AppAsset
}

export async function archiveAppAsset(id: string): Promise<AppAsset> {
  const resp = await apiClient.post(`/analytics/app-assets/${id}/archive`)
  return resp.data as AppAsset
}

// ---- 写：展示位 ----

export interface CreateAppAssetKeyInput {
  page: string
  suffix: string
  label: string
  note?: string | null
}

export interface UpdateAppAssetKeyInput {
  key: string
  label?: string
  note?: string | null
  enabled?: boolean
}

export async function createAppAssetKey(
  input: CreateAppAssetKeyInput,
): Promise<AppAssetKey> {
  const resp = await apiClient.post('/analytics/app-assets/keys', input)
  return resp.data as AppAssetKey
}

export async function updateAppAssetKey(
  input: UpdateAppAssetKeyInput,
): Promise<AppAssetKey> {
  const resp = await apiClient.patch('/analytics/app-assets/keys', input)
  return resp.data as AppAssetKey
}

// ---- hooks ----

export function useAppAssetKeys() {
  return useQuery({ queryKey: APP_ASSET_KEYS_KEY, queryFn: fetchAppAssetKeys })
}

export function useAppAssets() {
  return useQuery({ queryKey: APP_ASSETS_KEY, queryFn: fetchAppAssets })
}

/** key 为 null 时（未打开版本历史抽屉）不发请求 */
export function useAppAssetVersions(key: string | null) {
  return useQuery({
    queryKey: appAssetVersionsKey(key ?? ''),
    queryFn: () => fetchAppAssetVersions(key as string),
    enabled: key !== null,
  })
}

/**
 * 写操作的统一后置动作：列表 + 该 key 的版本历史两处缓存全部作废。
 * key 缺失时只失效列表（例如删除类操作）。
 */
function useInvalidateAppAssets(key?: string | null) {
  const queryClient = useQueryClient()
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: APP_ASSETS_KEY }),
      ...(key
        ? [queryClient.invalidateQueries({ queryKey: appAssetVersionsKey(key) })]
        : []),
    ])
  }
}

/** 展示位写操作：注册表与素材列表都要重取。 */
function useInvalidateCatalog() {
  const queryClient = useQueryClient()
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: APP_ASSET_KEYS_KEY }),
      queryClient.invalidateQueries({ queryKey: APP_ASSETS_KEY }),
    ])
  }
}

export function useUploadAppAsset() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      onProgress,
      ...payload
    }: UploadAppAssetPayload & { onProgress?: (percent: number) => void }) =>
      uploadAppAsset(payload, onProgress),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: APP_ASSETS_KEY })
      void queryClient.invalidateQueries({
        queryKey: appAssetVersionsKey(variables.key),
      })
    },
  })
}

export function usePublishAppAsset(key: string | null) {
  const invalidate = useInvalidateAppAssets(key)
  return useMutation({
    mutationFn: publishAppAsset,
    onSuccess: invalidate,
  })
}

export function useArchiveAppAsset(key: string | null) {
  const invalidate = useInvalidateAppAssets(key)
  return useMutation({
    mutationFn: archiveAppAsset,
    onSuccess: invalidate,
  })
}

export function useCreateAppAssetKey() {
  const invalidate = useInvalidateCatalog()
  return useMutation({
    mutationFn: createAppAssetKey,
    onSuccess: invalidate,
  })
}

export function useUpdateAppAssetKey() {
  const invalidate = useInvalidateCatalog()
  return useMutation({
    mutationFn: updateAppAssetKey,
    onSuccess: invalidate,
  })
}
