#!/usr/bin/env node
/**
 * 覆盖率闸口：只考核「本次新增/改动的代码行」，行覆盖率低于阈值即失败。
 *
 * 口径与仓库 AGENTS.md 一致：全仓历史覆盖率、以及大文件里既有的未测代码都
 * 不作为门槛；本次 diff 新增/改动的可执行行必须 ≥90% 被覆盖，避免「改一行
 * 大文件就被整文件历史欠账拖红」。
 *
 * 输入：
 * - BASE_SHA / HEAD_SHA：git diff 的基线，CI 里分别取 PR base 或 push before；
 *   缺失、全零（首次推送）时退回 HEAD^，再不行就跳过。
 * - COVERAGE_JSON：默认 coverage/coverage-final.json（vitest v8 istanbul json）。
 * - COVERAGE_THRESHOLD：默认 90。
 *
 * 退出码：0 = 通过或无需考核；1 = 有改动行低于阈值 / 缺覆盖率产物。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const THRESHOLD = Number(process.env.COVERAGE_THRESHOLD ?? 90)
const COVERAGE_JSON = process.env.COVERAGE_JSON ?? 'coverage/coverage-final.json'

// 与 vitest.config.ts 的 coverage.include / exclude 保持同一口径
const EXCLUDED_PREFIXES = ['src/test/', 'src/types/']
const EXCLUDED_FILES = new Set(['src/main.tsx', 'src/vite-env.d.ts'])

function isMeasuredSource(file) {
  if (!/^src\/.*\.(ts|tsx)$/.test(file)) return false
  if (/\.test\.(ts|tsx)$/.test(file) || /\.d\.ts$/.test(file)) return false
  if (EXCLUDED_PREFIXES.some((prefix) => file.startsWith(prefix))) return false
  return !EXCLUDED_FILES.has(file)
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' })
}

function resolveBase() {
  const raw = (process.env.BASE_SHA ?? '').trim()
  if (raw && !/^0+$/.test(raw)) return raw
  try {
    return git(['rev-parse', 'HEAD^']).trim()
  } catch {
    return null
  }
}

/** 解析 `git diff -U0`，返回该文件新增/改动后的行号集合（新文件即全部行） */
function addedLines(file, base, head) {
  const diff = git([
    'diff',
    '--unified=0',
    '--no-color',
    '--no-ext-diff',
    `${base}...${head}`,
    '--',
    file,
  ])
  const lines = new Set()
  const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/
  let current = 0
  for (const raw of diff.split('\n')) {
    const match = hunk.exec(raw)
    if (match) {
      current = Number(match[1])
      continue
    }
    if (current === 0) continue
    if (raw.startsWith('+') && !raw.startsWith('+++')) {
      lines.add(current)
      current += 1
    } else if (raw.startsWith('-') || raw.startsWith('---')) {
      // 删除行不推进新文件行号
    } else {
      current += 1
    }
  }
  return lines
}

const base = resolveBase()
if (!base) {
  console.log('[coverage-gate] 没有可用的基线提交（首次推送），跳过')
  process.exit(0)
}

if (!existsSync(COVERAGE_JSON)) {
  console.error(
    `[coverage-gate] 找不到 ${COVERAGE_JSON}，请先运行 npm run test:coverage`,
  )
  process.exit(1)
}

const head = (process.env.HEAD_SHA ?? '').trim() || 'HEAD'
const changed = git([
  'diff',
  '--name-only',
  '--diff-filter=AMR',
  `${base}...${head}`,
])
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)

const targets = changed.filter(isMeasuredSource)
if (targets.length === 0) {
  console.log('[coverage-gate] 本次没有生产代码改动，无需考核覆盖率')
  process.exit(0)
}

const coverage = JSON.parse(readFileSync(COVERAGE_JSON, 'utf8'))
const byAbsPath = new Map(
  Object.entries(coverage).map(([key, value]) => [path.resolve(key), value]),
)

let failed = 0
const report = []
let measuredFiles = 0

for (const file of targets) {
  const entry = byAbsPath.get(path.resolve(file))
  if (!entry) {
    failed += 1
    report.push(`  ✗ ${file}  0.0%  （未被任何测试加载）`)
    continue
  }

  const added = addedLines(file, base, head)
  const statementsByLine = new Map()
  for (const [id, location] of Object.entries(entry.statementMap ?? {})) {
    const line = location?.start?.line
    if (line == null) continue
    const hits = entry.s?.[id] ?? 0
    const list = statementsByLine.get(line) ?? []
    list.push(hits)
    statementsByLine.set(line, list)
  }

  let executable = 0
  let covered = 0
  const uncovered = []
  for (const line of added) {
    const hits = statementsByLine.get(line)
    if (!hits) continue
    executable += 1
    if (hits.every((n) => n > 0)) {
      covered += 1
    } else {
      uncovered.push(line)
    }
  }

  if (executable === 0) continue
  measuredFiles += 1
  const pct = (100 * covered) / executable
  const label = `${file}  ${pct.toFixed(1)}%  (${covered}/${executable} 行)`
  if (pct < THRESHOLD) {
    failed += 1
    const list = uncovered.length > 0 ? `未覆盖行: ${uncovered.join(', ')}` : ''
    report.push(`  ✗ ${label}  ${list}`.trimEnd())
  } else {
    report.push(`  ✓ ${label}`)
  }
}

console.log(
  `[coverage-gate] 新增/改动行覆盖阈值 ${THRESHOLD}%，考核 ${measuredFiles} 个文件：`,
)
if (report.length > 0) console.log(report.join('\n'))

if (failed > 0) {
  console.error(`[coverage-gate] ${failed} 个文件低于 ${THRESHOLD}%，拒绝通过`)
  process.exit(1)
}

console.log('[coverage-gate] 全部达标')
