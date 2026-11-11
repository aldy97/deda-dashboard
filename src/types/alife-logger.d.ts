// alife-logger 官方未提供 TypeScript 类型声明，这里补齐项目用到的最小接口。
declare module 'alife-logger' {
  export interface ArmsIgnoreConfig {
    ignoreUrls?: Array<string | RegExp>
    ignoreApis?: Array<string | RegExp>
    ignoreErrors?: Array<string | RegExp>
    ignoreResErrors?: Array<string | RegExp>
  }

  export interface ArmsLoggerConfig {
    pid: string
    page?: string
    sample?: number
    enableSPA?: boolean
    disableHook?: boolean
    autoSendPv?: boolean
    sendResource?: boolean
    ignore?: ArmsIgnoreConfig
    environment?: string
    release?: string
  }

  export interface ArmsLogger {
    setPage(page: string, sendPv?: boolean): void
    setConfig(config: Partial<ArmsLoggerConfig>): void
    error(error: Error | string, pos?: unknown): void
    api(
      api: string,
      success: boolean,
      time: number,
      code?: string | number,
      msg?: string,
    ): void
  }

  interface BrowserLoggerStatic {
    singleton(config: ArmsLoggerConfig): ArmsLogger
  }

  const BrowserLogger: BrowserLoggerStatic
  export default BrowserLogger
}
