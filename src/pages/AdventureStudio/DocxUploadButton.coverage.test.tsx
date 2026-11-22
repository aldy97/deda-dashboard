import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import DocxUploadButton from './DocxUploadButton'
import { useAdventureScriptConvert } from '../../api/queries'
import type { ScriptConvertResult } from '../../types/adventureAdmin'

vi.mock('../../api/queries', () => ({
  useAdventureScriptConvert: vi.fn(),
}))

afterEach(() => {
  vi.unstubAllGlobals()
})

const mockConvert = useAdventureScriptConvert as unknown as ReturnType<typeof vi.fn>

const converted: ScriptConvertResult = {
  content: {
    title: '从 docx 来的标题',
    recap: null,
    segments: [{ order: 0, kind: 'narration', text: '第一段' }],
  },
  characterKey: 'elly',
  characterDetected: true,
  season: 1,
  episodeNumber: 1,
  sourceText: '正文',
  lint: { ok: true, issues: [], errors: [], warnings: [] },
}

function convertHook(overrides: Record<string, unknown> = {}) {
  return {
    mutate: vi.fn(),
    reset: vi.fn(),
    isPending: false,
    error: null,
    ...overrides,
  }
}

async function selectFile(name = 'script.docx') {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  const file = new File(['hello'], name, {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
  fireEvent.change(input, { target: { files: [file] } })
  return file
}

describe('DocxUploadButton', () => {
  it('默认文案是「从 docx 填充」，并支持自定义文案', () => {
    const hook = convertHook()
    mockConvert.mockReturnValue(hook)

    const { rerender } = render(<DocxUploadButton onConverted={vi.fn()} />)
    expect(screen.getByRole('button', { name: /从 docx 填充/ })).toBeTruthy()

    rerender(<DocxUploadButton onConverted={vi.fn()} buttonText="导入稿子" />)
    expect(screen.getByRole('button', { name: /导入稿子/ })).toBeTruthy()
  })

  it('选完文件后转 base64 调转换接口，成功时把整份结果上报', async () => {
    const onConverted = vi.fn()
    const hook = convertHook({
      mutate: vi.fn((_payload, options: { onSuccess: (r: ScriptConvertResult) => void }) => {
        options.onSuccess(converted)
      }),
    })
    mockConvert.mockReturnValue(hook)

    render(<DocxUploadButton onConverted={onConverted} />)
    await selectFile()

    await waitFor(() => expect(hook.mutate).toHaveBeenCalledTimes(1))
    const payload = hook.mutate.mock.calls[0][0] as {
      fileName: string
      contentBase64: string
    }
    expect(payload.fileName).toBe('script.docx')
    expect(payload.contentBase64).toBe('aGVsbG8=')
    expect(onConverted).toHaveBeenCalledWith(converted)
    expect(screen.getByText('script.docx')).toBeTruthy()
  })

  it('再选一次文件会先清掉上一次的转换错误', async () => {
    const hook = convertHook()
    mockConvert.mockReturnValue(hook)

    render(<DocxUploadButton onConverted={vi.fn()} />)
    await selectFile('first.docx')

    await waitFor(() => expect(hook.reset).toHaveBeenCalled())
  })

  it('读不了本地文件时只显示读取错误，不打转换接口', async () => {
    class FailingReader {
      result: string | null = null
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      readAsDataURL() {
        this.onerror?.()
      }
    }
    vi.stubGlobal('FileReader', FailingReader)
    const hook = convertHook()
    mockConvert.mockReturnValue(hook)

    render(<DocxUploadButton onConverted={vi.fn()} />)
    await selectFile('broken.docx')

    await waitFor(() => expect(screen.getByText('读取文件失败')).toBeTruthy())
    expect(hook.mutate).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('转换失败时显示服务端消息与领域码', () => {
    mockConvert.mockReturnValue(
      convertHook({
        error: {
          status: 400,
          message: '文档里没有可识别的内容',
          domainCode: 'SCRIPT_UNPARSEABLE',
        },
      }),
    )

    render(<DocxUploadButton onConverted={vi.fn()} />)
    expect(
      screen.getByText('转换失败：文档里没有可识别的内容（SCRIPT_UNPARSEABLE）'),
    ).toBeTruthy()
  })

  it('转换失败但没有领域码时只显示消息', () => {
    mockConvert.mockReturnValue(
      convertHook({ error: { status: 500, message: 'LLM 超时', domainCode: null } }),
    )

    render(<DocxUploadButton onConverted={vi.fn()} />)
    expect(screen.getByText('转换失败：LLM 超时')).toBeTruthy()
  })

  it('转换在飞时按钮转圈', () => {
    mockConvert.mockReturnValue(convertHook({ isPending: true }))
    render(<DocxUploadButton onConverted={vi.fn()} />)
    expect(screen.getByRole('button', { name: /从 docx 填充/ }).className).toContain(
      'ant-btn-loading',
    )
  })

  it('「格式」popover 摊开稿子标注约定', () => {
    mockConvert.mockReturnValue(convertHook())
    render(<DocxUploadButton onConverted={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /格式/ }))
    expect(screen.getByText('稿子标注格式')).toBeTruthy()
    expect(screen.getByText('【互动·二选一】引导词')).toBeTruthy()
  })
})
