import * as fs from "fs/promises"
import * as path from "path"
import { LOCAL_ASSET_FILES } from "./assets"

export interface YuqueAssetsVitePluginOptions {
  /** 输出子目录，默认 "public/yuque-assets" */
  publicSubDir?: string
  /**
   * 显式指定本地资源目录路径。
   * 设置后跳过自动搜索，优先级最高。
   */
  assetsDir?: string
}

export interface SimpleVitePlugin {
  name: string
  enforce?: "pre" | "post"
  configResolved?: (config: { root: string }) => void
  buildStart?: () => void | Promise<void>
  configureServer?: () => void | Promise<void>
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

async function copyFile(from: string, to: string): Promise<void> {
  await fs.mkdir(path.dirname(to), { recursive: true })
  await fs.copyFile(from, to)
}

function uniquePaths(paths: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const p of paths) {
    const normalized = path.resolve(p)
    if (seen.has(normalized)) continue
    seen.add(normalized)
    result.push(normalized)
  }
  return result
}

async function findLocalAssetsDir(searchRoot: string): Promise<string> {
  const cwd = process.cwd()
  const candidates = uniquePaths([
    path.resolve(searchRoot, "assets/yuque-assets"),
    path.resolve(searchRoot, "../assets/yuque-assets"),
    path.resolve(searchRoot, "../../assets/yuque-assets"),
    path.resolve(searchRoot, "node_modules/yuque-editor-core/dist/yuque-assets"),
    path.resolve(searchRoot, "node_modules/yuque-editor-core/assets/yuque-assets"),
    path.resolve(cwd, "assets/yuque-assets"),
    path.resolve(cwd, "../assets/yuque-assets"),
    path.resolve(cwd, "../../assets/yuque-assets"),
    path.resolve(cwd, "node_modules/yuque-editor-core/dist/yuque-assets"),
    path.resolve(cwd, "node_modules/yuque-editor-core/assets/yuque-assets"),
    typeof __dirname === "string" ? path.resolve(__dirname, "yuque-assets") : "",
    typeof __dirname === "string"
      ? path.resolve(__dirname, "../assets/yuque-assets")
      : ""
  ].filter(Boolean))

  for (const dir of candidates) {
    if (await pathExists(dir)) return dir
  }
  throw new Error(
    `Missing local yuque assets dir in: ${candidates.join(", ")}.`
  )
}

async function ensureYuqueAssetsDir(outDir: string, searchRoot: string, explicitAssetsDir?: string) {
  const localAssetsDir = explicitAssetsDir
    ? path.resolve(explicitAssetsDir)
    : await findLocalAssetsDir(searchRoot)

  const tasks: Array<Promise<void>> = []
  for (const file of Object.values(LOCAL_ASSET_FILES)) {
    const from = path.resolve(localAssetsDir, file)
    if (!(await pathExists(from))) {
      throw new Error(`Missing local yuque asset file: ${from}.`)
    }
    tasks.push(copyFile(from, path.resolve(outDir, file)))
  }
  await Promise.all(tasks)
}

export function yuqueAssets(
  options: YuqueAssetsVitePluginOptions = {}
): SimpleVitePlugin {
  const publicSubDir = options.publicSubDir ?? "public/yuque-assets"
  const explicitAssetsDir = options.assetsDir
  let rootDir = process.cwd()
  let outDir = path.resolve(rootDir, publicSubDir)

  return {
    name: "yuque-editor-core:yuque-assets",
    enforce: "pre",
    configResolved(config) {
      rootDir = config.root
      outDir = path.resolve(config.root, publicSubDir)
    },
    async buildStart() {
      await ensureYuqueAssetsDir(outDir, rootDir, explicitAssetsDir)
    },
    async configureServer() {
      await ensureYuqueAssetsDir(outDir, rootDir, explicitAssetsDir)
    }
  }
}

export default yuqueAssets
