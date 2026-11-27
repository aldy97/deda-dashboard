import apple from '../../assets/brands/apple.svg'
import google from '../../assets/brands/google.svg'
import huawei from '../../assets/brands/huawei.svg'
import honor from '../../assets/brands/honor.svg'
import lenovo from '../../assets/brands/lenovo.svg'
import meizu from '../../assets/brands/meizu.svg'
import nothing from '../../assets/brands/nothing.svg'
import oppo from '../../assets/brands/oppo.svg'
import realme from '../../assets/brands/realme.svg'
import samsung from '../../assets/brands/samsung.svg'
import sony from '../../assets/brands/sony.svg'
import vivo from '../../assets/brands/vivo.svg'
import xiaomi from '../../assets/brands/xiaomi.svg'
import zte from '../../assets/brands/zte.svg'
import generic from '../../assets/brands/generic.svg'

export interface PhoneMakerLogo {
  src: string
  alt: string
  /** 进度条颜色，与品牌主色一致 */
  color: string
}

/**
 * 手机厂商 logo 映射：key 与 deda-server phone-brands 的 makerKey 一一对应。
 * 图标来自 Simple Icons（CC0）与官方品牌色；realme / ZTE / Nothing 使用文字徽标兜底。
 * 品牌商标归各厂商所有，本看板仅用于内部识别。
 */
export const PHONE_MAKER_LOGOS: Record<string, PhoneMakerLogo> = {
  apple: { src: apple, alt: 'Apple', color: '#000000' },
  huawei: { src: huawei, alt: '华为', color: '#CF0A2C' },
  honor: { src: honor, alt: '荣耀', color: '#000000' },
  xiaomi: { src: xiaomi, alt: '小米', color: '#FF6900' },
  oppo: { src: oppo, alt: 'OPPO', color: '#1D7A46' },
  vivo: { src: vivo, alt: 'vivo', color: '#415FFF' },
  realme: { src: realme, alt: 'realme', color: '#FFC915' },
  samsung: { src: samsung, alt: '三星', color: '#1428A0' },
  meizu: { src: meizu, alt: '魅族', color: '#00A3E0' },
  lenovo: { src: lenovo, alt: '联想', color: '#E2231A' },
  zte: { src: zte, alt: '中兴', color: '#0066B3' },
  sony: { src: sony, alt: '索尼', color: '#000000' },
  google: { src: google, alt: 'Google', color: '#4285F4' },
  nothing: { src: nothing, alt: 'Nothing', color: '#000000' },
  other: { src: generic, alt: '其他', color: '#8C8C8C' },
}

/** 其他/未知品牌的通用兜底图 */
export const GENERIC_PHONE_LOGO: PhoneMakerLogo = {
  src: generic,
  alt: '未知品牌',
  color: '#8C8C8C',
}

export function phoneMakerLogo(makerKey: string): PhoneMakerLogo {
  return PHONE_MAKER_LOGOS[makerKey] ?? GENERIC_PHONE_LOGO
}
