import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

/**
 * 测试专用配置，与 vite.config.ts 分离：构建产物不依赖 vitest，
 * 且 base:'/dashboard/' 与 dev proxy 对组件测试无意义。
 *
 * globals 刻意关闭：tsconfig.app.json 的 types 只有 ["vite/client"]，
 * 全局 describe/it/expect 无法通过 tsc -b 的类型检查。测试文件一律显式
 * `import { describe, expect, it } from 'vitest'`。
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.tsx'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: './coverage',
      // 只统计有运行时逻辑的文件：纯类型声明、入口装配、测试自身不计入
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test/**',
        'src/types/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
      ],
    },
  },
})
