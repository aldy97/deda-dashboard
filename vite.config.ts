import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// deda-dashboard 部署在主域名 /dashboard 路径下，与 deda-server 同域：
// 开发时通过 proxy 把 /analytics 转发到本地后端（127.0.0.1:3000），避免 CORS；
// 生产由 nginx 将 /dashboard 指向静态资源、/analytics 反代后端，不改后端 CORS。
export default defineConfig({
  base: '/dashboard/',
  plugins: [react()],
  server: {
    proxy: {
      '/analytics': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
})
