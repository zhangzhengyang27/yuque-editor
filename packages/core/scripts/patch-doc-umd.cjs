/**
 * doc.umd.js 构建期补丁（vendored 产物，升级 doc.umd.js 后重跑 pnpm build 自动应用）：
 *
 * Lake search 插件的 replaceText 命令 execute 只 newJob + 替换 + setSelection，
 * 缺 commitJob —— 替换停留在未提交事务：change 不发出、getContent/自动保存读到
 * 旧文档，用户替换后不做任何后续编辑就保存/刷新会丢改动（2026-09-11 实测复现，
 * 见知识库项目《产品定位与路线决策》附录内核清单）。
 *
 * 补丁在 setSelection 后追加 e.commitJob(r)，与 correction/insertCard 等命令的
 * 提交模式对齐。目标串经唯一性校验；若因上游升级不匹配则显式报错，人工核对新
 * 版是否已修复（若已修复，删除对应 PATCHES 条目即可）。
 */
const fs = require("fs")
const path = require("path")

const TARGET_FILE = path.resolve(__dirname, "../assets/yuque-assets/doc.umd.js")

const PATCHES = [
  {
    name: "search-replaceText-commit",
    reason: "search 插件 replaceText 命令缺 commitJob，替换结果停留在未提交事务",
    from: "r.setSelection([o])}}])}(vt)",
    to: "r.setSelection([o]),e.commitJob(r)}}])}(vt)",
  },
]

const content = fs.readFileSync(TARGET_FILE, "utf8")
let patched = 0

for (const patch of PATCHES) {
  if (content.includes(patch.to)) {
    console.log(`[patch-doc-umd] 已应用，跳过: ${patch.name}`)
    patched += 1
    continue
  }
  const occurrences = content.split(patch.from).length - 1
  if (occurrences !== 1) {
    throw new Error(
      `[patch-doc-umd] 补丁目标串匹配 ${occurrences} 次（预期 1 次）：${patch.name}\n` +
        `原因：${patch.reason}\n上游 doc.umd.js 已变更，请人工核对新版行为后更新 PATCHES。`,
    )
  }
  fs.writeFileSync(TARGET_FILE, content.replace(patch.from, patch.to))
  console.log(`[patch-doc-umd] 已应用: ${patch.name}`)
  patched += 1
}

if (patched !== PATCHES.length) {
  process.exitCode = 1
}
