import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { resolveAnalyticsProxyTarget } from './src/config/analytics-proxy.ts'

// deda-dashboard 部署在主域名 /dashboard 路径下，与 deda-server 同域：
// 开发时通过 proxy 把 /analytics 转发到 VITE_ANALYTICS_PROXY_TARGET
// （.env.development，默认 staging——本地设备绑定 staging 服务器，不再跑本地
// 后端/数据库），避免 CORS；生产由 nginx 将 /dashboard 指向静态资源、
// /analytics 反代后端，不改后端 CORS。
export default defineConfig(({ mode }) => {
  const target = resolveAnalyticsProxyTarget(
    loadEnv(mode, process.cwd(), 'VITE_'),
  )
  return {
    base: '/dashboard/',
    plugins: [react()],
    build: {
      // hidden：产物不带 map 引用，但 dist 里生成 .map 供 ARMS 反解混淆堆栈；
      // 部署打包时必须排除 *.map（本仓库是 public 的，map 含完整源码）
      sourcemap: 'hidden',
    },
    server: {
      proxy: {
        '/analytics': {
          target,
          changeOrigin: true,
        },
      },
    },
  }
})
