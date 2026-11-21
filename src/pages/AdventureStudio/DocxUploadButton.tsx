import { useState } from 'react'
import { Button, Popover, Space, Typography, Upload } from 'antd'
import { QuestionCircleOutlined, UploadOutlined } from '@ant-design/icons'
import type { ApiError } from '../../api/client'
import { useAdventureScriptConvert } from '../../api/queries'
import type { ScriptConvertResult } from '../../types/adventureAdmin'
import { fileToBase64 } from './docxUpload'
import DocxFormatHint from './DocxFormatHint'

/**
 * 抽屉里的紧凑「从 docx 填充」按钮：点一下选 .docx，选完立即转换并回调结果。
 *
 * 走 POST /script/convert（不落库），刻意做成一行小控件——按钮 + 「格式」popover +
 * 文件名 + 错误，而不是大块区域。是否覆盖已有内容由父组件（抽屉）在 onConverted
 * 里判断：这里只负责「拿结果上报」。
 */
interface Props {
  onConverted: (result: ScriptConvertResult) => void
  buttonText?: string
}

export default function DocxUploadButton({
  onConverted,
  buttonText = '从 docx 填充',
}: Props) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [readError, setReadError] = useState<string | null>(null)
  const convert = useAdventureScriptConvert()
  const error = (convert.error as ApiError | null) ?? null

  async function handleFile(file: File) {
    setSelectedFile(file)
    setReadError(null)
    convert.reset()
    let base64: string
    try {
      base64 = await fileToBase64(file)
    } catch (err) {
      setReadError(err instanceof Error ? err.message : String(err))
      return
    }
    convert.mutate(
      { fileName: file.name, contentBase64: base64 },
      { onSuccess: (result) => onConverted(result) },
    )
  }

  return (
    <Space size={8} wrap>
      <Upload
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        showUploadList={false}
        beforeUpload={(file) => {
          // 不真的上传：只在浏览器里读文件，读成 base64 后调转换接口
          void handleFile(file)
          return false
        }}
      >
        <Button icon={<UploadOutlined />} loading={convert.isPending}>
          {buttonText}
        </Button>
      </Upload>
      <Popover
        title="稿子标注格式"
        content={<DocxFormatHint />}
        trigger="click"
        placement="bottom"
      >
        <Button type="text" size="small" icon={<QuestionCircleOutlined />}>
          格式
        </Button>
      </Popover>
      {selectedFile && <Typography.Text code>{selectedFile.name}</Typography.Text>}
      {readError && <Typography.Text type="danger">{readError}</Typography.Text>}
      {error && (
        <Typography.Text type="danger">
          转换失败：{error.message}
          {error.domainCode ? `（${error.domainCode}）` : ''}
        </Typography.Text>
      )}
    </Space>
  )
}
