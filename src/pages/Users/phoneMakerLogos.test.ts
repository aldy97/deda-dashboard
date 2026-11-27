import { describe, expect, it } from 'vitest'
import {
  GENERIC_PHONE_LOGO,
  PHONE_MAKER_LOGOS,
  phoneMakerLogo,
} from './phoneMakerLogos'

const MAKER_KEYS = [
  'apple',
  'huawei',
  'honor',
  'xiaomi',
  'oppo',
  'vivo',
  'realme',
  'samsung',
  'meizu',
  'lenovo',
  'zte',
  'sony',
  'google',
  'nothing',
  'other',
]

describe('phoneMakerLogos', () => {
  it('每个 makerKey 都有官方彩色 logo 资源与 alt', () => {
    for (const key of MAKER_KEYS) {
      const logo = PHONE_MAKER_LOGOS[key]
      expect(logo, key).toBeDefined()
      expect(logo.src, key).toBeTruthy()
      expect(logo.alt, key).toBeTruthy()
    }
  })

  it('未知 makerKey 回落通用兜底图', () => {
    expect(phoneMakerLogo('brand_not_in_map')).toBe(GENERIC_PHONE_LOGO)
    expect(PHONE_MAKER_LOGOS.other.src).toBe(GENERIC_PHONE_LOGO.src)
  })
})
