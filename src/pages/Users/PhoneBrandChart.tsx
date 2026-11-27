import { Empty, Typography } from 'antd'
import type { PhoneBrandsResponse } from '../../types/analytics'
import InfoTip from '../../components/InfoTip'
import { GENERIC_PHONE_LOGO, phoneMakerLogo } from './phoneMakerLogos'

const pct = (value: number | null): string =>
  value === null ? '—' : `${(value * 100).toFixed(1)}%`

const width = (share: number | null): string =>
  share === null ? '0%' : `${Math.max(0, Math.min(100, share * 100))}%`

interface BrandRowProps {
  src: string
  alt: string
  label: string
  users: number
  barShare: number | null
  labelShare: number | null
  color: string
  suffix: string
}

function BrandRow({
  src,
  alt,
  label,
  users,
  barShare,
  labelShare,
  color,
  suffix,
}: BrandRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 10,
      }}
    >
      <img
        src={src}
        alt={`${alt} logo`}
        width={24}
        height={24}
        style={{
          flex: 'none',
          borderRadius: '50%',
          objectFit: 'contain',
          background: '#fafafa',
        }}
      />
      <span style={{ width: 96, flex: 'none' }}>{label}</span>
      <div
        style={{
          flex: 1,
          height: 8,
          background: '#f0f0f0',
          borderRadius: 4,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: width(barShare),
            height: '100%',
            background: color,
            borderRadius: 4,
          }}
        />
      </div>
      <span
        style={{
          width: 210,
          flex: 'none',
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {users} 人 · {pct(labelShare)}（{suffix}）
      </span>
    </div>
  )
}

/**
 * 家长手机厂商分布：全量注册家长当前快照。
 * 品牌来自小程序上报，只展示聚合计数；未知单独一行。
 */
export default function PhoneBrandChart({
  data,
}: {
  data: PhoneBrandsResponse
}) {
  const coverage = (
    <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
      已上报 {data.reportedUsers} / {data.totalUsers} 位家长（
      {pct(data.coverage)}）
      <InfoTip title="品牌来自小程序 wx.getDeviceInfo()；同一家长换机取最新一次上报。未打开新版本的用户计入未知，数据自新版本上线起采集。" />
    </Typography.Paragraph>
  )

  if (data.reportedUsers === 0) {
    return (
      <div>
        {coverage}
        <Empty description="暂无手机品牌数据（小程序新版本上线后开始采集）" />
      </div>
    )
  }

  const unknownShare =
    data.totalUsers > 0 ? data.unknownUsers / data.totalUsers : null

  return (
    <div>
      {coverage}
      {data.brands.map((brand) => {
        const logo = phoneMakerLogo(brand.makerKey)
        return (
          <BrandRow
            key={brand.makerKey}
            src={logo.src}
            alt={logo.alt}
            label={brand.makerLabel}
            users={brand.users}
            barShare={brand.shareOfTotal}
            labelShare={brand.shareOfReported}
            color={logo.color}
            suffix="占已上报"
          />
        )
      })}
      {data.unknownUsers > 0 && (
        <BrandRow
          src={GENERIC_PHONE_LOGO.src}
          alt={GENERIC_PHONE_LOGO.alt}
          label="未知"
          users={data.unknownUsers}
          barShare={unknownShare}
          labelShare={unknownShare}
          color={GENERIC_PHONE_LOGO.color}
          suffix="占总人数"
        />
      )}
    </div>
  )
}
