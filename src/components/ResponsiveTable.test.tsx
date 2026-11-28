import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ColumnsType } from 'antd/es/table'
import { Tag } from 'antd'
import { setViewportWidth } from '../test/viewport'
import ResponsiveTable from './ResponsiveTable'

interface Row {
  id: string
  name: string
  status: string
  note?: string
}

const COLUMNS: ColumnsType<Row> = [
  { title: '名称', dataIndex: 'name' },
  {
    title: '状态',
    dataIndex: 'status',
    render: (value) => <Tag>{String(value)}</Tag>,
  },
  // 低优先级列：手机上不出现（桌面保留）
  { title: '备注', dataIndex: 'note', responsive: ['md'] },
]

function makeRows(count: number): Row[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `r-${i + 1}`,
    name: `名称${i + 1}`,
    status: i % 2 === 0 ? '正常' : '异常',
    note: `备注${i + 1}`,
  }))
}

function renderMobile(props: Parameters<typeof ResponsiveTable<Row>>[0]) {
  act(() => setViewportWidth(375))
  return render(<ResponsiveTable<Row> {...props} />)
}

/**
 * 手机端表格卡片化：表格在 375 宽只能横向滚动，读一列要来回拖；
 * 卡片把一行摊成「标题 + 字段行」，信息不减少，只是换成纵向阅读。
 * 桌面端必须仍是原样的 Table（既有 100+ 用例都建立在表格 DOM 上）。
 */
describe('ResponsiveTable 形态切换', () => {
  it('桌面渲染原表格', () => {
    render(
      <ResponsiveTable<Row>
        rowKey="id"
        columns={COLUMNS}
        dataSource={makeRows(2)}
        pagination={false}
      />,
    )

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.queryByTestId('mobile-cards')).toBeNull()
  })

  it('手机渲染卡片：第一列作标题，其余列成为字段行', () => {
    renderMobile({
      rowKey: 'id',
      columns: COLUMNS,
      dataSource: makeRows(2),
      pagination: false,
    })

    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByTestId('mobile-cards')).toBeInTheDocument()
    expect(screen.getAllByTestId('card-r-1').length).toBe(1)
    // 标题列的文字同时出现在标题与字段行里：取卡片内断言，不数全局次数
    const card = screen.getByTestId('card-r-1')
    expect(within(card).getAllByText('名称1').length).toBeGreaterThanOrEqual(1)
    // render() 的产物（Tag）照常渲染
    expect(within(card).getByText('正常')).toBeInTheDocument()
    // responsive:['md'] 的列在手机上整列跳过
    expect(within(card).queryByText('备注1')).toBeNull()
  })

  it('cardTitle 覆盖默认标题（第一列只作为字段行）', () => {
    renderMobile({
      rowKey: 'id',
      columns: COLUMNS,
      dataSource: makeRows(1),
      pagination: false,
      cardTitle: (record) => <span>设备 {record.id}</span>,
    })

    const card = screen.getByTestId('card-r-1')
    expect(within(card).getByText('设备 r-1')).toBeInTheDocument()
  })

  it('column.render 收到 (value, record, index)', () => {
    const renderSpy = vi.fn((value: unknown) => <span>{String(value)}</span>)
    renderMobile({
      rowKey: 'id',
      columns: [
        { title: '名称', dataIndex: 'name' },
        { title: '状态', dataIndex: 'status', render: renderSpy },
      ],
      dataSource: makeRows(2),
      pagination: false,
    })

    expect(renderSpy).toHaveBeenCalledWith('正常', expect.objectContaining({ id: 'r-1' }), 0)
    expect(renderSpy).toHaveBeenCalledWith('异常', expect.objectContaining({ id: 'r-2' }), 1)
  })

  it('内部翻页：默认每页 10 条，翻页后只剩第二页', async () => {
    renderMobile({
      rowKey: 'id',
      columns: COLUMNS,
      dataSource: makeRows(12),
      pagination: {},
    })

    expect(screen.getAllByTestId(/^card-r-/)).toHaveLength(10)

    const pageItem = screen.getByTitle('2')
    await userEvent.click(within(pageItem).getByText('2'))

    expect(screen.getAllByTestId(/^card-r-/)).toHaveLength(2)
  })

  it('受控分页（total + current）：不自行切片，交给服务端', () => {
    renderMobile({
      rowKey: 'id',
      columns: COLUMNS,
      dataSource: makeRows(3),
      pagination: { current: 2, pageSize: 10, total: 23 },
    })

    expect(screen.getAllByTestId(/^card-r-/)).toHaveLength(3)
    expect(screen.getByText(/共 23 条/)).toBeInTheDocument()
  })

  it('点卡片触发行点击（列表页靠它开详情抽屉）', async () => {
    const onClick = vi.fn()
    renderMobile({
      rowKey: 'id',
      columns: COLUMNS,
      dataSource: makeRows(1),
      pagination: false,
      onRow: () => ({ onClick }),
    })

    await userEvent.click(screen.getByTestId('card-r-1'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('空数据渲染空态文案，不再画一张空卡片列表', () => {
    renderMobile({
      rowKey: 'id',
      columns: COLUMNS,
      dataSource: [],
      pagination: false,
      locale: { emptyText: '没有匹配的消息' },
    })

    expect(screen.getByText('没有匹配的消息')).toBeInTheDocument()
    expect(screen.queryAllByTestId(/^card-r-/)).toHaveLength(0)
  })

  it('可展开表格：卡片里给「展开详情」，展开后渲染明细', async () => {
    renderMobile({
      rowKey: 'id',
      columns: COLUMNS,
      dataSource: makeRows(1),
      pagination: false,
      expandable: {
        expandedRowRender: (record) => <div>明细-{record.id}</div>,
      },
    })

    expect(screen.queryByText('明细-r-1')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: '展开详情' }))
    expect(screen.getByText('明细-r-1')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '收起详情' }))
    expect(screen.queryByText('明细-r-1')).toBeNull()
  })

  it('列筛选：手机上以 Select 复现（表格列头的漏斗在卡片里没有位置）', async () => {
    renderMobile({
      rowKey: 'id',
      columns: [
        { title: '名称', dataIndex: 'name' },
        {
          title: '状态',
          dataIndex: 'status',
          filters: [{ text: '只看异常', value: '异常' }],
          onFilter: (value, record) => record.status === value,
        },
      ],
      dataSource: makeRows(3),
      pagination: false,
    })

    expect(screen.getAllByTestId(/^card-r-/)).toHaveLength(3)

    await userEvent.click(screen.getByRole('combobox'))
    await userEvent.click(await screen.findByTitle('只看异常'))

    expect(screen.getAllByTestId(/^card-r-/)).toHaveLength(1)
  })

  it('桌面未传 scroll：不给表格加横向滚动，度量与改动前一致', () => {
    render(
      <ResponsiveTable<Row>
        rowKey="id"
        columns={COLUMNS}
        dataSource={makeRows(2)}
        pagination={false}
      />,
    )

    const content = document.querySelector('.ant-table-content') as HTMLElement
    expect(content.style.overflowX).not.toBe('auto')
  })

  it('调用方传了 scroll 时以调用方为准', () => {
    render(
      <ResponsiveTable<Row>
        rowKey="id"
        columns={COLUMNS}
        dataSource={makeRows(2)}
        pagination={false}
        scroll={{ x: 1200 }}
      />,
    )

    const table = document.querySelector('.ant-table-content table') as HTMLElement
    expect(table.style.width).toBe('1200px')
  })

  it('平板宽度（900）仍是表格，未传 scroll 时默认横向滚动', () => {
    act(() => setViewportWidth(900))
    render(
      <ResponsiveTable<Row>
        rowKey="id"
        columns={COLUMNS}
        dataSource={makeRows(2)}
        pagination={false}
      />,
    )

    expect(screen.getByRole('table')).toBeInTheDocument()
    const content = document.querySelector('.ant-table-content') as HTMLElement
    expect(content.style.overflowX).toBe('auto')
    expect(document.querySelector('.ant-table-content table')).toHaveStyle(
      'width: max-content',
    )
  })

  it('分组表头（列有 children）无法摊平，退回横向滚动表格', () => {
    renderMobile({
      rowKey: 'id',
      columns: [
        {
          title: '合并',
          children: [{ title: '名称', dataIndex: 'name' }],
        },
      ] as ColumnsType<Row>,
      dataSource: makeRows(1),
      pagination: false,
    })

    expect(screen.getByRole('table')).toBeInTheDocument()
    const content = document.querySelector('.ant-table-content') as HTMLElement
    expect(content.style.overflowX).toBe('auto')
  })
})

/**
 * 卡片渲染的边角分支：嵌套 dataIndex、标题不是字符串、字段缺值、
 * rowKey 的三种写法。都是真实表格里出现过的形态（设备档案嵌套对象、
 * Prompts 的状态列无 dataIndex、失败明细的 rowKey 是函数等）。
 */
describe('ResponsiveTable 卡片字段解析', () => {
  it('嵌套 dataIndex 能读到值，中途缺值不报错', () => {
    interface NestedRow {
      id: string
      device?: { code?: string }
    }
    const rows: NestedRow[] = [{ id: 'n-1', device: { code: 'D001' } }, { id: 'n-2' }]

    act(() => setViewportWidth(375))
    render(
      <ResponsiveTable<NestedRow>
        rowKey="id"
        columns={[
          { title: 'ID', dataIndex: 'id' },
          { title: '设备码', dataIndex: ['device', 'code'] },
          { title: '深路径', dataIndex: ['device', 'missing', 'x'] },
        ]}
        dataSource={rows}
        pagination={false}
      />,
    )

    expect(within(screen.getByTestId('card-n-1')).getByText('D001')).toBeInTheDocument()
    // 缺值渲染成空，不抛错
    expect(screen.getByTestId('card-n-2')).toBeInTheDocument()
  })

  it('没有 dataIndex 与 key 的列用标题当键；标题不是字符串时回落 column', () => {
    renderMobile({
      rowKey: 'id',
      columns: [
        { title: '名称', dataIndex: 'name' },
        { title: <span>状态标签</span>, render: () => <span>自定义</span> },
      ],
      dataSource: makeRows(1),
      pagination: false,
    })

    const card = screen.getByTestId('card-r-1')
    expect(within(card).getByText('状态标签')).toBeInTheDocument()
    expect(within(card).getByText('自定义')).toBeInTheDocument()
  })

  it('rowKey 是函数时按函数取键，缺省时用行下标', () => {
    renderMobile({
      rowKey: (record: Row) => `fn-${record.id}`,
      columns: COLUMNS,
      dataSource: makeRows(1),
      pagination: false,
    })
    expect(screen.getByTestId('card-fn-r-1')).toBeInTheDocument()

    renderMobile({
      columns: COLUMNS,
      dataSource: makeRows(1),
      pagination: false,
    })
    expect(screen.getByTestId('card-0')).toBeInTheDocument()
  })

  it('字段值为 null 且没有 render 时留空单元格', () => {
    renderMobile({
      rowKey: 'id',
      columns: [
        { title: '名称', dataIndex: 'name' },
        { title: '备注', dataIndex: 'note' },
      ],
      dataSource: [{ id: 'r-9', name: '九', status: '正常' }],
      pagination: false,
    })

    const card = screen.getByTestId('card-r-9')
    // 第一列作为卡片标题
    expect(within(card).getByText('九')).toBeInTheDocument()
    // 其余列作为字段行；值为空只渲染字段名
    expect(within(card).getByText('备注')).toBeInTheDocument()
  })
})
