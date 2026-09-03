/**
 * 构建后处理：
 * 1. 以 package.json exports 声明的入口为起点，扫描编译产物中的相对导入，
 *   递归把依赖模块从 dist/{types,cjs,esm} 复制到 dist/ 根目录并重命名扩展名
 *   （.d.ts 保持不变，.js → .cjs / .mjs）
 * 2. 把产物里的相对导入重写为带扩展名的路径（require('./x.cjs') / from './x.mjs'），
 *   否则 Node.js 无法解析无扩展名的 .cjs/.mjs 模块
 * 3. 复制离线静态资源到 dist/yuque-assets/
 *
 * 依赖模块靠扫描自动发现，新增内部模块（如 lake-dom.ts）不需要改这个脚本；
 * 只有「新增 npm 导出子路径」时才需要同步 ENTRIES 列表。
 */
const fs = require("fs")
const path = require("path")

const root = process.cwd()
const dist = path.resolve(root, "dist")

/** 与 package.json exports 对应的入口模块；其依赖由扫描自动带出 */
const ENTRIES = ["index", "assets", "vite-assets", "editor", "controlled", "react", "vue"]

// tsc 产物的相对导入形态：CJS 的 require("./x")、ESM 的 from/import "./x"
// （同时兼容单双引号；\w.- 覆盖 vite-assets 这类连字符命名）
const CJS_IMPORT = /require\((["'])\.\/([\w.-]+)\1\)/g
const ESM_IMPORT = /(from|import)\s*(["'])\.\/([\w.-]+)\2/g

function mustExist(p) {
  if (!fs.existsSync(p)) throw new Error(`Missing build output: ${p}`)
}

function copyFile(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.copyFileSync(from, to)
}

/** 收集文件里所有相对导入的模块名 */
function scanRelativeImports(filePath, regexp, nameGroup) {
  const deps = []
  const content = fs.readFileSync(filePath, "utf8")
  for (const match of content.matchAll(regexp)) {
    deps.push(match[nameGroup])
  }
  return deps
}

function rewriteFile(filePath, rules) {
  const content = fs.readFileSync(filePath, "utf8")
  let next = content
  for (const [regexp, to] of rules) next = next.replace(regexp, to)
  if (next !== content) fs.writeFileSync(filePath, next, "utf8")
}

/**
 * 复制一个模块的三份产物到 dist/ 根目录，重写其中的相对导入，
 * 并递归处理新发现的依赖（已处理的模块通过 processed 跳过）。
 */
function processModule(name, processed) {
  if (processed.has(name)) return
  processed.add(name)

  const cjsSrc = path.resolve(dist, "cjs", `${name}.js`)
  const esmSrc = path.resolve(dist, "esm", `${name}.js`)
  const typesSrc = path.resolve(dist, "types", `${name}.d.ts`)
  mustExist(cjsSrc)
  mustExist(esmSrc)
  mustExist(typesSrc)
  copyFile(cjsSrc, path.resolve(dist, `${name}.cjs`))
  copyFile(esmSrc, path.resolve(dist, `${name}.mjs`))
  copyFile(typesSrc, path.resolve(dist, `${name}.d.ts`))

  const esmMap = path.resolve(dist, "esm", `${name}.js.map`)
  if (fs.existsSync(esmMap)) {
    copyFile(esmMap, path.resolve(dist, `${name}.js.map`))
  }

  const cjsFile = path.resolve(dist, `${name}.cjs`)
  const esmFile = path.resolve(dist, `${name}.mjs`)
  // 先扫描（匹配的是无扩展名路径），再统一重写，避免相互干扰
  const deps = new Set([
    ...scanRelativeImports(cjsFile, CJS_IMPORT, 2),
    ...scanRelativeImports(esmFile, ESM_IMPORT, 3),
  ])

  rewriteFile(cjsFile, [[CJS_IMPORT, (_m, _q, dep) => `require('./${dep}.cjs')`]])
  rewriteFile(esmFile, [[ESM_IMPORT, (_m, kw, _q, dep) => `${kw} './${dep}.mjs'`]])

  for (const dep of deps) processModule(dep, processed)
}

const processed = new Set()
for (const name of ENTRIES) processModule(name, processed)

function copyDir(fromDir, toDir) {
  if (!fs.existsSync(fromDir)) return
  fs.mkdirSync(toDir, { recursive: true })
  for (const ent of fs.readdirSync(fromDir, { withFileTypes: true })) {
    const from = path.resolve(fromDir, ent.name)
    const to = path.resolve(toDir, ent.name)
    if (ent.isDirectory()) copyDir(from, to)
    else if (ent.isFile()) copyFile(from, to)
  }
}

copyDir(path.resolve(root, "assets", "yuque-assets"), path.resolve(dist, "yuque-assets"))
