import { useState } from 'react'
import { Alert, Button, Collapse, Space, Typography, Upload } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import type { ApiError } from '../../api/client'
import { useAdventureScriptConvert } from '../../api/queries'
import type { ScriptConvertResult } from '../../types/adventureAdmin'
import { fileToBase64 } from './docxUpload'
import DocxFormatHint from './DocxFormatHint'

/**
 * docx 稿子上传卡片：把带标注的故事稿交给服务端，用 LLM 转成结构化草稿预览。
 *
 * 只在 authoring（staging）渲染——prod 只读，没有这条「新建」入口。
 * 点击「生成草稿」→ POST /script/convert（不落库）→ 拿到转换结果后交给父组件
 * 打开 NewEpisodeDrawer。落库仍由抽屉里的「存草稿」走 POST /episodes 完成。
 */

interface Props {
  onConverted: (seed: ScriptConvertResult) => void
}

export default function DocxImportCard({ onConverted }: Props) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [readError, setReadError] = useState<string | null>(null)
  const convert = useAdventureScriptConvert()
  const error = (convert.error as ApiError | null) ?? null

  async function generate() {
    if (selectedFile === null) return
    setReadError(null)
    let base64: string
    try {
      base64 = await fileToBase64(selectedFile)
    } catch (err) {
      setReadError(err instanceof Error ? err.message : String(err))
      return
    }
    convert.mutate(
      { fileName: selectedFile.name, contentBase64: base64 },
      { onSuccess: (result) => onConverted(result) },
    )
  }

  return (
    <Alert
      type="info"
      showIcon
      style={{ marginBottom: 12 }}
      message="从 docx 稿子生成草稿（仅 staging）"
      description={
        <Space orientation="vertical" size={8} style={{ width: '100%' }}>
          <Typography.Text type="secondary">
            上传带交互标注的 .docx 故事稿，服务端用 LLM 转成结构化草稿预览；标题取正文首行，
            主角自动识别、集号自动 self-increment，都可进抽屉再改。
          </Typography.Text>

          <Space size={8} wrap>
            <Upload
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              showUploadList={false}
              beforeUpload={(file) => {
                setSelectedFile(file)
                setReadError(null)
                convert.reset()
                // 返回 false：不真的上传，只在浏览器里读文件
                return false
              }}
            >
              <Button icon={<UploadOutlined />}>选择 docx 稿子</Button>
            </Upload>
            {selectedFile && (
              <Typography.Text code>{selectedFile.name}</Typography.Text>
            )}
            <Button
              type="primary"
              disabled={selectedFile === null}
              loading={convert.isPending}
              onClick={() => void generate()}
            >
              生成草稿
            </Button>
          </Space>

          {readError && (
            <Typography.Text type="danger">{readError}</Typography.Text>
          )}
          {error && (
            <Typography.Text type="danger">
              转换失败：{error.message}
              {error.domainCode ? `（${error.domainCode}）` : ''}
            </Typography.Text>
          )}

          <Collapse
            size="small"
            items={[
              {
                key: 'format',
                label: '稿子标注格式（怎么标交互 / 选项 / 接话 / 兜底）',
                children: <DocxFormatHint />,
              },
            ]}
          />
        </Space>
      }
    />
  )
}
