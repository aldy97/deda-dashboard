import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'

/**
 * 测试设备白名单（仅 staging 有意义）。
 *
 * 冒险测试与哄睡测试共用这一份名单：只有 active=true 的设备才能被下发测试
 * 冒险故事，也才能用「测试冒险故事」「测试哄睡模式」两个语音触发词。
 * 契约见 deda-server `docs/analytics-api.md` →「测试设备白名单」。
 */

export interface TestDeviceWhitelistItem {
  id: string
  active: boolean
  note: string | null
  addedBy: string
  addedAt: string
  addedReason: string | null
  revokedBy: string | null
  revokedAt: string | null
  revokeReason: string | null
  device: {
    id: string
    deviceId: string
    deviceCode: string | null
    macAddress: string | null
    characterKey: string
    firmwareVersion: string | null
  }
}

export interface TestDevicesResponse {
  /** 两个测试开关的当前状态；都为 false 时页面只读 */
  enabled: { adventure: boolean; sleep: boolean }
  items: TestDeviceWhitelistItem[]
  total: number
}

export interface TestDevicesQuery {
  keyword?: string
  includeRevoked?: boolean
  page?: number
  pageSize?: number
}

export interface AddTestDeviceInput {
  deviceId: string
  note?: string
  reason: string
}

export interface AddTestDeviceResult {
  item: TestDeviceWhitelistItem
  /** true = 之前撤销过，这次是原地恢复而不是新建 */
  reactivated: boolean
}

export interface RevokeTestDeviceResult {
  ok: true
  /** 撤销时是否顺带清掉了该设备的测试冒险下发 */
  clearedAdventureAssignment: boolean
}

export const TEST_DEVICES_KEY = ['analytics', 'testDevices'] as const

export async function fetchTestDevices(
  query: TestDevicesQuery = {},
): Promise<TestDevicesResponse> {
  const resp = await apiClient.get('/analytics/test-devices', {
    params: query,
  })
  return resp.data as TestDevicesResponse
}

/** 下拉一次性展示全量白名单：每页 200（服务端上限），最多 5 页。 */
const WHITELIST_PAGE_SIZE = 200
const WHITELIST_MAX_PAGES = 5

export interface AllTestDevicesResult extends TestDevicesResponse {
  /** true = 白名单超过安全上限，items 已被截断 */
  truncated: boolean
}

/**
 * 拉全量白名单，供「样机下发」下拉使用。
 *
 * 不按 IP 过滤：白名单是全 IP 共用的运营集合。超过 1000 台时只取前 1000 台并
 * 标记 truncated，避免异常数据把下拉撑爆；正常样机规模远小于这个上限。
 */
export async function fetchAllTestDevices(): Promise<AllTestDevicesResult> {
  const first = await fetchTestDevices({
    page: 1,
    pageSize: WHITELIST_PAGE_SIZE,
  })
  const items = [...first.items]
  let page = 1
  while (items.length < first.total && page < WHITELIST_MAX_PAGES) {
    page += 1
    const next = await fetchTestDevices({
      page,
      pageSize: WHITELIST_PAGE_SIZE,
    })
    if (next.items.length === 0) break
    items.push(...next.items)
  }
  return { ...first, items, truncated: items.length < first.total }
}

/** 下拉用全量白名单；enabled=false 时一次请求都不发 */
export function useAllTestDevices(enabled = true) {
  return useQuery({
    queryKey: [...TEST_DEVICES_KEY, 'all'],
    queryFn: fetchAllTestDevices,
    enabled,
  })
}

export async function addTestDevice(
  input: AddTestDeviceInput,
): Promise<AddTestDeviceResult> {
  const resp = await apiClient.post('/analytics/test-devices', input)
  return resp.data as AddTestDeviceResult
}

export async function revokeTestDevice(
  deviceId: string,
  reason: string,
): Promise<RevokeTestDeviceResult> {
  const resp = await apiClient.post(
    `/analytics/test-devices/${encodeURIComponent(deviceId)}/revoke`,
    { reason },
  )
  return resp.data as RevokeTestDeviceResult
}

export function useTestDevices(query: TestDevicesQuery = {}) {
  return useQuery({
    queryKey: [...TEST_DEVICES_KEY, query],
    queryFn: () => fetchTestDevices(query),
  })
}

export function useAddTestDevice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: addTestDevice,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: TEST_DEVICES_KEY }),
  })
}

export function useRevokeTestDevice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { deviceId: string; reason: string }) =>
      revokeTestDevice(input.deviceId, input.reason),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: TEST_DEVICES_KEY }),
  })
}
