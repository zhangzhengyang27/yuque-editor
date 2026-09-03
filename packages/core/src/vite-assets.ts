import * as fs from "fs/promises"
import * as path from "path"
import { LOCAL_ASSET_FILES } from "./assets"

export interface YuqueAssetsVitePluginOptions {
  /**
   * 浏览器访问前缀，默认 `/yuque-assets`。
   * 构建产物会输出到 `dist/<前缀去首斜杠>/`，与 dev 的 URL 保持一致。
   */
  baseUrl?: string
  /**
   * 显式指定本地资源目录路径。
   * 设置后跳过自动搜索，优先级最高。也可通过环境变量 `YUQUE_ASSETS_DIR` 指定。
   */
  assetsDir?: string
}

export type MiddlewareRequest = { url?: string }
export type MiddlewareResponse = {
  statusCode: number
  end: (body?: string | Buffer | Uint8Array) => void
  setHeader: (name: string, value: string) => void
}
export type MiddlewareNext = (err?: unknown) => void
export type MiddlewareHandler = (
  req: MiddlewareRequest,
  res: MiddlewareResponse,
  next: MiddlewareNext
) => void

export interface SimpleVitePlugin {
  name: string
  enforce?: "pre" | "post"
  configResolved?: (config: { root: string }) => void
  buildStart?: () => void | Promise<void>
  generateBundle?: (this: unknown) => void | Promise<void>
  configureServer?: (server: {
    middlewares: { use: (path: string, handler: MiddlewareHandler) => void }
  }) => void | Promise<void>
}

const DEFAULT_BASE_URL = "/yuque-assets"
/** 允许对外提供的文件白名单（防止把资源目录里任意文件暴露出去） */
const LOCAL_FILE_SET: ReadonlySet<string> = new Set(Object.values(LOCAL_ASSET_FILES))
const MIME_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8"
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
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

/**
 * 定位本地离线资源目录。候选顺序（最多命中首个）：
 * 1. `YUQUE_ASSETS_DIR` 环境变量
 * 2. 包自带的 `assets/yuque-assets`（devDependencies 安装时存在）
 * 3. 使用方 node_modules 里的安装产物 `yuque-editor-core/{dist,assets}/yuque-assets`
 * 4. 围绕 searchRoot / cwd 的常见相对位置
 */
async function findLocalAssetsDir(searchRoot: string): Promise<string> {
  const envDir = process.env.YUQUE_ASSETS_DIR
  const cwd = process.cwd()
  const candidates = uniquePaths([
    envDir ?? "",
    path.resolve(searchRoot, "assets/yuque-assets"),
    path.resolve(searchRoot, "node_modules/yuque-editor-core/dist/yuque-assets"),
    path.resolve(searchRoot, "node_modules/yuque-editor-core/assets/yuque-assets"),
    path.resolve(cwd, "node_modules/yuque-editor-core/dist/yuque-assets"),
    path.resolve(cwd, "node_modules/yuque-editor-core/assets/yuque-assets"),
    path.resolve(cwd, "assets/yuque-assets")
  ].filter(Boolean))

  for (const dir of candidates) {
    if (await pathExists(dir)) return dir
  }
  throw new Error(
    `Missing local yuque assets dir. Checked ${candidates.length} candidates including: ` +
      `${candidates.slice(0, 3).join(", ")}… ` +
      `(set YUQUE_ASSETS_DIR to point at the directory containing ${Object.values(LOCAL_ASSET_FILES).join(", ")})`
  )
}

/** 校验资源文件齐全（在资源目录原地校验，不再向源码 public/ 复制） */
async function assertAssetsComplete(dir: string): Promise<void> {
  const missing: string[] = []
  for (const file of Object.values(LOCAL_ASSET_FILES)) {
    if (!(await pathExists(path.resolve(dir, file)))) {
      missing.push(file)
    }
  }
  if (missing.length > 0) {
    throw new Error(`Missing local yuque asset file(s) in ${dir}: ${missing.join(", ")}.`)
  }
}

/** dev 中间件：把资源目录里的白名单文件按 HTTP 提供出去 */
function createAssetMiddleware(assetsDir: string): MiddlewareHandler {
  return (req, res, next) => {
    void (async () => {
      try {
        const name = decodeURIComponent((req.url ?? "/").split("?")[0]).replace(/\\/g, "/")
        const fileName = path.posix.basename(name)
        // 非本插件资源，交给后续中间件处理
        if (!LOCAL_FILE_SET.has(fileName)) {
          next()
          return
        }
        const full = path.resolve(assetsDir, fileName)
        // 防目录穿越（basename 已约束，双保险）
        if (!full.startsWith(path.resolve(assetsDir))) {
          next()
          return
        }
        const data = await fs.readFile(full)
        res.statusCode = 200
        res.setHeader(
          "Content-Type",
          MIME_TYPES[path.extname(fileName)] ?? "application/octet-stream"
        )
        res.setHeader("Cache-Control", "no-cache")
        res.end(data)
      } catch (err) {
        next(err)
      }
    })()
  }
}

/**
 * 提供 yuque 编辑器离线资源的 Vite 插件。
 *
 * 设计要点：
 * - dev 阶段通过中间件从资源目录实时提供 `/yuque-assets/*`，不写入源码 `public/`；
 * - build 阶段通过 `emitFile` 把资源打进 `dist/`，与 dev URL 一致；
 * - 不再像旧版那样把资源复制进 `public/yuque-assets`（会污染源码树并导致 ~18MB 重复入库）。
 */
export function yuqueAssets(
  options: YuqueAssetsVitePluginOptions = {}
): SimpleVitePlugin {
  const explicitAssetsDir = options.assetsDir
  let rootDir = process.cwd()
  // 去尾斜杠；空/根路径时回退默认值
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "") || DEFAULT_BASE_URL
  const outRelPath = baseUrl.replace(/^\/+/, "") || "yuque-assets"

  const resolveAssetsDir = async (): Promise<string> => {
    if (explicitAssetsDir) return path.resolve(explicitAssetsDir)
    return findLocalAssetsDir(rootDir)
  }

  return {
    name: "yuque-editor-core:yuque-assets",
    enforce: "pre",
    configResolved(config) {
      rootDir = config.root
    },
    async buildStart() {
      await assertAssetsComplete(await resolveAssetsDir())
    },
    async configureServer(server) {
      const assetsDir = await resolveAssetsDir()
      server.middlewares.use(baseUrl, createAssetMiddleware(assetsDir))
    },
    async generateBundle() {
      const assetsDir = await resolveAssetsDir()
      const ctx = this as unknown as {
        emitFile: (opts: {
          type: "asset"
          fileName: string
          source: string | Uint8Array
        }) => void
      }
      for (const file of Object.values(LOCAL_ASSET_FILES)) {
        const source = await fs.readFile(path.resolve(assetsDir, file))
        ctx.emitFile({ type: "asset", fileName: `${outRelPath}/${file}`, source })
      }
    }
  }
}

export default yuqueAssets
