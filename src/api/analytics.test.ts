import { describe, expect, it, vi } from 'vitest'
import { apiClient } from './client'
import {
  deleteDeviceChildProfile,
  fetchDeviceChildProfile,
} from './analytics'

vi.mock('./client', () => ({
  apiClient: { get: vi.fn(), delete: vi.fn() },
}))

const mockGet = apiClient.get as unknown as ReturnType<typeof vi.fn>
const mockDelete = apiClient.delete as unknown as ReturnType<typeof vi.fn>

describe('fleet child-profile api', () => {
  it('fetchDeviceChildProfile 打 GET 子资源路径并剥离信封', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        profile: {
          name: '二狗',
          birthday: '2018-05-20',
          englishName: 'Lebron',
          gender: 'male',
        },
      },
    })

    const result = await fetchDeviceChildProfile('28c3619bee9b')

    expect(mockGet).toHaveBeenCalledWith(
      '/analytics/fleet/devices/28c3619bee9b/child-profile',
    )
    expect(result.profile?.englishName).toBe('Lebron')
  })

  it('fetchDeviceChildProfile 未设置档案时 profile 为 null', async () => {
    mockGet.mockResolvedValueOnce({ data: { profile: null } })

    const result = await fetchDeviceChildProfile('28c3619bee9b')

    expect(result.profile).toBeNull()
  })

  it('deleteDeviceChildProfile 打 DELETE 同路径并返回 deleted', async () => {
    mockDelete.mockResolvedValueOnce({ data: { deleted: true } })

    const result = await deleteDeviceChildProfile('28c3619bee9b')

    expect(mockDelete).toHaveBeenCalledWith(
      '/analytics/fleet/devices/28c3619bee9b/child-profile',
    )
    expect(result.deleted).toBe(true)
  })

  it('deleteDeviceChildProfile 幂等：无档案返回 deleted=false', async () => {
    mockDelete.mockResolvedValueOnce({ data: { deleted: false } })

    const result = await deleteDeviceChildProfile('28c3619bee9b')

    expect(result.deleted).toBe(false)
  })
})
