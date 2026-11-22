import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import ImpactPanel from './ImpactPanel'
import type { EpisodeImpact } from '../../types/adventureAdmin'

/**
 * 影响面数字是破坏性确认弹窗的正文，不是装饰：retire / publish 两种变体
 * 各自的结论句都必须由真实数字驱动，不能写死。
 */

function impact(overrides: Partial<EpisodeImpact> = {}): EpisodeImpact {
  return {
    devicesPlayingToday: 3,
    devicesStaleCrossDay: 2,
    devicesPinnedToOlderVersions: 1,
    totalDevicesEverStarted: 9,
    publishedVersionCount: 4,
    ...overrides,
  }
}

describe('ImpactPanel', () => {
  it('默认 info 变体只铺数字，不渲染任何结论性 Alert', () => {
    render(<ImpactPanel impact={impact()} />)

    expect(screen.getByText('今日在播')).toBeInTheDocument()
    expect(screen.getByText('跨天挂起')).toBeInTheDocument()
    expect(screen.getByText('锁在旧版本')).toBeInTheDocument()
    expect(screen.getByText('历史触达设备')).toBeInTheDocument()
    expect(screen.getByText('已发布版本数')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('9')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('retire 变体：有跨天挂起时警告，并点名会收走几条、今日在播不受影响', () => {
    render(<ImpactPanel impact={impact()} variant="retire" />)

    expect(
      screen.getByText('下架会收走 2 条跨天挂起的进度'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/今天在玩的 3 台设备不受影响/),
    ).toBeInTheDocument()
  })

  it('retire 变体：没有跨天挂起时给安心的结论，而不是空白警告', () => {
    render(
      <ImpactPanel
        impact={impact({ devicesStaleCrossDay: 0 })}
        variant="retire"
      />,
    )

    expect(
      screen.getByText('当前没有跨天挂起的进度，下架不会收走任何孩子的进度'),
    ).toBeInTheDocument()
  })

  it('publish 变体：强调新快照不动历史版本，并说明今天在播/锁旧快照的设备数', () => {
    render(<ImpactPanel impact={impact()} variant="publish" />)

    expect(
      screen.getByText('发布会生成一个新快照，不会改动任何历史版本'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/当前有 3 台设备今天在播、1 台仍锁在旧快照上/),
    ).toBeInTheDocument()
  })

  it('服务端字段缺失（undefined）时按 0 处理，不渲染 NaN', () => {
    render(
      <ImpactPanel
        impact={
          {
            devicesPlayingToday: undefined,
            devicesStaleCrossDay: undefined,
            devicesPinnedToOlderVersions: undefined,
            totalDevicesEverStarted: undefined,
            publishedVersionCount: undefined,
          } as unknown as EpisodeImpact
        }
        variant="retire"
      />,
    )

    expect(
      screen.getByText('当前没有跨天挂起的进度，下架不会收走任何孩子的进度'),
    ).toBeInTheDocument()
    expect(screen.getByText(/今天在玩的 0 台设备不受影响/)).toBeInTheDocument()
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument()
  })
})
