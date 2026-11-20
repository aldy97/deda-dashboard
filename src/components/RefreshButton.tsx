import { ReloadOutlined } from '@ant-design/icons'
import { Button } from 'antd'

interface RefreshButtonProps {
  /** 刷新进行中（isFetching 口径，有旧数据时静默刷新不触发整页 loading） */
  loading?: boolean
  onClick?: () => void
}

/**
 * 全站统一「刷新」按钮。挂在 PageHeader 的 actions 里，配合
 * usePageRefresh 做页面级全局刷新。
 */
export default function RefreshButton({
  loading,
  onClick,
}: RefreshButtonProps) {
  return (
    <Button icon={<ReloadOutlined />} loading={loading} onClick={onClick}>
      刷新
    </Button>
  )
}
