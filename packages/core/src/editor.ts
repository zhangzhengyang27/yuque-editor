import { localAssets } from "./assets"

/**
 * 语雀编辑器支持的文档格式类型
 * - text/html: 标准 HTML 格式
 * - text/markdown: Markdown 格式
 * - text/plain: 纯文本格式
 * - text/lake: 语雀内部 lake 格式
 * - json: JSON 格式
 */
export type YuqueDocScheme = "text/html" | "text/markdown" | "text/plain" | "text/lake" | "json"

export interface UploadResult {
  url: string
  size: number
  /** 上传后的文件名（服务端返回） */
  filename?: string
  /** 视频封面地址（仅视频上传需要） */
  cover?: string
}

export interface EditorUploadHandler {
  (params: { type: "url" | "file" | "base64"; data: string | File }): Promise<UploadResult>
}

export interface YuqueEditorAssets {
  docCss: string
  antdCss: string
  react: string
  reactDom: string
  codeMirror: string
  kitchenScript: string
  docUmd: string
  katex?: string
}

export interface YuqueEditorOptions {
  container: HTMLElement
  value?: string
  scheme?: YuqueDocScheme
  readOnly?: boolean
  assets?: Partial<YuqueEditorAssets>
  onChange?: (value: string) => void
  onLoad?: () => void
  onError?: (error: Error) => void
  onFocus?: () => void
  onBlur?: () => void
  onSelectionChange?: () => void
  onFocusStatusChange?: (focused: boolean) => void
  onBeforeDestroy?: () => void
  uploadImage?: EditorUploadHandler
  uploadVideo?: EditorUploadHandler
  showToolbar?: boolean
  showToc?: boolean
  paragraphSpacing?: boolean
  defaultFontSize?: number
  darkMode?: boolean
  disabledToolbarItems?: string[]
  toolbarItems?: string[]
}

export interface YuqueEditorRef {
  appendContent: (html: string, breakLine?: boolean) => void
  setContent: (content: string, type?: YuqueDocScheme) => void
  getContent: (type?: YuqueDocScheme) => string
  isEmpty: () => boolean
  getSummaryContent: () => string
  wordCount: () => number
  focusToStart: (offset?: number) => void
  insertBreakLine: () => void
  destroy: () => void
  // === execCommand 封装 ===
  undo: () => void
  redo: () => void
  insertText: (text: string) => void
  setBold: (value?: boolean) => void
  setItalic: (value?: boolean) => void
  setUnderline: (value?: boolean) => void
  setStrikethrough: (value?: boolean) => void
  setColor: (color: string) => void
  setBgColor: (color: string) => void
  clearColor: () => void
  clearBgColor: () => void
  setAlignment: (value: "left" | "right" | "center" | "justify" | "distributed") => void
  setParagraphStyle: (style: "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6") => void
  setFontsize: (size: number) => void
  indent: () => void
  outdent: () => void
  clearFormat: () => void
  selectAll: () => void
  getWordCount: () => number
}

interface ThirdPartyUploadRequest {
  type?: string
  data: string | File
}

interface ThirdPartyEditorOptions {
  disabledPlugins: string[]
  defaultFontsize: number
  darkMode: boolean
  typography: {
    typography: "classic"
    paragraphSpacing: "relax" | "default"
  }
  toc: {
    enable: boolean
  }
  codeblock: {
    codemirrorURL: string
    supportCustomStyle: boolean
  }
  math?: {
    KaTexURL: string
  }
  image?: {
    createUploadPromise: (request: ThirdPartyUploadRequest) => Promise<UploadResult>
  }
  video?: {
    createUploadPromise: (request: ThirdPartyUploadRequest) => Promise<UploadResult>
  }
  toolbar?: {
    agentConfig?: {
      default?: {
        items?: unknown[]
      }
    }
  }
}

interface ThirdPartyEditor {
  on?: (event: string, handler: (...args: unknown[]) => void) => void | (() => void)
  setDocument: (type: YuqueDocScheme, content: string) => void
  getDocument: (
    type: YuqueDocScheme,
    options?: { includeMeta?: boolean }
  ) => string
  execCommand?: (command: string, ...args: unknown[]) => unknown
  destroy?: () => void
}

interface ThirdPartyDoc {
  createOpenEditor?: (
    container: HTMLElement,
    options: ThirdPartyEditorOptions
  ) => ThirdPartyEditor
  createOpenViewer?: (
    container: HTMLElement,
    options: ThirdPartyEditorOptions
  ) => ThirdPartyEditor
}

type ManagedLinkElement = HTMLLinkElement & {
  _yuqueLoaded?: boolean
  _yuqueFailed?: boolean
}
type ManagedScriptElement = HTMLScriptElement & {
  _yuqueLoaded?: boolean
  _yuqueFailed?: boolean
}

/**
 * 资源加载器注册表（模块级）。
 *
 * ⚠️ 仅供浏览器环境使用。SSR / 测试场景可通过 `resetAssetLoaders()` 重置。
 */
const assetLoaders = new Map<string, Promise<void>>()

const DEFAULT_ASSETS: YuqueEditorAssets = localAssets("/yuque-assets")

function registerLoader(url: string, loader: Promise<void>): Promise<void> {
  assetLoaders.set(url, loader)
  void loader.catch(() => {
    if (assetLoaders.get(url) === loader) {
      assetLoaders.delete(url)
    }
  })
  return loader
}

/**
 * 重置资源加载器注册表。
 * 适用于 SSR 多请求隔离、单元测试清理、HMR 等场景。
 */
export function resetAssetLoaders(): void {
  assetLoaders.clear()
}

/**
 * 浅比较两个值是否"语义相等"。
 * 用于判断 props 中的对象/函数是否真正发生了变化。
 */
export function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a == null || b == null) return false
  if (typeof a !== typeof b) return false
  if (typeof a === "function") return true // 函数不比较，靠调用频率控制
  if (typeof a === "object") {
    const ka = Object.keys(a as object)
    const kb = Object.keys(b as object)
    if (ka.length !== kb.length) return false
    return ka.every((k) => (a as Record<string, unknown>)[k] === (b as Record<string, unknown>)[k])
  }
  return false
}

/** 将任意类型的错误统一转为 Error 实例 */
export function normalizeError(error: unknown): Error {
  if (error instanceof Error) return error
  return new Error(String(error))
}

function mergeAssets(assets?: Partial<YuqueEditorAssets>): YuqueEditorAssets {
  return { ...DEFAULT_ASSETS, ...(assets ?? {}) }
}

/** 是否开启调试日志，设置环境变量 YUQUE_EDITOR_DEBUG=1 启用 */
const DEBUG =
  typeof globalThis !== "undefined" &&
  !!(globalThis as Record<string, unknown>).YUQUE_EDITOR_DEBUG

/**
 * 在销毁流程/竞态场景下，第三方编辑器内部可能会抛出各种 TypeError。
 * 为避免把这些"已知无害"的错误冒泡到宿主应用，这里统一做一层兜底。
 * 开启 YUQUE_EDITOR_DEBUG=1 可在控制台查看被吞掉的错误。
 */
function safeCall<T>(fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch (e) {
    if (DEBUG) console.warn("[yuque-editor-core] safeCall suppressed:", e)
    return fallback
  }
}

function loadStyleOnce(url: string): Promise<void> {
  if (assetLoaders.has(url)) return assetLoaders.get(url)!

  const p = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(
      `link[data-yuque-asset="${url}"]`
    ) as ManagedLinkElement | null
    if (existing) {
      if (existing._yuqueFailed) {
        existing.remove()
      } else {
        resolve()
        return
      }
    }

    const link = document.createElement("link") as ManagedLinkElement
    link.rel = "stylesheet"
    link.type = "text/css"
    link.href = url
    link.dataset.yuqueAsset = url
    link.onload = () => {
      link._yuqueLoaded = true
      link._yuqueFailed = false
      resolve()
    }
    link.onerror = () => {
      link._yuqueFailed = true
      reject(new Error(`Failed to load style: ${url}`))
    }
    document.head.appendChild(link)
  })

  return registerLoader(url, p)
}

function loadScriptOnce(url: string): Promise<void> {
  if (assetLoaders.has(url)) return assetLoaders.get(url)!

  const p = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(
      `script[data-yuque-asset="${url}"]`
    ) as ManagedScriptElement | null
    if (existing) {
      const readyState = (existing as any).readyState
      if (existing._yuqueFailed) {
        existing.remove()
      } else if (
        existing._yuqueLoaded ||
        readyState === "loaded" ||
        readyState === "complete"
      ) {
        resolve()
      } else {
        existing.addEventListener("load", () => resolve(), { once: true })
        existing.addEventListener(
          "error",
          () => reject(new Error(`Failed to load script: ${url}`)),
          {
            once: true
          }
        )
      }
      return
    }

    const script = document.createElement("script") as ManagedScriptElement
    script.src = url
    script.async = false
    script.dataset.yuqueAsset = url
    script.onload = () => {
      script._yuqueLoaded = true
      script._yuqueFailed = false
      resolve()
    }
    script.onerror = () => {
      script._yuqueFailed = true
      reject(new Error(`Failed to load script: ${url}`))
    }
    document.body.appendChild(script)
  })

  return registerLoader(url, p)
}

/**
 * 分层并行加载编辑器离线资源，减少 RTT 等待：
 * - 第一层：CSS 全部并行
 * - 第二层：React 相关 + 无依赖脚本并行
 * - 第三层：有依赖的脚本串行（kitchen → docUmd）
 */
async function ensureAssets(assets: YuqueEditorAssets) {
  // 第一层：CSS 并行加载
  await Promise.all([
    loadStyleOnce(assets.docCss),
    loadStyleOnce(assets.antdCss)
  ])
  // 第二层：React 依赖链 + 无依赖脚本并行
  await Promise.all([
    loadScriptOnce(assets.react),
    loadScriptOnce(assets.reactDom),
    loadScriptOnce(assets.codeMirror),
    assets.katex
      ? loadScriptOnce(assets.katex)
      : Promise.resolve()
  ])
  // 第三层：有严格顺序依赖的脚本串行
  await loadScriptOnce(assets.kitchenScript)
  await loadScriptOnce(assets.docUmd)
}

function stripHtml(html: string): string {
  // ⚠️ 依赖 DOM API（document.createElement），仅限浏览器环境调用
  const tmp = document.createElement("div")
  tmp.innerHTML = html
  return (tmp.textContent ?? "").trim()
}

function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/<\/?[^>]+>/g, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s+/gm, "")
    .replace(/^(\s*[-*+]|\s*\d+\.)\s+/gm, "")
    .replace(/[*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function stripByScheme(content: string, scheme: YuqueDocScheme): string {
  if (scheme === "text/markdown") return stripMarkdown(content)
  if (scheme === "text/plain") return content.trim()
  // text/lake / json 都走 HTML 降级
  return stripHtml(content)
}

export async function createYuqueEditor(
  options: YuqueEditorOptions
): Promise<YuqueEditorRef> {
  const assets = mergeAssets(options.assets)
  await ensureAssets(assets)

  const doc = (window as Window & { Doc?: ThirdPartyDoc }).Doc
  if (!doc || (!doc.createOpenEditor && !doc.createOpenViewer)) {
    throw new Error(
      "yuque-editor-core：未检测到 window.Doc（doc.umd.js 可能未正确加载）"
    )
  }

  let currentScheme: YuqueDocScheme = options.scheme ?? "text/html"
  const create = options.readOnly ? doc.createOpenViewer : doc.createOpenEditor
  if (typeof create !== "function") {
    throw new Error(
      options.readOnly
        ? "yuque-editor-core：当前环境不支持只读查看器 createOpenViewer"
        : "yuque-editor-core：当前环境不支持编辑器 createOpenEditor"
    )
  }

  const disabledPlugins: string[] = []
  if (options.showToolbar === false) disabledPlugins.push("toolbar")
  if (options.readOnly) disabledPlugins.push("save")

  // toolbar 配置优先级：toolbarItems > disabledToolbarItems > 默认
  let toolbarConfig: ThirdPartyEditorOptions["toolbar"] | undefined
  if (options.toolbarItems != null) {
    toolbarConfig = { agentConfig: { default: { items: options.toolbarItems } } }
  } else if (options.disabledToolbarItems != null) {
    toolbarConfig = { agentConfig: { default: { items: options.disabledToolbarItems } } }
  }

  // 创建编辑器 root 容器，隔离编辑器 DOM 与宿主 container
  const editorRoot = document.createElement("div")
  options.container.appendChild(editorRoot)

  const editor = create(editorRoot, {
    disabledPlugins,
    defaultFontsize: options.defaultFontSize ?? 15,
    darkMode: !!options.darkMode,
    typography: {
      typography: "classic",
      paragraphSpacing: options.paragraphSpacing ? "relax" : "default"
    },
    toc: {
      enable: options.showToc ?? false
    },
    codeblock: {
      codemirrorURL: assets.codeMirror,
      supportCustomStyle: true
    },
    math: assets.katex
      ? {
          KaTexURL: assets.katex
        }
      : undefined,
    toolbar: toolbarConfig,
    image: options.uploadImage
      ? {
          async createUploadPromise(request: ThirdPartyUploadRequest) {
            const type = request.type as "url" | "file" | "base64"
            return options.uploadImage!({
              type: type ?? "file",
              data: request.data
            })
          }
        }
      : undefined,
    video: options.uploadVideo
      ? {
          async createUploadPromise(request: ThirdPartyUploadRequest) {
            const type = request.type as "url" | "file" | "base64"
            return options.uploadVideo!({
              type: type ?? "file",
              data: request.data
            })
          }
        }
      : undefined
  })

  let disposed = false
  /** 记录最后一次 setDocument 设置的内容，用于避免多余 onChange 派发 */
  let lastSetContent = ""
  const disposers: Array<() => void> = []

  if (typeof editor?.on === "function") {
    const off = editor.on("contentchange", () => {
      if (disposed) return
      const v = safeCall(
        () => editor.getDocument(currentScheme, { includeMeta: true }),
        ""
      )
      if (v === lastSetContent) {
        lastSetContent = "" // 只跳过一次
        return
      }
      options.onChange?.(v)
    })
    if (typeof off === "function") disposers.push(off)

    // focus 事件
    if (options.onFocus) {
      const offFocus = editor.on("focus", () => {
        if (disposed) return
        options.onFocus?.()
      })
      if (typeof offFocus === "function") disposers.push(offFocus)
    }

    // blur 事件
    if (options.onBlur) {
      const offBlur = editor.on("blur", () => {
        if (disposed) return
        options.onBlur?.()
      })
      if (typeof offBlur === "function") disposers.push(offBlur)
    }

    // selectionchange 事件
    if (options.onSelectionChange) {
      const offSel = editor.on("selectionchange", () => {
        if (disposed) return
        options.onSelectionChange?.()
      })
      if (typeof offSel === "function") disposers.push(offSel)
    }

    // focusstatuschange 事件
    if (options.onFocusStatusChange) {
      const offFs = editor.on("focusstatuschange", (focused: unknown) => {
        if (disposed) return
        options.onFocusStatusChange?.(!!focused)
      })
      if (typeof offFs === "function") disposers.push(offFs)
    }
  }

  if (options.value != null) {
    safeCall(() => {
      editor.setDocument(currentScheme, options.value!)
      lastSetContent = options.value!
      return undefined
    }, undefined)
  }

  try {
    options.onLoad?.()
  } catch (e) {
    // onLoad 回调由宿主应用提供，异常不应影响编辑器本身
    // console.warn("[yuque-editor-core] onLoad callback error:", e)
    options.onError?.(normalizeError(e))
  }

  const exec = (cmd: string, ...args: unknown[]) => {
    if (disposed) return
    if (typeof editor.execCommand === "function") {
      safeCall(() => {
        editor.execCommand!(cmd, ...args)
        return undefined
      }, undefined)
    }
  }

  const api: YuqueEditorRef = {
    appendContent(html, breakLine) {
      if (disposed) return
      const content = breakLine ? `<p><br /></p>${html}` : html
      if (typeof editor.execCommand === "function") {
        safeCall(() => {
          editor.execCommand!("insertAtSelection", "text/html", content)
          return undefined
        }, undefined)
        return
      }
      const current = safeCall(
        () => editor.getDocument("text/html", { includeMeta: true }),
        ""
      )
      safeCall(() => {
        editor.setDocument("text/html", `${current}${content}`)
        return undefined
      }, undefined)
    },
    setContent(content, type = currentScheme) {
      if (disposed) return
      currentScheme = type
      lastSetContent = content
      safeCall(() => {
        editor.setDocument(type, content)
        return undefined
      }, undefined)
    },
    getContent(type = currentScheme) {
      if (disposed) return ""
      return safeCall(() => editor.getDocument(type, { includeMeta: true }), "")
    },
    isEmpty() {
      if (disposed) return true
      const doc = safeCall(
        () => editor.getDocument(currentScheme, { includeMeta: true }),
        ""
      )
      return stripByScheme(doc, currentScheme).length === 0
    },
    getSummaryContent() {
      if (disposed) return ""
      const doc = safeCall(
        () => editor.getDocument(currentScheme, { includeMeta: true }),
        ""
      )
      return stripByScheme(doc, currentScheme)
    },
    wordCount() {
      if (disposed) return 0
      const text = api.getSummaryContent()
      const chinese = text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g)?.length ?? 0
      const english = text.match(/[a-zA-Z]+/g)?.length ?? 0
      return chinese + english
    },
    focusToStart(offset = 0) {
      if (disposed) return
      if (typeof editor.execCommand === "function") {
        safeCall(() => {
          editor.execCommand!("focus", "start", offset)
          return undefined
        }, undefined)
      }
    },
    insertBreakLine() {
      if (disposed) return
      if (typeof editor.execCommand === "function") {
        safeCall(() => {
          editor.execCommand!("insertAtSelection", "text/html", "<p><br /></p>")
          return undefined
        }, undefined)
      }
    },
    destroy() {
      if (disposed) return
      options.onBeforeDestroy?.()
      disposed = true
      for (const d of disposers) d()
      if (typeof editor?.destroy === "function") {
        safeCall(() => {
          editor.destroy!()
          return undefined
        }, undefined)
      }
      editorRoot.remove()
    },
    // === execCommand 封装 ===
    undo() { exec("undo") },
    redo() { exec("redo") },
    insertText(text: string) { exec("insertText", text) },
    setBold(value?: boolean) { exec("bold", value) },
    setItalic(value?: boolean) { exec("italic", value) },
    setUnderline(value?: boolean) { exec("underline", value) },
    setStrikethrough(value?: boolean) { exec("strikethrough", value) },
    setColor(color: string) { exec("color", color) },
    setBgColor(color: string) { exec("bgColor", color) },
    clearColor() { exec("clearColor") },
    clearBgColor() { exec("clearBgColor") },
    setAlignment(value) { exec("alignment", value) },
    setParagraphStyle(style) { exec("style", style) },
    setFontsize(size: number) { exec("fontsize", size) },
    indent() { exec("indent") },
    outdent() { exec("outdent") },
    clearFormat() { exec("clearFormat") },
    selectAll() { exec("selectAll") },
    getWordCount() { return api.wordCount() }
  }

  return api
}
