import { Space, Typography } from 'antd'

/**
 * 稿子标注约定，同时写进服务端 prompt 与这里——创作者照着写，LLM 照着转。
 * 抽屉里的「格式」popover 用它展示，避免同一份标注说明复制成两份、早晚漂移。
 */
export default function DocxFormatHint() {
  return (
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
}
