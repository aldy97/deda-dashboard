import dayjs from 'dayjs'
import type { AppAssetStatus } from '../../types/appAssets'

/**
 * 素材列表 / 版本历史的展示口径。
 *
 * 状态标签、大小 / 尺寸 / 时间的格式化集中在这里，列表页与版本历史抽屉共用，
 * 避免两边各写一套「多少字节算 KB」然后互相矛盾。
 */

export interface StatusView {
  text: string
  color: string
}

export function assetStatusLabel(status: AppAssetStatus): StatusView {
  switch (status) {
    case 'published':
      return { text: '已发布', color: 'green' }
    case 'draft':
      return { text: '草稿', color: 'gold' }
    case 'archived':
      return { text: '已下架', color: 'default' }
  }
}

/** 人类可读的文件大小；小于 1KB 保留整数 B，其余保留一位小数 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function formatDims(width: number, height: number): string {
  return `${width} × ${height}`
}

/** 空值统一渲染成 em dash，不把「无时间」与「时间 0」混在一起 */
export function formatTime(iso: string | null): string {
  return iso ? dayjs(iso).format('YYYY-MM-DD HH:mm') : '—'
}
