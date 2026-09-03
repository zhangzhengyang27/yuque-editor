import React, { useCallback, useEffect, useRef, useState } from "react"
import { YuqueRichText } from "yuque-editor-core/react"
import type { YuqueDocScheme, YuqueEditorRef, UploadResult } from "yuque-editor-core/editor"
import "./demo.css"

export const INITIAL_VALUE = `<h1>Hello Yuque Editor!</h1>
<p>这是一个 <strong>React 示例</strong>，使用 yuque-editor-core 加载语雀编辑器。</p>
<h2>功能特性</h2>
<ul>
  <li>富文本编辑 · 图片/视频上传</li>
  <li>工具栏 · 字号 · 对齐</li>
  <li>undo/redo · 加粗/斜体/下划线</li>
  <li>字数统计 · 格式切换</li>
</ul>
<p>试试编辑上面的内容吧！</p>
`

/** 模拟上传：真实项目里替换为自己的上传接口即可 */
async function fakeUpload(params: { type: string; data: string | File }): Promise<UploadResult> {
  console.log("[uploadImage] 触发上传：", params.type, params.data)
  const size =
    params.data instanceof File
      ? params.data.size
      : params.type === "base64"
        ? Math.ceil(String(params.data).length * 0.75)
        : 0
  return {
    url: `https://picsum.photos/seed/${Date.now()}/640/360`,
    size,
  }
}

const FONT_SIZES = [12, 15, 18, 22, 24, 29, 32]

const FOREGROUND_COLORS = ["#FF6B00", "#1677FF", "#52C41A", "#F5222D", "#722ED1", "#000000"]

const BACKGROUND_COLORS = ["#FFEB3B", "#E1F5FE", "#F3E5F5", "#E8F5E9", "#FFF3E0"]

type ParagraphStyle = "p" | "h1" | "h2" | "h3" | "h4"

const PARAGRAPH_STYLES: Array<{ value: ParagraphStyle; label: string }> = [
  { value: "p", label: "正文" },
  { value: "h1", label: "标题 1" },
  { value: "h2", label: "标题 2" },
  { value: "h3", label: "标题 3" },
  { value: "h4", label: "标题 4" },
]

const ALIGNMENTS = ["left", "center", "right", "justify"] as const

const EXPORT_SCHEMES: Array<{ scheme: YuqueDocScheme; label: string }> = [
  { scheme: "text/html", label: "HTML" },
  { scheme: "text/markdown", label: "Markdown" },
  { scheme: "text/plain", label: "纯文本" },
  { scheme: "text/lake", label: "Lake" },
  { scheme: "json", label: "JSON" },
]

type Theme = "light" | "dark"

/** 页面框架主题（Lake 编辑器内容区样式固定浅色，不受影响）；选择持久化到 localStorage */
function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("yuque-demo-theme")
    if (saved === "light" || saved === "dark") return saved
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem("yuque-demo-theme", theme)
  }, [theme])

  return [theme, () => setTheme((t) => (t === "dark" ? "light" : "dark"))]
}

type Alignment = (typeof ALIGNMENTS)[number]

/** 对齐图标的横线坐标：[x1, x2, y] */
const ALIGN_BARS: Record<Alignment, Array<[number, number, number]>> = {
  left: [
    [4, 16, 5],
    [4, 12, 9],
    [4, 16, 13],
    [4, 12, 17],
  ],
  center: [
    [6, 14, 5],
    [8, 12, 9],
    [6, 14, 13],
    [8, 12, 17],
  ],
  right: [
    [4, 16, 5],
    [8, 16, 9],
    [4, 16, 13],
    [8, 16, 17],
  ],
  justify: [
    [4, 16, 5],
    [4, 16, 9],
    [4, 16, 13],
    [4, 16, 17],
  ],
}

function AlignIcon({ type }: { type: Alignment }) {
  const bars = ALIGN_BARS[type]

  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      {bars.map(([x1, x2, y]) => (
        <line
          key={y}
          x1={x1}
          y1={y}
          x2={x2}
          y2={y}
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      ))}
    </svg>
  )
}

function Swatch({
  color,
  title,
  onPick,
}: {
  color: string
  title: string
  onPick: (color: string) => void
}) {
  return (
    <button
      type="button"
      className="swatch"
      style={{ background: color }}
      title={title}
      aria-label={title}
      onClick={() => onPick(color)}
    />
  )
}

export function DemoApp() {
  const editorRef = useRef<YuqueEditorRef | null>(null)
  const [content, setContent] = useState(INITIAL_VALUE)
  const [wordCount, setWordCount] = useState(0)
  const [empty, setEmpty] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [showRail, setShowRail] = useState(() => window.innerWidth >= 1080)
  const [theme, toggleTheme] = useTheme()

  // 字数统计需要全量序列化文档，长文档下开销大，对输入做防抖
  const wordCountTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const queueWordCount = useCallback(() => {
    if (wordCountTimer.current) clearTimeout(wordCountTimer.current)
    wordCountTimer.current = setTimeout(() => {
      wordCountTimer.current = null
      setWordCount(editorRef.current?.wordCount() ?? 0)
      setEmpty(editorRef.current?.isEmpty() ?? true)
    }, 200)
  }, [])

  const addLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString()
    setLogs((prev) => [`[${ts}] ${msg}`, ...prev].slice(0, 50))
  }, [])

  const handleChange = useCallback(
    (v: string) => {
      setContent(v)
      queueWordCount()
    },
    [queueWordCount],
  )

  const handleLoad = useCallback(() => {
    addLog("Editor loaded!")
    setWordCount(editorRef.current?.wordCount() ?? 0)
  }, [addLog])

  const handleError = useCallback(
    (err: Error) => {
      addLog(`ERROR: ${err.message}`)
    },
    [addLog],
  )

  const handleFocus = useCallback(() => addLog("focus"), [addLog])
  const handleBlur = useCallback(() => addLog("blur"), [addLog])
  const handleSelectionChange = useCallback(() => addLog("selectionchange"), [addLog])
  const handleFocusStatusChange = useCallback(
    (focused: boolean) => addLog(`focusstatuschange: ${focused}`),
    [addLog],
  )

  const clearLogs = useCallback(() => setLogs([]), [])

  const cmd = useCallback(
    (label: string, fn: () => void) => {
      try {
        fn()
        addLog(`exec: ${label}`)
      } catch (e) {
        addLog(`exec FAIL: ${label} — ${e instanceof Error ? e.message : String(e)}`)
      }
    },
    [addLog],
  )

  const resetContent = useCallback(() => {
    setContent("<p><strong>通过 setContent 重置的内容</strong></p>")
    addLog("setContent: reset")
  }, [addLog])

  const getSummary = useCallback(() => {
    const text = editorRef.current?.getSummaryContent() ?? ""
    addLog(`summary: "${text.slice(0, 60)}${text.length > 60 ? "…" : ""}"`)
  }, [addLog])

  const checkEmpty = useCallback(() => {
    addLog(`isEmpty: ${editorRef.current?.isEmpty()}`)
  }, [addLog])

  const logWordCount = useCallback(() => {
    addLog(`wordCount: ${editorRef.current?.wordCount()}`)
  }, [addLog])

  const exportAs = useCallback(
    (scheme: YuqueDocScheme) => {
      const v = editorRef.current?.getContent(scheme) ?? ""
      addLog(`${scheme}: "${v.slice(0, 80)}${v.length > 80 ? "…" : ""}"`)
    },
    [addLog],
  )

  const applyColor = useCallback(
    (color: string) => {
      editorRef.current?.setColor(color)
      addLog(`setColor: ${color}`)
    },
    [addLog],
  )

  const applyBgColor = useCallback(
    (color: string) => {
      editorRef.current?.setBgColor(color)
      addLog(`setBgColor: ${color}`)
    },
    [addLog],
  )

  const applyParagraph = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const style = e.target.value as ParagraphStyle
    cmd(`style=${style}`, () => editorRef.current!.setParagraphStyle(style))
  }

  const applyFontSize = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const size = Number(e.target.value)
    cmd(`fontsize=${size}`, () => editorRef.current!.setFontsize(size))
  }

  return (
    <div className="app">
      {/* ===== 顶栏 ===== */}
      <header className="app-header">
        <div className="header-inner">
          <div className="brand">
            <svg
              className="brand-mark"
              viewBox="0 0 28 28"
              width="28"
              height="28"
              aria-hidden="true"
            >
              <rect width="28" height="28" rx="8" fill="var(--accent)" />
              <path
                d="M8.5 19.5c5.5-.8 9.6-5.2 10.8-11-6 .9-10.2 5.2-10.8 11z"
                fill="#fff"
                opacity="0.95"
              />
            </svg>
            <span className="brand-name">Yuque Editor</span>
            <span className="brand-tag">React Demo</span>
          </div>
          <div className="header-actions">
            <button
              type="button"
              className={`ghost-btn ${showRail ? "active" : ""}`}
              onClick={() => setShowRail((v) => !v)}
              aria-pressed={showRail}
              title="显示 / 隐藏检查器与事件日志"
            >
              控制台
            </button>
            <button
              type="button"
              className="ghost-btn icon-only"
              onClick={toggleTheme}
              title="切换深浅主题"
              aria-label="切换主题"
            >
              {theme === "dark" ? "☀" : "☾"}
            </button>
          </div>
        </div>
      </header>

      {/* ===== 工作区 ===== */}
      <div className={`workspace ${showRail ? "" : "rail-hidden"}`}>
        <section className="main-col">
          {/* 分组工具栏（execCommand 演示） */}
          <div className="toolbar card" role="toolbar" aria-label="编辑器命令工具栏">
            <div className="tool-group">
              <button
                type="button"
                className="tool-btn"
                title="撤销 (undo)"
                aria-label="撤销"
                onClick={() => cmd("undo", () => editorRef.current!.undo())}
              >
                ↺
              </button>
              <button
                type="button"
                className="tool-btn"
                title="重做 (redo)"
                aria-label="重做"
                onClick={() => cmd("redo", () => editorRef.current!.redo())}
              >
                ↻
              </button>
            </div>

            <span className="tool-divider" />

            <div className="tool-group">
              <button
                type="button"
                className="tool-btn text-bold"
                title="加粗 (setBold)"
                onClick={() => cmd("bold", () => editorRef.current!.setBold())}
              >
                B
              </button>
              <button
                type="button"
                className="tool-btn text-italic"
                title="斜体 (setItalic)"
                onClick={() => cmd("italic", () => editorRef.current!.setItalic())}
              >
                I
              </button>
              <button
                type="button"
                className="tool-btn text-underline"
                title="下划线 (setUnderline)"
                onClick={() => cmd("underline", () => editorRef.current!.setUnderline())}
              >
                U
              </button>
              <button
                type="button"
                className="tool-btn text-strike"
                title="删除线 (setStrikethrough)"
                onClick={() => cmd("strikethrough", () => editorRef.current!.setStrikethrough())}
              >
                S
              </button>
              <button
                type="button"
                className="tool-btn"
                title="清除格式 (clearFormat)"
                onClick={() => cmd("clearFormat", () => editorRef.current!.clearFormat())}
              >
                <span className="tool-clear">清除</span>
              </button>
            </div>

            <span className="tool-divider" />

            <div className="tool-group">
              <span className="swatch-row">
                {FOREGROUND_COLORS.map((color) => (
                  <Swatch key={color} color={color} title={`字色 ${color}`} onPick={applyColor} />
                ))}
              </span>
              <button
                type="button"
                className="tool-btn"
                title="清除字色 (clearColor)"
                onClick={() => cmd("clearColor", () => editorRef.current!.clearColor())}
              >
                <span className="tool-clear">清字色</span>
              </button>
            </div>

            <div className="tool-group">
              <span className="swatch-row">
                {BACKGROUND_COLORS.map((color) => (
                  <Swatch key={color} color={color} title={`底色 ${color}`} onPick={applyBgColor} />
                ))}
              </span>
              <button
                type="button"
                className="tool-btn"
                title="清除底色 (clearBgColor)"
                onClick={() => cmd("clearBgColor", () => editorRef.current!.clearBgColor())}
              >
                <span className="tool-clear">清底色</span>
              </button>
            </div>

            <span className="tool-divider" />

            <div className="tool-group">
              <select
                className="tool-select"
                title="段落样式"
                aria-label="段落样式"
                defaultValue="p"
                onChange={applyParagraph}
              >
                {PARAGRAPH_STYLES.map((style) => (
                  <option key={style.value} value={style.value}>
                    {style.label}
                  </option>
                ))}
              </select>
              <select
                className="tool-select"
                title="字号"
                aria-label="字号"
                defaultValue="15"
                onChange={applyFontSize}
              >
                {FONT_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}px
                  </option>
                ))}
              </select>
            </div>

            <span className="tool-divider" />

            <div className="tool-group">
              {ALIGNMENTS.map((align) => (
                <button
                  key={align}
                  type="button"
                  className="tool-btn"
                  title={`对齐 ${align} (setAlignment)`}
                  aria-label={`对齐 ${align}`}
                  onClick={() =>
                    cmd(`alignment=${align}`, () => editorRef.current!.setAlignment(align))
                  }
                >
                  <AlignIcon type={align} />
                </button>
              ))}
              <button
                type="button"
                className="tool-btn"
                title="增加缩进 (indent)"
                aria-label="增加缩进"
                onClick={() => cmd("indent", () => editorRef.current!.indent())}
              >
                ⇥
              </button>
              <button
                type="button"
                className="tool-btn"
                title="减少缩进 (outdent)"
                aria-label="减少缩进"
                onClick={() => cmd("outdent", () => editorRef.current!.outdent())}
              >
                ⇤
              </button>
            </div>
          </div>

          {/* 编辑器主卡片 */}
          <div className="editor-card card">
            <div className="editor-shell">
              <YuqueRichText
                ref={editorRef}
                value={content}
                onChange={handleChange}
                onLoad={handleLoad}
                onError={handleError}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onSelectionChange={handleSelectionChange}
                onFocusStatusChange={handleFocusStatusChange}
                uploadImage={fakeUpload}
                showToolbar
                showToc={true}
              />
            </div>
            <div className="editor-foot">
              <span className="pill">
                字数<b>{wordCount}</b>
              </span>
              <span className="pill">
                字符<b>{content.length}</b>
              </span>
              <span className="pill">
                isEmpty<b>{empty ? "true" : "false"}</b>
              </span>
              <span className="foot-hint">粘贴图片可触发 uploadImage（结果见浏览器控制台）</span>
            </div>
          </div>
        </section>

        {/* ===== 右侧：检查器 + 事件日志 ===== */}
        {showRail && (
          <aside className="rail">
            <section className="rail-section card">
              <h2 className="rail-title">检查器</h2>
              <div className="inspector-grid">
                <button type="button" className="cell-btn" onClick={resetContent}>
                  重置内容
                </button>
                <button type="button" className="cell-btn" onClick={getSummary}>
                  纯文本摘要
                </button>
                <button type="button" className="cell-btn" onClick={checkEmpty}>
                  isEmpty
                </button>
                <button type="button" className="cell-btn" onClick={logWordCount}>
                  字数统计
                </button>
                <button
                  type="button"
                  className="cell-btn"
                  onClick={() => cmd("focusToStart", () => editorRef.current!.focusToStart())}
                >
                  光标至开头
                </button>
                <button
                  type="button"
                  className="cell-btn"
                  onClick={() => cmd("selectAll", () => editorRef.current!.selectAll())}
                >
                  全选
                </button>
              </div>

              <h2 className="rail-title" style={{ marginTop: 16 }}>
                导出格式
              </h2>
              <div className="scheme-row">
                {EXPORT_SCHEMES.map(({ scheme, label }) => (
                  <button
                    key={scheme}
                    type="button"
                    className="cell-btn"
                    onClick={() => exportAs(scheme)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <p className="rail-hint">
                命令结果输出到下方事件日志。粘贴一张图片即可触发 uploadImage 模拟上传。
              </p>
            </section>

            <section className="rail-section card logs-section">
              <div className="logs-head">
                <h2 className="rail-title">
                  事件日志 <span className="count">{logs.length}</span>
                </h2>
                <button type="button" className="text-btn" onClick={clearLogs}>
                  清空
                </button>
              </div>
              <div className="logs">
                {logs.length === 0 ? (
                  <span className="logs-empty">操作编辑器，事件日志将显示在这里…</span>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className={`log-line ${i === 0 ? "latest" : ""}`}>
                      {log}
                    </div>
                  ))
                )}
              </div>
            </section>
          </aside>
        )}
      </div>
    </div>
  )
}

export default DemoApp
