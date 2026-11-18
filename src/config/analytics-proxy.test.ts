import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DEV_PROXY_TARGET,
  resolveAnalyticsProxyTarget,
} from './analytics-proxy'

describe('resolveAnalyticsProxyTarget', () => {
  it('env 缺失时回落 staging 默认值', () => {
    expect(resolveAnalyticsProxyTarget({})).toBe(DEFAULT_DEV_PROXY_TARGET)
    expect(
      resolveAnalyticsProxyTarget({ VITE_ANALYTICS_PROXY_TARGET: undefined }),
    ).toBe(DEFAULT_DEV_PROXY_TARGET)
  })

  it('空白值视同缺失', () => {
    expect(
      resolveAnalyticsProxyTarget({ VITE_ANALYTICS_PROXY_TARGET: '   ' }),
    ).toBe(DEFAULT_DEV_PROXY_TARGET)
  })

  it('原样采用合法的自定义 target', () => {
    expect(
      resolveAnalyticsProxyTarget({
        VITE_ANALYTICS_PROXY_TARGET: 'http://127.0.0.1:3000',
      }),
    ).toBe('http://127.0.0.1:3000')
  })

  it('首尾空白先 trim', () => {
    expect(
      resolveAnalyticsProxyTarget({
        VITE_ANALYTICS_PROXY_TARGET: '  http://127.0.0.1:3000  ',
      }),
    ).toBe('http://127.0.0.1:3000')
  })

  it('去掉尾斜杠，避免 proxy 拼出双斜杠路径', () => {
    expect(
      resolveAnalyticsProxyTarget({
        VITE_ANALYTICS_PROXY_TARGET: 'https://staging.valleyletters.com/',
      }),
    ).toBe('https://staging.valleyletters.com')
  })

  it('非 http(s) 的值直接报错，绝不静默指向别处', () => {
    expect(() =>
      resolveAnalyticsProxyTarget({ VITE_ANALYTICS_PROXY_TARGET: 'ftp://x.com' }),
    ).toThrow(/VITE_ANALYTICS_PROXY_TARGET/)
    expect(() =>
      resolveAnalyticsProxyTarget({ VITE_ANALYTICS_PROXY_TARGET: 'not-a-url' }),
    ).toThrow(/VITE_ANALYTICS_PROXY_TARGET/)
  })
})
