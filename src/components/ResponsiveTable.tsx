import { useState } from 'react'
import type { Key, MouseEvent, ReactNode } from 'react'
import { Button, Card, Empty, Pagination, Select, Space, Spin, Table } from 'antd'
import type { TableProps } from 'antd'
import type { ColumnsType, ColumnType } from 'antd/es/table'
import { useLayoutMode } from '../utils/use-layout-mode'

export interface ResponsiveTableProps<RowType extends object>
  extends TableProps<RowType> {
  /** 手机卡片标题；缺省用第一列（跳过 responsive 隐藏列）的渲染值 */
  cardTitle?: (record: RowType, index: number) => ReactNode
}

/**
 * 手机卡片化的表格。
 *
 * 桌面（≥768）原样渲染 antd Table，一行不改；手机（<768）把每行摊成一张卡片：
 * 第一列作标题（可用 cardTitle 覆盖），其余列变成「字段名 / 值」两栏。
 * 375 宽下横向滚动表格一次只能读一列，卡片把一行读完整。
 *
 * 三条边界，都是刻意的：
 * 1. 分组表头（列有 children）无法摊平，手机上也用带横向滚动的 Table——
 *    摊平会丢掉表头层级，宁可滚动也别改语义。
 * 2. 列筛选在卡片里没有漏斗的位置，改成卡片上方一排 Select，用列自带的
 *    onFilter 在前端过滤；服务端筛选（onChange 里发请求）不在此列。
 * 3. 分页：`pagination.total` 存在说明总条数由服务端给，此时不自行切片；
 *    否则按 current/pageSize 在本地切片。排序（sorter）不搬进卡片，桌面保留。
 */
export default function ResponsiveTable<RowType extends object>(
  props: ResponsiveTableProps<RowType>,
) {
  const mode = useLayoutMode()
  // 平板（768–991）默认给横向滚动：图标栏占掉 64px 后正文只有 ~650px，
  // 列多的表格会不再换行而是把每列压成竖排文字。max-content + min-width:100%
  // 在放得下时与原来完全一致；桌面档不强行加，避免改变现有的表格度量。
  const scroll =
    props.scroll ?? (mode === 'tablet' ? { x: 'max-content' as const } : undefined)
  if (mode !== 'mobile') return <Table<RowType> {...props} scroll={scroll} />
  return <MobileCards {...props} scroll={scroll} />
}

function columnKey<RowType>(column: ColumnType<RowType>): string {
  if (column.key != null) return String(column.key)
  const { dataIndex } = column
  if (Array.isArray(dataIndex)) return dataIndex.join('.')
  if (dataIndex != null) return String(dataIndex)
  return typeof column.title === 'string' ? column.title : 'column'
}

function readValue(record: unknown, dataIndex: unknown): unknown {
  if (dataIndex == null) return undefined
  const path = Array.isArray(dataIndex) ? dataIndex : [dataIndex]
  let current: unknown = record
  for (const key of path) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[String(key)]
  }
  return current
}

function renderCell<RowType extends object>(
  column: ColumnType<RowType>,
  record: RowType,
  index: number,
): ReactNode {
  const value = readValue(record, column.dataIndex)
  if (column.render) {
    // antd 的 render 既可能返回 ReactNode，也可能返回 { children, props }（合并单元格），
    // 卡片里没有合并概念，只取 ReactNode 的部分
    return column.render(value as never, record, index) as ReactNode
  }
  if (value == null) return null
  return value as ReactNode
}

function rowKeyOf<RowType extends object>(
  record: RowType,
  index: number,
  rowKey: TableProps<RowType>['rowKey'],
): Key {
  if (typeof rowKey === 'function') return rowKey(record)
  if (typeof rowKey === 'string') {
    const value = (record as unknown as Record<string, Key>)[rowKey]
    return value ?? index
  }
  return index
}

function isGroupedColumn<RowType>(
  column: ColumnsType<RowType>[number],
): boolean {
  return 'children' in column && Boolean(column.children?.length)
}

function MobileCards<RowType extends object>({
  columns = [],
  dataSource = [],
  rowKey,
  loading,
  locale,
  pagination = {},
  onRow,
  expandable,
  cardTitle,
  ...tableProps
}: ResponsiveTableProps<RowType>) {
  const [filterValues, setFilterValues] = useState<Record<string, Key | boolean>>(
    {},
  )
  const [innerPage, setInnerPage] = useState(1)
  const [openKeys, setOpenKeys] = useState<Set<Key>>(() => new Set())

  if (columns.some(isGroupedColumn)) {
    return (
      <Table<RowType>
        {...tableProps}
        columns={columns}
        dataSource={dataSource}
        rowKey={rowKey}
        loading={loading}
        locale={locale}
        pagination={pagination}
        onRow={onRow}
        expandable={expandable}
        scroll={tableProps.scroll ?? { x: 'max-content' }}
      />
    )
  }

  const flatColumns = columns as ColumnType<RowType>[]
  // 手机上隐藏低优先级列：列自己的 responsive 声明就是干这个的
  const visibleColumns = flatColumns.filter(
    (column) => !column.responsive || column.responsive.includes('xs'),
  )
  const titleColumn = cardTitle ? undefined : visibleColumns[0]
  const bodyColumns = titleColumn ? visibleColumns.slice(1) : visibleColumns

  const filterable = visibleColumns.filter(
    (column) =>
      Array.isArray(column.filters) &&
      column.filters.length > 0 &&
      column.onFilter != null &&
      !column.filterDropdown,
  )

  const rows = [...(dataSource ?? [])]
  const filteredRows = filterable.reduce<RowType[]>((acc, column) => {
    const value = filterValues[columnKey(column)]
    if (value === undefined) return acc
    return acc.filter((record) => Boolean(column.onFilter?.(value, record)))
  }, rows)

  const pager = pagination === false ? undefined : pagination
  const pageSize = pager?.pageSize ?? 10
  // total 由服务端给 = 分页在服务端做，这里不能再切一刀
  const serverPaged = pager?.total !== undefined
  const currentPage = pager?.current ?? innerPage
  const total = serverPaged ? (pager?.total ?? 0) : filteredRows.length
  const pageRows = serverPaged
    ? filteredRows
    : filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const handlePageChange = (page: number, size: number) => {
    pager?.onChange?.(page, size)
    if (pager?.current === undefined) setInnerPage(page)
  }

  const toggleExpand = (key: Key) => {
    setOpenKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const canExpand = expandable?.expandedRowRender != null

  return (
    <div data-testid="mobile-cards">
      {filterable.length > 0 && (
        <Space wrap style={{ marginBottom: 12 }}>
          {filterable.map((column) => {
            const filterKey = columnKey(column)
            return (
              <Select<Key>
                key={filterKey}
                allowClear
                size="small"
                style={{ minWidth: 140 }}
                placeholder={
                  typeof column.title === 'string'
                    ? `筛选${column.title}`
                    : '筛选'
                }
                value={filterValues[filterKey] as Key | undefined}
                options={(column.filters ?? []).map((filter) => ({
                  label: filter.text as ReactNode,
                  value: filter.value as string | number,
                }))}
                onChange={(value) =>
                  setFilterValues((prev) => ({
                    ...prev,
                    [filterKey]: value,
                  }))
                }
              />
            )
          })}
        </Space>
      )}
      <Spin spinning={Boolean(loading)}>
        {pageRows.length === 0 ? (
          <Empty
            description={
              (locale?.emptyText ?? '暂无数据') as unknown as ReactNode
            }
          />
        ) : (
          pageRows.map((record, index) => {
            const key = rowKeyOf(record, index, rowKey)
            const rowProps = onRow?.(record, index)
            const interactive = rowProps?.onClick != null
            const expanded = openKeys.has(key)
            const expandableRow =
              canExpand && (expandable?.rowExpandable?.(record) ?? true)
            return (
              <Card
                key={String(key)}
                size="small"
                data-testid={`card-${String(key)}`}
                hoverable={interactive}
                style={{
                  marginBottom: 12,
                  cursor: interactive ? 'pointer' : undefined,
                }}
                title={
                  cardTitle
                    ? cardTitle(record, index)
                    : titleColumn
                      ? renderCell(titleColumn, record, index)
                      : null
                }
                onClick={
                  rowProps?.onClick as
                    | ((event: MouseEvent<HTMLDivElement>) => void)
                    | undefined
                }
              >
                <dl style={{ margin: 0 }}>
                  {bodyColumns.map((column) => (
                    <div
                      key={columnKey(column)}
                      style={{
                        display: 'flex',
                        gap: 8,
                        alignItems: 'flex-start',
                        padding: '2px 0',
                      }}
                    >
                      <dt
                        style={{
                          flex: '0 0 72px',
                          color: '#8c8c8c',
                          fontSize: 12,
                          lineHeight: '22px',
                        }}
                      >
                        {column.title as unknown as ReactNode}
                      </dt>
                      <dd
                        style={{
                          margin: 0,
                          flex: 1,
                          minWidth: 0,
                          wordBreak: 'break-word',
                        }}
                      >
                        {renderCell(column, record, index)}
                      </dd>
                    </div>
                  ))}
                </dl>
                {expandableRow && (
                  <>
                    <Button
                      type="link"
                      size="small"
                      style={{ paddingInline: 0 }}
                      onClick={(event) => {
                        // 卡片本身可能挂着「打开详情」，展开明细不该顺带触发它
                        event.stopPropagation()
                        toggleExpand(key)
                      }}
                    >
                      {expanded ? '收起详情' : '展开详情'}
                    </Button>
                    {expanded &&
                      expandable?.expandedRowRender?.(record, index, 0, true)}
                  </>
                )}
              </Card>
            )
          })
        )}
      </Spin>
      {pager != null && total > pageSize && (
        <Pagination
          size="small"
          style={{ marginTop: 12, textAlign: 'center' }}
          current={currentPage}
          pageSize={pageSize}
          total={total}
          showSizeChanger={false}
          showTotal={(count) => `共 ${count} 条`}
          onChange={handlePageChange}
        />
      )}
    </div>
  )
}
