/**
 * 图片素材管理（/analytics/app-assets*）的契约类型。
 *
 * 契约真相：deda-server 的 app-assets 控制器。展示位注册表由服务端维护，
 * key = page/suffix；Asset 的 status 只有 draft / published / archived 三态。
 */

export type AppAssetStatus = 'draft' | 'published' | 'archived'

/** 单个素材版本。version 是同一 key 下的递增版本号，不是全局 ID。 */
export interface AppAsset {
  id: string
  key: string
  version: number
  url: string
  width: number
  height: number
  mimeType: string
  bytes: number
  note: string | null
  status: AppAssetStatus
  createdBy: string | null
  createdAt: string
  updatedAt: string
  publishedAt: string | null
}

/** 展示位注册表项（GET /analytics/app-assets/keys） */
export interface AppAssetKey {
  key: string
  label: string
  page: string
  note: string | null
  enabled: boolean
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

/** 列表按 key 分组后的条目（GET /analytics/app-assets） */
export interface AppAssetGroup {
  key: string
  label: string
  page: string
  enabled: boolean
  /** true = 库里有历史版本、但注册表已经没有这个 key，只读 */
  orphan?: boolean
  published: AppAsset | null
  latestDraft: AppAsset | null
  versions: AppAsset[]
}
