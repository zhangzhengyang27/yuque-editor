/**
 * 发布产物健全性检查：
 * 在 Node（原生 ESM / CJS）环境下逐个加载所有导出子路径的产物，
 * 任何一个相对导入没有带上 .cjs/.mjs 扩展名都会在这里直接报错。
 * （postbuild.cjs 曾因手工维护重写表漏掉 ./controlled 导致此问题）
 */
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const dist = path.join(root, "packages/core/dist")
const require = createRequire(import.meta.url)

const MODULES = ["index", "assets", "editor", "controlled", "react", "vue", "vite-assets"]

let failed = false

for (const name of MODULES) {
  try {
    await import(path.join(dist, `${name}.mjs`))
    console.log(`ESM OK   ${name}.mjs`)
  } catch (err) {
    failed = true
    console.error(`ESM FAIL ${name}.mjs: ${err.message}`)
  }

  try {
    require(path.join(dist, `${name}.cjs`))
    console.log(`CJS OK   ${name}.cjs`)
  } catch (err) {
    failed = true
    console.error(`CJS FAIL ${name}.cjs: ${err.message}`)
  }
}

if (failed) {
  console.error("\nDist subpath verification FAILED.")
  process.exit(1)
}
console.log("\nAll dist subpaths load under Node ESM and CJS.")
