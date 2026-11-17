import { useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Descriptions,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { UploadOutlined } from '@ant-design/icons'
import type { ApiError } from '../../api/client'
import {
  useAdventureAuthoring,
  useAdventureEpisodes,
  useAdventureExport,
  useAdventureImport,
  useAdventureImportPreview,
} from '../../api/queries'
import type {
  AdventureBundle,
  ExportResult,
  ImportEpisodePlan,
  ImportPreview,
} from '../../types/adventureAdmin'
import ReasonDialog from './ReasonDialog'
import SegmentDiffList from './SegmentDiffList'
import { importActionMeta, shortHash } from './labels'

/**
 * 跨环境搬运：staging 验证过的整份配置 → prod 新增或替换。
 *
 * 这一页是「prod 不允许随手改内容」的配套出口。prod 是只读环境，内容只能在
 * staging 写好、试播过、发布过，再整包搬过去，所以搬运必须比编辑更重：
 *
 * - **导出只取已发布快照**，草稿不进 bundle（草稿是未审的半成品，搬它等于绕过校验）；
 *   导出会落一条审计，因此只读环境也不能导出。
 * - **导入先 dry-run**：服务端重新解析、重算哈希、逐集给出 add / replace /
 *   already_up_to_date / reject 的计划，并把差异摊开给人看。
 * - **导入要手输确认码**（bundle 内容哈希前 12 位）+ 理由 + 回传预览时的哈希，
 *   三道闸任一不过整批不写。
 * - **导入只落草稿，永不自动发布。** 目标环境必须逐集人工确认后再发布——
 *   「搬过去就生效」是这套机制里最不该出现的一条捷径。
 *
 * 有一件事必须写在这里：目标集若存在别人未发布、内容又不同的本地草稿，
 * 服务端会在计划阶段直接判 reject（不静默覆盖同事的稿子），整批不写。
 */

function parseBundle(text: string): { bundle: AdventureBundle | null; error: string | null } {
  const trimmed = text.trim()
  if (trimmed === '') return { bundle: null, error: '还没有内容' }
  let raw: unknown
  try {
    raw = JSON.parse(trimmed)
  } catch (err) {
    return { bundle: null, error: `JSON 解析失败：${(err as Error).message}` }
  }
  const candidate = raw as Partial<AdventureBundle>
  if (
    typeof candidate !== 'object' ||
    candidate === null ||
    !Array.isArray(candidate.episodes)
  ) {
    return { bundle: null, error: '形状不对：顶层必须有 episodes 数组' }
  }
  return { bundle: candidate as AdventureBundle, error: null }
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function downloadJson(fileName: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

function ExportCard() {
  const authoring = useAdventureAuthoring()
  const episodesQuery = useAdventureEpisodes({
    pageSize: 200,
    includeRetired: true,
  })
  const episodes = episodesQuery.data?.items ?? []
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [includeRetired, setIncludeRetired] = useState(false)
  const exportMutation = useAdventureExport()
  const result: ExportResult | null = exportMutation.data ?? null
  const error = (exportMutation.error as ApiError | null) ?? null
  const [copied, setCopied] = useState(false)

  const bundleText = result ? JSON.stringify(result.bundle, null, 2) : ''

  return (
    <Card title="① 从本环境导出（只取已发布快照）" style={{ marginBottom: 16 }}>
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        <Typography.Text type="secondary">
          不选具体集就导出全部可导出的已发布集。导出会留一条 <Typography.Text code>export</Typography.Text>{' '}
          审计，所以只读环境下这一步会被拒（403）。
        </Typography.Text>

        <Space size={12} wrap>
          <Select
            mode="multiple"
            allowClear
            style={{ minWidth: 360 }}
            placeholder="指定故事集（留空 = 全部）"
            loading={episodesQuery.isLoading}
            value={selectedIds}
            onChange={(value) => setSelectedIds(value as string[])}
            optionFilterProp="label"
            options={episodes.map((row) => ({
              value: row.id,
              label: `${row.businessKey} · ${row.title || '（未填标题）'}${row.retiredAt ? ' · 已下架' : row.published ? '' : ' · 未发布'}`,
            }))}
          />
          <Checkbox
            checked={includeRetired}
            onChange={(event) => setIncludeRetired(event.target.checked)}
          >
            包含已下架的集
          </Checkbox>
          <Button
            type="primary"
            disabled={!authoring}
            loading={exportMutation.isPending}
            onClick={() => {
              setCopied(false)
              exportMutation.mutate({
                episodeIds: selectedIds.length > 0 ? selectedIds : undefined,
                includeRetired: includeRetired || undefined,
              })
            }}
          >
            导出 bundle
          </Button>
        </Space>

        {!authoring && (
          <Alert
            type="info"
            showIcon
            message="只读环境不能导出"
            description="导出会写审计，因此不在只读豁免名单里。请在 staging（authoring）导出。"
          />
        )}

        {error && (
          <Alert
            type="error"
            showIcon
            message="导出失败"
            description={
              <Space orientation="vertical" size={4}>
                <Typography.Text>{error.message}</Typography.Text>
                {error.domainCode && (
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    错误码 <Typography.Text code>{error.domainCode}</Typography.Text>
                  </Typography.Text>
                )}
              </Space>
            }
          />
        )}

        {result && (
          <>
            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="导出集数">
                {result.episodeCount}
              </Descriptions.Item>
              <Descriptions.Item label="被跳过">
                {result.skipped.length}
              </Descriptions.Item>
              <Descriptions.Item label="bundle 哈希">
                <Typography.Text code>{shortHash(result.bundleHash)}</Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="确认码（导入时要手输）">
                <Typography.Text code>{result.confirmToken}</Typography.Text>
              </Descriptions.Item>
            </Descriptions>

            {result.skipped.length > 0 && (
              <Alert
                type="warning"
                showIcon
                message="这些集没有被导出"
                description={
                  <Space orientation="vertical" size={2}>
                    {result.skipped.map((item) => (
                      <Typography.Text key={item.businessKey} style={{ fontSize: 12 }}>
                        <Typography.Text code>{item.businessKey}</Typography.Text>：{item.reason}
                      </Typography.Text>
                    ))}
                  </Space>
                }
              />
            )}

            <Space size={8} wrap>
              <Button
                onClick={async () => setCopied(await copyText(bundleText))}
              >
                {copied ? '已复制到剪贴板' : '复制 JSON'}
              </Button>
              <Button
                onClick={() =>
                  downloadJson(
                    `adventure-bundle-${result.bundle.episodes.length}集.json`,
                    bundleText,
                  )
                }
              >
                下载 JSON
              </Button>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                把这份 JSON 拿到目标环境的「导入」里粘贴。哈希只由内容决定，不含导出时间与来源环境，
                所以同一份内容在两个环境算出的哈希一致。
              </Typography.Text>
            </Space>

            {!copied && (
              <Input.TextArea
                rows={6}
                value={bundleText}
                readOnly
                onFocus={(event) => event.target.select()}
                style={{ fontFamily: 'monospace', fontSize: 12 }}
              />
            )}
          </>
        )}
      </Space>
    </Card>
  )
}

const PLAN_COLUMNS: ColumnsType<ImportEpisodePlan> = [
  {
    title: '业务键',
    dataIndex: 'businessKey',
    key: 'businessKey',
    width: 130,
    render: (value: string) => <Typography.Text code>{value}</Typography.Text>,
  },
  {
    title: '动作',
    dataIndex: 'action',
    key: 'action',
    width: 110,
    render: (value: string) => {
      const meta = importActionMeta(value)
      return <Tag color={meta.color}>{meta.label}</Tag>
    },
  },
  {
    title: '导入内容哈希',
    key: 'incomingHash',
    width: 130,
    render: (_, row) => (
      <Typography.Text code style={{ fontSize: 12 }}>
        {shortHash(row.incomingHash)}
      </Typography.Text>
    ),
  },
  {
    title: '目标环境现有哈希',
    key: 'existingHash',
    width: 140,
    render: (_, row) =>
      row.existingHash ? (
        <Typography.Text code style={{ fontSize: 12 }}>
          {shortHash(row.existingHash)}
        </Typography.Text>
      ) : (
        <Typography.Text type="secondary">—（新集）</Typography.Text>
      ),
  },
  {
    title: '说明 / 拒绝原因',
    dataIndex: 'reason',
    key: 'reason',
    render: (value: string | undefined) =>
      value ? value : <Typography.Text type="secondary">—</Typography.Text>,
  },
]

function ImportCard() {
  const authoring = useAdventureAuthoring()
  const [raw, setRaw] = useState('')
  const [parseError, setParseError] = useState<string | null>(null)
  const [bundle, setBundle] = useState<AdventureBundle | null>(null)
  const previewMutation = useAdventureImportPreview()
  const importMutation = useAdventureImport()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const preview: ImportPreview | null = previewMutation.data ?? null
  const previewError = (previewMutation.error as ApiError | null) ?? null
  const importError = (importMutation.error as ApiError | null) ?? null
  const imported = importMutation.data ?? null

  function loadText(text: string) {
    setRaw(text)
    setBundle(null)
    setParseError(null)
    // 内容变了，上一次预览立刻作废：确认码是绑定在那一份 bundle 上的
    previewMutation.reset()
    importMutation.reset()
    const parsed = parseBundle(text)
    if (parsed.error !== null && text.trim() !== '') {
      setParseError(parsed.error)
      return
    }
    if (parsed.bundle !== null) setBundle(parsed.bundle)
  }

  const rejects = preview?.plan.items.filter((item) => item.action === 'reject') ?? []

  return (
    <Card title="② 导入到本环境（先 dry-run，再手输确认码）">
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          message="导入只落草稿，永不自动发布"
          description="导入完成后请到「故事集」里逐集校验、试播，再显式发布。目标环境若存在别人未发布、内容又不同的草稿，这一集会被判 reject，整批不写。"
        />

        <Space size={8} wrap>
          <Upload
            accept="application/json,.json"
            showUploadList={false}
            beforeUpload={(file) => {
              void file.text().then((text) => loadText(text))
              // 返回 false：不真的上传，只在浏览器里读文件内容
              return false
            }}
          >
            <Button icon={<UploadOutlined />}>选择 JSON 文件</Button>
          </Upload>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            或直接把 bundle 粘到下面
          </Typography.Text>
        </Space>

        <Input.TextArea
          rows={8}
          value={raw}
          onChange={(event) => loadText(event.target.value)}
          placeholder='{"bundleSchemaVersion":1,"exportedAt":"…","sourceProfile":"authoring","episodes":[…]}'
          style={{ fontFamily: 'monospace', fontSize: 12 }}
        />

        {parseError && (
          <Alert type="error" showIcon message="bundle 无法解析" description={parseError} />
        )}

        <Space size={8} wrap>
          <Button
            type="primary"
            disabled={bundle === null || !authoring}
            loading={previewMutation.isPending}
            onClick={() => {
              if (bundle === null) return
              importMutation.reset()
              previewMutation.mutate(bundle)
            }}
          >
            预览（dry-run，不写库）
          </Button>
          {preview && (
            <Button
              danger
              disabled={!authoring || !preview.plan.ok || preview.parseErrors.length > 0}
              onClick={() => setConfirmOpen(true)}
            >
              确认导入…
            </Button>
          )}
        </Space>

        {previewError && (
          <Alert
            type="error"
            showIcon
            message="预览失败"
            description={
              <Space orientation="vertical" size={4}>
                <Typography.Text>{previewError.message}</Typography.Text>
                {previewError.domainCode && (
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    错误码 <Typography.Text code>{previewError.domainCode}</Typography.Text>
                  </Typography.Text>
                )}
              </Space>
            }
          />
        )}

        {preview && (
          <>
            {preview.parseErrors.length > 0 && (
              <Alert
                type="error"
                showIcon
                message="bundle 本身不合法，导入会被整批拒绝"
                description={
                  <Space orientation="vertical" size={2}>
                    {preview.parseErrors.map((item) => (
                      <Typography.Text key={item} style={{ fontSize: 12 }}>
                        {item}
                      </Typography.Text>
                    ))}
                  </Space>
                }
              />
            )}
            {preview.parseWarnings.length > 0 && (
              <Alert
                type="warning"
                showIcon
                message="bundle 有警告（不拦导入，但请确认是预期的）"
                description={
                  <Space orientation="vertical" size={2}>
                    {preview.parseWarnings.map((item) => (
                      <Typography.Text key={item} style={{ fontSize: 12 }}>
                        {item}
                      </Typography.Text>
                    ))}
                  </Space>
                }
              />
            )}

            <Descriptions size="small" column={4} bordered>
              <Descriptions.Item label="新增">{preview.plan.adds}</Descriptions.Item>
              <Descriptions.Item label="替换">{preview.plan.replaces}</Descriptions.Item>
              <Descriptions.Item label="已一致">
                {preview.plan.upToDate}
              </Descriptions.Item>
              <Descriptions.Item label="拒绝">
                <Typography.Text type={preview.plan.rejects > 0 ? 'danger' : undefined}>
                  {preview.plan.rejects}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="bundle 哈希" span={2}>
                <Typography.Text code>{shortHash(preview.bundleHash)}</Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="确认码" span={2}>
                <Typography.Text code>{preview.confirmToken}</Typography.Text>
              </Descriptions.Item>
            </Descriptions>

            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              确认码要在导入时原样手输，不提供复制按钮——手输一遍就是这一步的全部意义。
            </Typography.Text>

            <Typography.Text>{preview.message}</Typography.Text>

            {rejects.length > 0 && (
              <Alert
                type="error"
                showIcon
                message="计划里有 reject，整批不会写入"
                description="先在来源环境把这些问题修掉、重新导出，再来一次。服务端不接受「跳过坏的、导入好的」——那会让两个环境的内容悄悄分叉。"
              />
            )}

            <Table
              columns={PLAN_COLUMNS}
              dataSource={preview.plan.items}
              rowKey={(row) => row.businessKey}
              size="small"
              pagination={false}
              expandable={{
                rowExpandable: (row) =>
                  row.diff !== undefined && row.diff.segmentDiffs.length > 0,
                expandedRowRender: (row) =>
                  row.diff ? (
                    <SegmentDiffList
                      diffs={row.diff.segmentDiffs}
                      emptyText="逐段一致"
                    />
                  ) : null,
              }}
            />
          </>
        )}

        {importError && (
          <Alert
            type="error"
            showIcon
            message="导入失败，整批未写入"
            description={
              <Space orientation="vertical" size={4}>
                <Typography.Text>{importError.message}</Typography.Text>
                {importError.domainCode && (
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    错误码 <Typography.Text code>{importError.domainCode}</Typography.Text>
                    {importError.domainCode === 'BUNDLE_HASH_MISMATCH'
                      ? ' · 你预览的那一份和提交的那一份不是同一个 bundle。请重新预览。'
                      : ''}
                  </Typography.Text>
                )}
              </Space>
            }
          />
        )}

        {imported && (
          <Alert
            type="success"
            showIcon
            message={`导入完成：写入 ${imported.written.length} 集草稿`}
            description={
              <Space orientation="vertical" size={4}>
                <Typography.Text>{imported.message}</Typography.Text>
                {imported.written.map((item) => (
                  <Typography.Text key={item.businessKey} style={{ fontSize: 12 }}>
                    <Typography.Text code>{item.businessKey}</Typography.Text>：
                    {item.action === 'add' ? '新增' : '替换'}为 v{item.version}（草稿）
                  </Typography.Text>
                ))}
              </Space>
            }
          />
        )}
      </Space>

      {preview && (
        <ReasonDialog
          key={preview.confirmToken}
          open={confirmOpen}
          title="确认导入这一批内容"
          okText="确认导入"
          danger
          pending={importMutation.isPending}
          error={importError}
          confirmText={preview.confirmToken}
          confirmLabel="导入确认码"
          onCancel={() => setConfirmOpen(false)}
          description={
            <Space orientation="vertical" size={8} style={{ width: '100%' }}>
              <Typography.Text>
                将写入 <Typography.Text strong>{preview.plan.adds}</Typography.Text> 集新增、
                <Typography.Text strong>{preview.plan.replaces}</Typography.Text> 集替换，
                全部**只落草稿**，不会自动发布，孩子不会立刻听到任何变化。
              </Typography.Text>
              <Typography.Text type="secondary">
                替换会覆盖目标环境这一集的草稿。若那一集有同事未发布的改动，
                预览阶段就已经判 reject 了——所以走到这一步说明目标草稿要么不存在、要么内容与本次导入一致。
              </Typography.Text>
            </Space>
          }
          onSubmit={({ reason, confirmText }) => {
            if (bundle === null) return
            importMutation.mutate(
              {
                bundle,
                reason,
                confirmText: confirmText ?? '',
                expectedBundleHash: preview.bundleHash,
              },
              {
                onSuccess: () => {
                  setConfirmOpen(false)
                  // 导入成功后这份 bundle 已经落地，预览与确认码一起作废，防止重复提交
                  previewMutation.reset()
                  setBundle(null)
                  setRaw('')
                },
              },
            )
          }}
        />
      )}
    </Card>
  )
}

export default function ImportExport() {
  return (
    <Space orientation="vertical" size={0} style={{ width: '100%' }}>
      <ExportCard />
      <ImportCard />
    </Space>
  )
}
