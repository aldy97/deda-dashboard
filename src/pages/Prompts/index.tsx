import { useState } from 'react'
import { Alert, Button, Drawer, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import EnvTag from '../../components/EnvTag'
import {
  UNKNOWN_ENV_VIEW,
  isPromptWritable,
  resolveEnvTag,
} from '../../components/env'
import { useAnalyticsMeta } from '../../api/meta'
import { usePromptCatalog } from '../../api/prompts'
import type { PromptCatalogItem, PromptCategory } from '../../types/analytics'
import PromptEditor from './PromptEditor'
import {
  CATEGORY_LABEL,
  categoryLabel,
  resolvePromptState,
  sceneLabel,
  sourceLabel,
} from './labels'

/**
 * Prompt 管理：admin 对 17 个可编辑 prompt 做 view / edit / publish。
 *
 * 页面本身不判断环境，只把 `GET /analytics/meta` 的结论往下传：
 * 环境认不出来（请求失败或还在路上）就 fail-closed，全部写操作禁用。
 * 发布/回滚/恢复默认都是「重大操作」，统一走 PublishModal 手动输入确认码。
 */

const CATEGORY_FILTERS = (
  Object.keys(CATEGORY_LABEL) as PromptCategory[]
).map((value) => ({ text: CATEGORY_LABEL[value], value }))

function fmtTime(iso: string | null): string {
  return iso ? dayjs(iso).format('YYYY-MM-DD HH:mm') : '—'
}

export default function Prompts() {
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const metaQuery = useAnalyticsMeta()
  const catalogQuery = usePromptCatalog()

  const meta = metaQuery.data ?? null
  const env =
    metaQuery.isPending || metaQuery.isError
      ? UNKNOWN_ENV_VIEW
      : resolveEnvTag(meta?.nodeEnv)
  const writable = isPromptWritable(env, meta?.promptWriteEnabled)
  const disabledReason = !env.known
    ? '无法确认当前环境（/analytics/meta 不可用），已按 fail-closed 禁用全部写操作。请刷新或重新登录后再试。'
    : meta?.promptWriteEnabled === false
      ? '服务端已关闭 prompt 写入（PROMPT_WRITE_ENABLED=false），当前环境只读。'
      : null

  const items = catalogQuery.data ?? []

  const columns: ColumnsType<PromptCatalogItem> = [
    {
      title: '名称',
      dataIndex: 'name',
      render: (_, item) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{item.name}</Typography.Text>
          <Typography.Text code style={{ fontSize: 12 }}>
            {item.key}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      width: 130,
      filters: CATEGORY_FILTERS,
      onFilter: (value, item) => item.category === value,
      render: (category: PromptCategory) => (
        <Tag>{categoryLabel(category)}</Tag>
      ),
    },
    {
      title: '调用场景',
      dataIndex: 'scene',
      width: 130,
      render: (scene: string | null) => sceneLabel(scene),
    },
    {
      title: '生效来源',
      dataIndex: 'source',
      width: 120,
      filters: [
        { text: 'DB 已发布', value: 'db' },
        { text: '代码默认值', value: 'default' },
      ],
      onFilter: (value, item) => item.source === value,
      render: (_, item) => {
        const source = sourceLabel(item.source)
        return <Tag color={source.color}>{source.text}</Tag>
      },
    },
    {
      title: '状态',
      width: 220,
      render: (_, item) => {
        const state = resolvePromptState(item)
        return (
          <Space size={4}>
            <Tag color={state.color}>{state.text}</Tag>
            {item.deviatesFromDefault && <Tag color="orange">已偏离默认</Tag>}
          </Space>
        )
      },
    },
    {
      title: '最近发布',
      dataIndex: 'publishedAt',
      width: 180,
      render: (_, item) =>
        item.publishedAt ? (
          <Space direction="vertical" size={0}>
            <Typography.Text style={{ fontSize: 12 }}>
              {fmtTime(item.publishedAt)}
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {item.publishedBy ?? '—'}
            </Typography.Text>
          </Space>
        ) : (
          <Typography.Text type="secondary">从未发布</Typography.Text>
        ),
    },
    {
      title: '操作',
      width: 96,
      render: (_, item) => (
        <Button size="small" onClick={() => setSelectedKey(item.key)}>
          查看/编辑
        </Button>
      ),
    },
  ]

  return (
    <div>
      <Space
        style={{ width: '100%', justifyContent: 'space-between' }}
        align="center"
      >
        <Typography.Title level={4} style={{ marginBottom: 0 }}>
          Prompt 管理
        </Typography.Title>
        <EnvTag
          nodeEnv={meta?.nodeEnv}
          loading={metaQuery.isPending}
          failed={metaQuery.isError}
        />
      </Space>

      <Typography.Paragraph type="secondary" style={{ margin: '8px 0 16px' }}>
        {items.length > 0
          ? `共 ${items.length} 个可编辑 prompt。`
          : '可编辑 prompt 列表加载中…'}
        运行时按「DB 已发布 → 代码默认值」回落；
        发布后立即改变线上所有设备的模型行为，因此发布 / 回滚 / 恢复默认都需要手动输入确认码。
        儿童安全兜底、身份包装、L1 词表等属永久硬编码红线，不在此列。
      </Typography.Paragraph>

      {metaQuery.isError && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="无法确认当前环境"
          description={disabledReason}
        />
      )}
      {env.production && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="当前为生产环境"
          description="这里的任何发布都会立即对所有线上设备生效，没有灰度。改动前请确认已在测试环境验证过。"
        />
      )}
      {env.known && meta?.promptWriteEnabled === false && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="当前环境只读"
          description={disabledReason}
        />
      )}

      {catalogQuery.error && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="prompt 列表加载失败"
          description={
            catalogQuery.error instanceof Error
              ? catalogQuery.error.message
              : '未知错误'
          }
        />
      )}

      <Table<PromptCatalogItem>
        rowKey="key"
        size="middle"
        // 全站没配 ConfigProvider locale，Table 内置文案默认是英文 Reset/OK；
        // 这是仓库里第一个带列筛选的表格，就地补中文，别让它露出英文按钮
        locale={{ filterConfirm: '确定', filterReset: '重置' }}
        columns={columns}
        dataSource={items}
        loading={catalogQuery.isLoading}
        pagination={false}
      />

      <Drawer
        title={
          selectedKey ? (
            <span>
              Prompt 详情{' '}
              <Typography.Text code style={{ fontSize: 13 }}>
                {selectedKey}
              </Typography.Text>
            </span>
          ) : undefined
        }
        open={selectedKey !== null}
        onClose={() => setSelectedKey(null)}
        width={900}
        // antd 6 改名：关闭即销毁编辑器，不留上一个 prompt 的状态
        destroyOnHidden
      >
        {selectedKey && (
          <PromptEditor
            promptKey={selectedKey}
            env={env}
            writable={writable}
            disabledReason={disabledReason}
            confirmCodeHint={meta?.publishConfirmCode ?? ''}
          />
        )}
      </Drawer>
    </div>
  )
}
