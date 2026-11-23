import type { OverviewResponse } from '../../types/analytics'

/** KPI 卡的四个出口页面。新增出口时同时补 PAGE_LABELS，否则类型报错。 */
export type KpiPagePath = '/fleet' | '/users' | '/engagement' | '/retention'

/**
 * 出口页面名称。整卡链接的可访问名与页面文案共用这一份，
 * 避免「卡片上写的」和「跳过去的地方」各存一个名字。
 */
export const PAGE_LABELS: Record<KpiPagePath, string> = {
  '/fleet': '设备舰队',
  '/users': '用户画像',
  '/engagement': '使用行为',
  '/retention': '留存与激活',
}

/** 卡片底部的附加信息：环比标签或口径标记。 */
export type KpiFooter =
  | { kind: 'delta'; value: number | null }
  | { kind: 'estimate' }

export type KpiDef = {
  key: string
  title: string
  tip?: string
  value: string | number
  suffix?: string
  href: KpiPagePath
  note?: string
  footer?: KpiFooter
}

export function pct(value: number | null): string {
  if (value === null) return '-'
  return `${(value * 100).toFixed(1)}%`
}

function count(value: number | null, suffix: string): Pick<KpiDef, 'value' | 'suffix'> {
  return value === null ? { value: '-', suffix: '' } : { value, suffix }
}

/**
 * 总览 KPI 的唯一事实来源：卡片顺序、文案、口径说明与出口都在这里。
 * 渲染层只负责把 defs 铺成网格，新增指标不必再抄一遍 <Col><Card>。
 */
export function kpiDefs(data: OverviewResponse): KpiDef[] {
  const { totals, today, retention } = data
  return [
    {
      key: 'devicesActivated',
      title: '累计激活设备',
      value: totals.devicesActivated,
      suffix: '台',
      href: '/fleet',
      note: `累计入库 ${totals.devicesRegistered} 台`,
    },
    {
      key: 'activationRate',
      title: '激活率',
      tip: '已激活设备 ÷ 已入库设备。「激活」= 家长扫码完成绑定（user_device_bindings 有记录）；接入出货数据后分母切换为出货口径',
      value: pct(totals.activationRate),
      href: '/fleet',
    },
    {
      key: 'usersRegistered',
      title: '累计家长用户',
      value: totals.usersRegistered,
      suffix: '人',
      href: '/users',
    },
    {
      key: 'dau',
      title: '活跃设备（当日）',
      tip: 'DAU 口径：当天有 ≥1 条孩子发言（role=user 消息）的去重设备数，按 Asia/Shanghai 自然日统计',
      value: today.dau,
      suffix: '台',
      href: '/engagement',
      footer: { kind: 'delta', value: today.dauDeltaPct },
    },
    {
      key: 'avgDuration',
      title: '活跃设备日均使用时长',
      value: Math.round(today.avgDurationSecondsPerActiveDevice / 60),
      suffix: '分钟',
      href: '/engagement',
      footer: { kind: 'estimate' },
    },
    {
      key: 'avgTurns',
      title: '人均对话轮次',
      value: today.avgTurnsPerActiveDevice,
      suffix: '轮',
      href: '/engagement',
    },
    {
      key: 'retentionD7',
      title: '7 日留存',
      tip: '激活日恰好为 7 天前的设备中，数据日当天仍有对话的比例；当天没有「满 7 天」的设备时显示 -',
      value: pct(retention.d7),
      href: '/retention',
    },
    {
      key: 'onlineNow',
      title: '实时在线',
      tip: '实时口径：Redis device:link:{MAC} 的 lastSeenAt 落在 15 秒窗口内。与「当日开机」的天级口径不可互相校验；Redis 查询失败显示 -（不是 0）',
      ...count(today.onlineNow, '台'),
      href: '/fleet',
    },
    {
      key: 'devicesPoweredOn',
      title: '当日开机',
      tip: '天级口径：device_presence_daily 当日有行的去重设备数（设备心跳按 5 分钟聚合）。显示 - 表示该日早于落库上线日（无数据），不是 0 台开机',
      ...count(today.devicesPoweredOn, '台'),
      href: '/fleet',
    },
    {
      key: 'powerOnRate',
      title: '开机率',
      tip: '当日开机设备 ÷ 已激活设备（distinct deviceId）。分母为 0 或当日开机无数据时显示 -。与「激活率」分母口径不同（已入库 vs 已激活），两者不可互比',
      value: pct(today.powerOnRate),
      href: '/fleet',
    },
  ]
}
