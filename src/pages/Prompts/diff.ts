/**
 * prompt 正文的逐行 diff。
 *
 * 刻意不引 Monaco / diff 库：发布弹窗只需要「哪几行变了」这一件事，
 * 而 prompt 正文最多 20000 字符、实际都在百行量级，LCS 足够且零依赖。
 * 纯函数、无 React，便于单测穷举边界。
 */

export type DiffLineType = 'same' | 'add' | 'del'

export interface DiffLine {
  type: DiffLineType
  /** 原文行号（1 起）；type=add 时为 null */
  oldNo: number | null
  /** 新文行号（1 起）；type=del 时为 null */
  newNo: number | null
  text: string
}

export interface DiffStat {
  added: number
  removed: number
  unchanged: number
}

/** 去掉末尾一个换行再切分，避免多出一行幽灵空行 */
function toLines(text: string): string[] {
  const normalized = text.endsWith('\n') ? text.slice(0, -1) : text
  return normalized === '' ? [] : normalized.split('\n')
}

/**
 * LCS 逐行对比。返回按阅读顺序排列的行序列：
 * 删除行紧跟在它与新文的共同前缀之后，新增行同理。
 */
export function diffLines(oldText: string, newText: string): DiffLine[] {
  const a = toLines(oldText)
  const b = toLines(newText)
  const n = a.length
  const m = b.length

  // dp[i][j] = a[i:] 与 b[j:] 的 LCS 长度；用一维滚动数组按行回填
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  )
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] === b[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: 'same', oldNo: i + 1, newNo: j + 1, text: a[i] })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: 'del', oldNo: i + 1, newNo: null, text: a[i] })
      i++
    } else {
      out.push({ type: 'add', oldNo: null, newNo: j + 1, text: b[j] })
      j++
    }
  }
  while (i < n) {
    out.push({ type: 'del', oldNo: i + 1, newNo: null, text: a[i] })
    i++
  }
  while (j < m) {
    out.push({ type: 'add', oldNo: null, newNo: j + 1, text: b[j] })
    j++
  }
  return out
}

export function diffStat(lines: DiffLine[]): DiffStat {
  return lines.reduce<DiffStat>(
    (acc, line) => {
      if (line.type === 'add') acc.added++
      else if (line.type === 'del') acc.removed++
      else acc.unchanged++
      return acc
    },
    { added: 0, removed: 0, unchanged: 0 },
  )
}

/** 正文完全一致（含末尾换行差异）→ 没有可发布的改动 */
export function isSameContent(oldText: string, newText: string): boolean {
  const { added, removed } = diffStat(diffLines(oldText, newText))
  return added === 0 && removed === 0
}
