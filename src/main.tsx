import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// 副作用导入：设定全站默认时区 Asia/Shanghai（须在渲染前生效）
import './utils/date-range'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
