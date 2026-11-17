import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { queryClient } from './api/queryClient'
import { initMonitor } from './monitor'
// 副作用导入：设定全站默认时区 Asia/Shanghai（须在渲染前生效）
import './utils/date-range'
import './index.css'
import App from './App.tsx'

// ARMS 前端监控须在渲染前初始化；VITE_ARMS_PID 未配置时内部 no-op
initMonitor()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  </StrictMode>,
)
