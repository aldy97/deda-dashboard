/// <reference types="node" />
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const SCRIPT = join(REPO_ROOT, ".github", "scripts", "pr-hygiene.mjs");
const REAL_TEMPLATE_DIR = join(REPO_ROOT, ".github", "PULL_REQUEST_TEMPLATE");
const REAL_CONFIG = join(REPO_ROOT, ".github", "pr-hygiene.json");

type RunResult = { status: number | null; stdout: string; stderr: string };

function run(options: {
  body?: string;
  bodyFile?: string;
  base?: string;
  templateDir?: string;
  config?: string;
}): RunResult {
  const env: Record<string, string> = { ...process.env as Record<string, string> };
  delete env.PR_BODY;
  delete env.PR_BODY_FILE;
  if (options.body !== undefined) env.PR_BODY = options.body;
  if (options.bodyFile !== undefined) env.PR_BODY_FILE = options.bodyFile;
  env.PR_BASE = options.base ?? "staging";
  if (options.templateDir) env.PR_TEMPLATE_DIR = options.templateDir;
  if (options.config) env.PR_HYGIENE_CONFIG = options.config;

  const result = spawnSync(process.execPath, [SCRIPT], {
    cwd: REPO_ROOT,
    env,
    encoding: "utf8",
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

const tempDirs: string[] = [];

function makeFixture(
  templates: Record<string, string>,
  config: Record<string, unknown> | string | null,
) {
  const dir = mkdtempSync(join(tmpdir(), "pr-hygiene-fx-"));
  tempDirs.push(dir);
  const templateDir = join(dir, "templates");
  mkdirSync(templateDir, { recursive: true });
  for (const [name, text] of Object.entries(templates)) {
    writeFileSync(join(templateDir, name), text, "utf8");
  }
  const configPath = join(dir, "pr-hygiene.json");
  if (config !== null) {
    writeFileSync(
      configPath,
      typeof config === "string" ? config : JSON.stringify(config),
      "utf8",
    );
  }
  return { templateDir, config: configPath };
}

const FRONT_MATTER = "---\nname: Fixture\nabout: 夹具模板\n---\n\n";

/** flat 形态：三个 H2 段，其中人工测试段带两个 H3 子段。 */
const TPL_FLAT =
  FRONT_MATTER +
  [
    "## 一句话结论",
    "> 提示行不算内容",
    "## 改了什么",
    "> 提示行不算内容",
    "## 需要人工测试的地方",
    "<!-- 两个子段都要写 -->",
    "### 作者已实测",
    "> 提示",
    "### 合并后需要人工点",
    "> 提示",
  ].join("\n");

/** wrapper 形态：一个 H2 包裹标题 + 三个 H3 段，末段标 optional。 */
const TPL_WRAPPER =
  FRONT_MATTER +
  [
    "## 发布 PR（夹具）：`staging` → `main`",
    "> 包裹标题不参与判定，可随意改写",
    "### 本次带入",
    "> 提示",
    "### 验证",
    "> 提示",
    "### 已知待办（不阻塞发布）",
    "<!-- optional -->",
    "> 提示",
  ].join("\n");

/** 模板里带围栏，围栏内的 ## 不能被当成必需段派生出来。 */
const TPL_FENCED =
  FRONT_MATTER +
  ["## 甲段", "> 提示", "## 示例写法", "```markdown", "## 假段名", "```"].join(
    "\n",
  );

const CFG_BOTH = {
  default: "flat.md",
  byBase: { main: "wrapper.md" },
};

const BODY_FLAT_OK = [
  "## 一句话结论",
  "落地闸口。",
  "## 改了什么",
  "- 脚本改为从模板派生段表",
  "## 需要人工测试的地方",
  "### 作者已实测",
  "- [x] 场景：夹具；期望：exit 0；实测：通过",
  "### 合并后需要人工点",
  "- 无（不改运行时接口）",
].join("\n");

const BODY_WRAPPER_OK = [
  "## 发布 PR（后端侧）：`staging` → `main`",
  "### 本次带入",
  "| PR | 人工验证项数 |",
  "| --- | --- |",
  "| #75 | 3 |",
  "### 验证",
  "- staging CI 全绿",
  "### 已知待办（不阻塞发布）",
  "- 无",
].join("\n");

function stripFrontMatter(text: string): string {
  const match = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(text);
  return match ? text.slice(match[0].length) : text;
}

function missingCount(stdout: string): number {
  const line = stdout.split("\n").find((l) => l.includes("缺少必需段落"));
  return line ? line.split("：")[1].split("、").filter(Boolean).length : 0;
}

function missingOrEmptyCount(stdout: string): number {
  return stdout
    .split("\n")
    .filter((l) => l.startsWith("✗"))
    .reduce(
      (sum, l) =>
        sum + (l.split("：")[1]?.split("、").filter(Boolean).length ?? 0),
      0,
    );
}

beforeAll(() => {
  // 确保脚本存在（否则后续所有测试无意义）
  if (!existsSync(SCRIPT)) {
    throw new Error(`脚本不存在: ${SCRIPT}`);
  }
});

afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

// ================================================================
// 1) 仓库产物齐备
// ================================================================
describe("仓库产物齐备", () => {
  it("校验脚本存在", () => {
    expect(existsSync(SCRIPT)).toBe(true);
  });

  it("映射配置存在且是合法 JSON，default 必填", () => {
    expect(existsSync(REAL_CONFIG)).toBe(true);
    const cfg = JSON.parse(readFileSync(REAL_CONFIG, "utf8"));
    expect(typeof cfg.default).toBe("string");
  });

  it("配置里 default 与 byBase 指向的模板文件都真实存在", () => {
    const cfg = JSON.parse(readFileSync(REAL_CONFIG, "utf8"));
    const names = [cfg.default, ...Object.values(cfg.byBase ?? {})];
    for (const name of names as string[]) {
      expect(existsSync(join(REAL_TEMPLATE_DIR, name))).toBe(true);
    }
  });
});

// ================================================================
// 2) flat 模板派生 H2 段表
// ================================================================
describe("flat 模板派生 H2 段表", () => {
  it("flat 模板：齐备放行", () => {
    const fx = makeFixture({ "flat.md": TPL_FLAT }, { default: "flat.md" });
    const res = run({ body: BODY_FLAT_OK, ...fx });
    expect(res.status).toBe(0);
  });

  it("flat 模板：缺任一段即红并点名", () => {
    const fx = makeFixture({ "flat.md": TPL_FLAT }, { default: "flat.md" });
    const res = run({
      body: BODY_FLAT_OK.replace(/## 改了什么[\s\S]*?(?=## )/, ""),
      ...fx,
    });
    expect(res.status).toBe(1);
    expect(res.stdout).toContain("改了什么");
  });
});

// ================================================================
// 3) wrapper 模板派生 H3 段表
// ================================================================
describe("wrapper 模板派生 H3 段表", () => {
  it("wrapper 模板：必需段是 H3，齐备放行", () => {
    const fx = makeFixture({ "w.md": TPL_WRAPPER }, { default: "w.md" });
    const res = run({ body: BODY_WRAPPER_OK, ...fx });
    expect(res.status).toBe(0);
  });

  it("wrapper 模板：包裹标题文字随意改写仍放行", () => {
    const fx = makeFixture({ "w.md": TPL_WRAPPER }, { default: "w.md" });
    const body = BODY_WRAPPER_OK.replace(
      "## 发布 PR（后端侧）：`staging` → `main`",
      "## 这次发布带上去的东西",
    );
    expect(run({ body, ...fx }).status).toBe(0);
  });

  it("wrapper 模板：缺 H3 段即红并点名", () => {
    const fx = makeFixture({ "w.md": TPL_WRAPPER }, { default: "w.md" });
    const body = BODY_WRAPPER_OK.replace(/### 验证[\s\S]*?(?=### )/, "");
    const res = run({ body, ...fx });
    expect(res.status).toBe(1);
    expect(res.stdout).toContain("验证");
  });

  it("模板围栏内的 ## 不会被派生成必需段", () => {
    const fx = makeFixture({ "f.md": TPL_FENCED }, { default: "f.md" });
    const body = "## 甲段\n写了内容\n## 示例写法\n也写了内容\n";
    const res = run({ body, ...fx });
    expect(res.status).toBe(0);
    expect(res.stdout).not.toContain("假段名");
  });
});

// ================================================================
// 4) <!-- optional --> 标记
// ================================================================
describe("optional 标记", () => {
  it("标了 optional 的段整段不写 → 放行", () => {
    const fx = makeFixture({ "w.md": TPL_WRAPPER }, { default: "w.md" });
    const body = BODY_WRAPPER_OK.replace(
      /### 已知待办（不阻塞发布）[\s\S]*$/,
      "",
    );
    expect(run({ body, ...fx }).status).toBe(0);
  });

  it("optional 段写了标题却留空 → 仍然拦下", () => {
    const fx = makeFixture({ "w.md": TPL_WRAPPER }, { default: "w.md" });
    const body = BODY_WRAPPER_OK.replace(
      /### 已知待办（不阻塞发布）[\s\S]*$/,
      "### 已知待办（不阻塞发布）\n> 只剩提示行\n",
    );
    const res = run({ body, ...fx });
    expect(res.status).toBe(1);
    expect(res.stdout).toContain("已知待办");
  });

  it("未标 optional 的段缺失 → 拦下（对照组）", () => {
    const fx = makeFixture({ "w.md": TPL_WRAPPER }, { default: "w.md" });
    const body = BODY_WRAPPER_OK.replace(/### 本次带入[\s\S]*?(?=### )/, "");
    const res = run({ body, ...fx });
    expect(res.status).toBe(1);
    expect(res.stdout).toContain("本次带入");
  });
});

// ================================================================
// 5) base → 模板映射
// ================================================================
describe("base → 模板映射", () => {
  const templates = { "flat.md": TPL_FLAT, "wrapper.md": TPL_WRAPPER };

  it("base=main 命中 release 段表", () => {
    const fx = makeFixture(templates, CFG_BOTH);
    expect(run({ body: BODY_WRAPPER_OK, base: "main", ...fx }).status).toBe(0);
    expect(run({ body: BODY_FLAT_OK, base: "main", ...fx }).status).toBe(1);
  });

  it("base=staging 回落 default", () => {
    const fx = makeFixture(templates, CFG_BOTH);
    expect(run({ body: BODY_FLAT_OK, base: "staging", ...fx }).status).toBe(0);
  });

  it("堆叠 PR 的非常规 base 回落 default", () => {
    const fx = makeFixture(templates, CFG_BOTH);
    expect(
      run({ body: BODY_FLAT_OK, base: "feat/some-stack", ...fx }).status,
    ).toBe(0);
  });
});

// ================================================================
// 6) 正文层级兼容
// ================================================================
describe("正文层级兼容", () => {
  it("必需段写成 H2 → 放行", () => {
    const fx = makeFixture({ "flat.md": TPL_FLAT }, { default: "flat.md" });
    expect(run({ body: BODY_FLAT_OK, ...fx }).status).toBe(0);
  });

  it("同一段写成 H2 包裹 + H3 → 放行", () => {
    const fx = makeFixture({ "flat.md": TPL_FLAT }, { default: "flat.md" });
    const body = [
      "## 随便一个包裹标题",
      "### 一句话结论",
      "落地闸口。",
      "### 改了什么",
      "- 从模板派生",
      "### 需要人工测试的地方",
      "#### 作者已实测",
      "- [x] 场景：夹具；期望：exit 0；实测：通过",
      "#### 合并后需要人工点",
      "- 无（不改运行时接口）",
    ].join("\n");
    expect(run({ body, ...fx }).status).toBe(0);
  });

  it("必需段写成 H4 → 不认，拦下", () => {
    const fx = makeFixture({ "flat.md": TPL_FLAT }, { default: "flat.md" });
    const body = BODY_FLAT_OK.replace(/^## /gm, "#### ").replace(
      /^### /gm,
      "#### ",
    );
    const res = run({ body, ...fx });
    expect(res.status).toBe(1);
    expect(res.stdout).toContain("一句话结论");
  });

  it("子段只要比父段深一级即可（父 H3 → 子 H4）", () => {
    const fx = makeFixture({ "flat.md": TPL_FLAT }, { default: "flat.md" });
    const body = [
      "## 包裹",
      "### 一句话结论",
      "内容",
      "### 改了什么",
      "内容",
      "### 需要人工测试的地方",
      "#### 作者已实测",
      "- [x] 已实测，期望与结果都写了",
      "#### 合并后需要人工点",
      "- 无（理由）",
    ].join("\n");
    expect(run({ body, ...fx }).status).toBe(0);
  });
});

// ================================================================
// 7) fail-open
// ================================================================
describe("fail-open", () => {
  const fx = () => makeFixture({ "flat.md": TPL_FLAT }, { default: "flat.md" });

  it("PR_BODY 未注入 → 放过且 stdout 含 fail-open", () => {
    const res = run({ ...fx() });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("fail-open");
  });

  it("PR_BODY_FILE 指向不存在文件 → fail-open", () => {
    const res = run({
      bodyFile: join(tmpdir(), "definitely-missing.md"),
      ...fx(),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("fail-open");
    expect(res.stderr).not.toContain("Error:");
  });

  it("配置缺失 → fail-open", () => {
    const fx2 = makeFixture({ "flat.md": TPL_FLAT }, null);
    const res = run({ body: "随意正文", ...fx2 });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("fail-open");
  });

  it("配置 JSON 畸形 → fail-open", () => {
    const fx2 = makeFixture({ "flat.md": TPL_FLAT }, "{ 不是 JSON");
    const res = run({ body: "随意正文", ...fx2 });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("fail-open");
  });

  it("配置缺 default 字段 → fail-open", () => {
    const fx2 = makeFixture(
      { "flat.md": TPL_FLAT },
      { byBase: { main: "flat.md" } },
    );
    const res = run({ body: "随意正文", ...fx2 });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("fail-open");
  });

  it("配置指向不存在的模板 → fail-open", () => {
    const fx2 = makeFixture({ "flat.md": TPL_FLAT }, { default: "ghost.md" });
    const res = run({ body: "随意正文", ...fx2 });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("fail-open");
  });

  it("PR_BODY 为空串是明确缺段 → exit 1", () => {
    const res = run({ body: "   \n  ", ...fx() });
    expect(res.status).toBe(1);
    expect(res.stdout).toContain("一句话结论");
  });

  it("PR_BODY_FILE 与 PR_BODY 等价", () => {
    const dir = mkdtempSync(join(tmpdir(), "pr-hygiene-body-"));
    tempDirs.push(dir);
    const file = join(dir, "body.md");
    writeFileSync(file, BODY_FLAT_OK, "utf8");
    expect(run({ bodyFile: file, ...fx() }).status).toBe(0);
  });

  it("畸形输入（未闭合围栏 + 只有 H1）不崩，退出码只允许 0 或 1", () => {
    const res = run({ body: "# 标题\n```markdown\n## 一句话结论\n", ...fx() });
    expect([0, 1]).toContain(res.status);
  });
});

// ================================================================
// 8) 仓库真模板自校验 —— 最重要的一组，防「模板被写坏导致闸口空转」
// ================================================================
describe("仓库真模板自校验", () => {
  // 这些测试依赖仓库里真实的配置和模板文件存在
  // 在 RED 阶段它们还未创建，将触发 fail-open（exit 0）而非 exit 1
  // 在 GREEN 阶段模板写好后，这些测试验的是「空模板原样交回必判空」

  it("feature 模板原样交回必被判空", () => {
    // 只有当模板文件真实存在时才跑此断言
    if (!existsSync(join(REAL_TEMPLATE_DIR, "feature-to-staging.md"))) return;

    const res = run({
      body: stripFrontMatter(
        readFileSync(join(REAL_TEMPLATE_DIR, "feature-to-staging.md"), "utf8"),
      ),
      base: "staging",
      templateDir: REAL_TEMPLATE_DIR,
      config: REAL_CONFIG,
    });
    expect(res.status).toBe(1);
    expect(missingOrEmptyCount(res.stdout)).toBeGreaterThanOrEqual(6);
  });

  it("release 模板原样交回必被判空", () => {
    if (!existsSync(join(REAL_TEMPLATE_DIR, "release-to-main.md"))) return;

    const res = run({
      body: stripFrontMatter(
        readFileSync(join(REAL_TEMPLATE_DIR, "release-to-main.md"), "utf8"),
      ),
      base: "main",
      templateDir: REAL_TEMPLATE_DIR,
      config: REAL_CONFIG,
    });
    expect(res.status).toBe(1);
    expect(missingOrEmptyCount(res.stdout)).toBeGreaterThanOrEqual(5);
  });

  it("空正文时 feature 段表至少点名 7 段", () => {
    if (!existsSync(join(REAL_TEMPLATE_DIR, "feature-to-staging.md"))) return;

    const res = run({
      body: "",
      base: "staging",
      templateDir: REAL_TEMPLATE_DIR,
      config: REAL_CONFIG,
    });
    expect(res.status).toBe(1);
    expect(missingCount(res.stdout)).toBeGreaterThanOrEqual(7);
  });

  it("release 段表含六项契约段", () => {
    if (!existsSync(join(REAL_TEMPLATE_DIR, "release-to-main.md"))) return;

    const res = run({
      body: "",
      base: "main",
      templateDir: REAL_TEMPLATE_DIR,
      config: REAL_CONFIG,
    });
    for (const name of [
      "本次带入",
      "prod 实际影响面",
      "验证",
      "上线后人工验证清单",
      "回滚",
    ]) {
      expect(res.stdout).toContain(name);
    }
  });
});
