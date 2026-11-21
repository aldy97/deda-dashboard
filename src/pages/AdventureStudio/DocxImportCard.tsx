import { useState } from 'react'
import { Alert, Button, Collapse, Space, Typography, Upload } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import type { ApiError } from '../../api/client'
import { useAdventureScriptConvert } from '../../api/queries'
import type { ScriptConvertResult } from '../../types/adventureAdmin'

/**
 * docx 稿子上传卡片：把带标注的故事稿交给服务端，用 LLM 转成结构化草稿预览。
 *
 * 只在 authoring（staging）渲染——prod 只读，没有这条「新建」入口。
 * 点击「生成草稿」→ POST /script/convert（不落库）→ 拿到转换结果后交给父组件
 * 打开 NewEpisodeDrawer。落库仍由抽屉里的「存草稿」走 POST /episodes 完成。
 */

/** 稿子标注约定，同时写进服务端 prompt 与这里——创作者照着写，LLM 照着转。 */
const DOCX_FORMAT_HINT = (
  <Space orientation="vertical" size={4} style={{ width: '100%' }}>
    <Typography.Text>
      正文第一个非空行 = 这一集的标题；未标注的普通段落 = 旁白。
    </Typography.Text>
    <Typography.Text>
      交互点用独立一行标记，四种（各自成段）：
    </Typography.Text>
    <Typography.Text code>【互动·二选一】引导词</Typography.Text>
    <Typography.Text>
      {"    选项A：<文案>｜接话：<孩子选 A 后听到的话>"}
      <br />
      {"    选项B：<文案>｜接话：<孩子选 B 后听到的话>"}
      <br />
      {'    兜底：<孩子跑题/沉默时说的话>'}
    </Typography.Text>
    <Typography.Text code>【互动·开放问答】引导词</Typography.Text>
    <Typography.Text>{'    兜底：<孩子跑题/沉默时说的话>'}</Typography.Text>
    <Typography.Text code>【互动·跟我念】要念的句子</Typography.Text>
    <Typography.Text>
      {'    表扬：<孩子念对后的鼓励>'}
      <br />
      {'    兜底：<孩子跑题/沉默时说的话>'}
    </Typography.Text>
    <Typography.Text code>【互动·奖励】引导词</Typography.Text>
    <Typography.Text>这一整段过完发一颗星，不需要兜底。</Typography.Text>
  </Space>
)

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string') {
        resolve(result.slice(result.indexOf(',') + 1))
      } else {
        reject(new Error('读取文件失败'))
      }
    }
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsDataURL(file)
  })
}

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
                children: DOCX_FORMAT_HINT,
              },
            ]}
          />
        </Space>
      }
    />
  )
}
