import { Alert, Button, Drawer, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { Link } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import {
  UNKNOWN_ENV_VIEW,
  isPromptWritable,
  resolveEnvTag,
} from '../../components/env'
import { useAnalyticsMeta } from '../../api/meta'
import { usePromptCatalog } from '../../api/prompts'
import { modeLabel } from '../../components/message/labels'
import {
  MODE_PROMPT_REFS,
  resolveModePrompts,
} from '../../components/message/mode-prompts'
import type { PromptCatalogItem, PromptCategory } from '../../types/analytics'
import { useUrlQuery, readParam, readOptionalEnumParam } from '../../utils/url-state'
import { SCENE_META } from '../Llm/scenes'
import PromptEditor from './PromptEditor'
import {
  CATEGORY_LABEL,
  categoryLabel,
  resolvePromptState,
  sceneLabel,
  sourceLabel,
} from './labels'

/**
 * 提示词管理：admin 对 17 个可编辑 prompt 做 view / edit / publish。
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
  const { searchParams, setQuery } = useUrlQuery()
  const selectedKey = readParam(searchParams, 'key')
  // 对话模式下钻：mode 只认映射表里的现行 mode，legacy / 未知值当作没传
  const mode = readOptionalEnumParam(
    searchParams,
    'mode',
    Object.keys(MODE_PROMPT_REFS),
  )
  const characterKey = readParam(searchParams, 'characterKey')
  const sceneFilter = readOptionalEnumParam(
    searchParams,
    'scene',
    Object.keys(SCENE_META),
  )
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

  // catalog 未就绪时不解析，避免把「还没加载」误报成「人设/提示词不存在」
  const modeResolved =
    mode && catalogQuery.isSuccess
      ? resolveModePrompts(
          mode,
          characterKey,
          new Set(items.map((i) => i.key)),
        )
      : null
  const modeOrder = modeResolved
    ? new Map(modeResolved.refs.map((ref, index) => [ref.key, index]))
    : null

  let filteredItems = sceneFilter
    ? items.filter((i) => i.scene === sceneFilter)
    : items
  if (modeOrder) {
    filteredItems = filteredItems
      .filter((i) => modeOrder.has(i.key))
      .sort(
        (a, b) => (modeOrder.get(a.key) ?? 0) - (modeOrder.get(b.key) ?? 0),
      )
  }

  const sharedModeNotes =
    modeResolved?.refs.filter((ref) => ref.shared).map((ref) => ref.note) ?? []
  const missingModeKeys =
    modeResolved?.refs.filter((ref) => ref.missing).map((ref) => ref.key) ?? []

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
      render: (scene: string | null) =>
        scene ? (
          <Link to={`/llm?tab=perf&scene=${scene}`}>{sceneLabel(scene)}</Link>
        ) : (
          sceneLabel(scene)
        ),
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
        <Button size="small" onClick={() => setQuery({ key: item.key })}>
          查看/编辑
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="提示词管理"
        description={`${
          items.length > 0
            ? `共 ${items.length} 个可编辑 prompt。`
            : '可编辑 prompt 列表加载中…'
        } 运行时按「DB 已发布 → 代码默认值」回落；发布后立即改变线上所有设备的模型行为，因此发布 / 回滚 / 恢复默认都需要手动输入确认码。儿童安全兜底、身份包装、L1 词表等属永久硬编码红线，不在此列。`}
      />

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

      {mode && (
        <Tag
          closable
          color="processing"
          onClose={() =>
            setQuery({ mode: null, characterKey: null }, { replace: true })
          }
          style={{ marginBottom: 12 }}
        >
          对话模式：{modeLabel(mode)}
          {catalogQuery.isSuccess
            ? `（${filteredItems.length} 段提示词）`
            : '（加载中…）'}
        </Tag>
      )}

      {modeResolved?.persona?.fallback && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="该角色未登记人设"
          description={`角色 ${characterKey} 尚未在音色管理中创建人设，运行时回落 persona_elly；下表展示的是实际生效的人设。`}
        />
      )}

      {sharedModeNotes.length > 0 && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="跨模式共享"
          description={sharedModeNotes.join('；')}
        />
      )}

      {missingModeKeys.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="该模式的部分提示词不在目录里"
          description={`${missingModeKeys.join('、')}；可能是服务端已下线，或角色人设尚未创建。`}
        />
      )}

      {sceneFilter && (
        <Tag
          closable
          onClose={() => setQuery({ scene: null }, { replace: true })}
          style={{ marginBottom: 12 }}
        >
          调用场景：{sceneLabel(sceneFilter)}
        </Tag>
      )}

      <Table<PromptCatalogItem>
        rowKey="key"
        size="middle"
        // 全站没配 ConfigProvider locale，Table 内置文案默认是英文 Reset/OK；
        // 这是仓库里第一个带列筛选的表格，就地补中文，别让它露出英文按钮
        locale={{
          filterConfirm: '确定',
          filterReset: '重置',
          ...(sceneFilter ? { emptyText: '该场景没有绑定可编辑 prompt' } : {}),
        }}
        columns={columns}
        dataSource={filteredItems}
        loading={catalogQuery.isLoading}
        pagination={false}
      />

      <Drawer
        title={
          selectedKey ? (
            <span>
              提示词详情{' '}
              <Typography.Text code style={{ fontSize: 13 }}>
                {selectedKey}
              </Typography.Text>
            </span>
          ) : undefined
        }
        open={selectedKey !== null}
        onClose={() => setQuery({ key: null }, { replace: true })}
        width={900}
        // antd 6 改名：关闭即销毁编辑器，不留上一个 prompt 的状态
        destroyOnHidden
      >
        {selectedKey &&
          (items.some((i) => i.key === selectedKey) ? (
            <PromptEditor
              promptKey={selectedKey}
              env={env}
              writable={writable}
              disabledReason={disabledReason}
              confirmCodeHint={meta?.publishConfirmCode ?? ''}
            />
          ) : catalogQuery.isLoading ? null : (
            // ?key= 现在可分享，就会有人拿着下线 prompt 的旧链接进来；
            // 给一句人话，别让他对着一个空抽屉猜
            <Alert
              type="warning"
              showIcon
              message={
                selectedKey.startsWith('persona_')
                  ? '该角色尚未创建人设'
                  : '目录里没有这个 prompt'
              }
              description={
                selectedKey.startsWith('persona_')
                  ? `${selectedKey} 尚未生成；在音色管理新增角色后会自动创建，或链接来自旧版本。`
                  : `${selectedKey} 可能已下线，或链接来自旧版本。`
              }
            />
          ))}
      </Drawer>
    </div>
  )
}
