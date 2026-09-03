/**
 * Lake 编辑器 DOM 布局修正与渲染检测（React / Vue 封装共用）。
 *
 * Lake 的内部结构是一串 `.ne-*` 容器，默认块级布局下长文档无法撑满宿主给定的
 * 固定高度容器；这里在同步受控值之前做一次布局修正，并提供「内容是否真的
 * 渲染到了 DOM」的检测，供 ValueSyncer 的重试校验使用。
 */

/**
 * 大纲（TOC）展开时的正文避让样式。
 *
 * Lake 的 doc.css 自带等价规则（adapt 模式下给 `.ne-engine > *` 加
 * `margin-right: 280px`），但其选择器要求祖先存在 `.ne-doc-major-editor`；
 * 通过 `createOpenEditor` 直接挂载时 Lake 不会添加该类，导致大纲面板
 * 展开后覆盖正文。这里注入一份不依赖该祖先类的等价规则。
 *
 * - 展开态由 Lake 挂在 `.ne-editor` 上的 `.ne-normal-toc` 类标记，
 *   收起后类被移除，规则自动失配，正文恢复全宽；
 * - 保留 Lake 原生的 `:not(.ne-ui-sidebar-visible)` 守卫与 280px 数值，
 *   与语雀产品行为一致；
 * - 全文档只注入一次（规则对未开启大纲的实例天然失配，多实例安全）。
 */
export function ensureTocAvoidanceStyle(doc: Document = document): void {
  if (doc.querySelector("style[data-yuque-toc-avoidance]")) return
  const style = doc.createElement("style")
  style.setAttribute("data-yuque-toc-avoidance", "")
  style.textContent =
    ".ne-editor.ne-normal-toc:not(.ne-ui-sidebar-visible) .ne-engine > * { margin-right: 280px; }"
  doc.head.appendChild(style)
}

/**
 * 可读的文字选区样式。
 *
 * Lake 的 doc.css 用 `color: inherit !important` 声明选区文字色，但在
 * Chrome 深色模式下 `inherit` 会解析成系统的 HighlightText（白色），
 * 叠加 antd.css 全局 `::selection { color: #fff }` 的视觉效果，
 * 选中文字变成「浅蓝底 + 白字」，几乎不可读。
 * 这里显式声明深色文字与适度的蓝色高亮，保证可读性。
 * 全文档只注入一次。
 */
export function ensureReadableSelectionStyle(doc: Document = document): void {
  if (doc.querySelector("style[data-yuque-selection]")) return
  const style = doc.createElement("style")
  style.setAttribute("data-yuque-selection", "")
  style.textContent = [
    ".ne-engine ::selection,",
    ".ne-viewer .ne-viewer-body ::selection {",
    "background: rgba(51, 112, 255, 0.26) !important;",
    "color: #262626 !important;",
    "}",
  ].join(" ")
  doc.head.appendChild(style)
}

/** 判断编辑器容器里是否已经渲染出了可见文本 */
export function hasRenderedContent(container: HTMLElement | null, value: string): boolean {
  if (!container) return false
  if (!value.trim()) return true
  const engine = container.querySelector(".ne-engine")
  const text = engine?.textContent?.trim() ?? ""
  return text.length > 0
}

/**
 * 把 Lake 的容器链拉伸为 flex 列布局，使编辑器主体随宿主容器伸缩。
 *
 * ⚠️ 依赖 Lake 1.67.0 的内部类名（`.ne-*`），升级 doc.umd.js 后需同步核对；
 * 选择器未命中时静默跳过，不会破坏布局。
 */
export function applyEditorLayout(container: HTMLElement | null): void {
  if (!container) return

  const setStyle = (element: Element | null, styles: Partial<CSSStyleDeclaration>) => {
    if (!(element instanceof HTMLElement)) return
    Object.assign(element.style, styles)
  }

  const stretch = {
    display: "flex",
    flex: "1 1 auto",
    flexDirection: "column",
    minHeight: "100%",
    height: "100%",
  } as const

  const stretchClamped = {
    display: "flex",
    flex: "1 1 auto",
    flexDirection: "column",
    minHeight: "0",
    height: "100%",
  } as const

  setStyle(container, stretch)

  setStyle(container.firstElementChild, stretch)

  const editor = container.querySelector(".ne-editor")
  setStyle(editor, stretch)

  const adapt = container.querySelector(".ne-layout-mode-adapt")
  setStyle(adapt, stretch)

  setStyle(container.querySelector(".ne-ui"), {
    display: "flex",
    flex: "0 0 auto",
    flexDirection: "column",
  })

  setStyle(container.querySelector(".ne-editor-body"), stretchClamped)
  setStyle(container.querySelector(".ne-editor-wrap"), stretchClamped)
  setStyle(container.querySelector(".ne-editor-wrap-content"), stretchClamped)
  setStyle(container.querySelector(".ne-editor-outer-wrap-box"), stretchClamped)

  ;[".ne-editor-wrap-box", ".ne-editor-box", ".ne-engine-box"].forEach((selector) => {
    setStyle(container.querySelector(selector), stretchClamped)
  })

  ;[".ne-engine", ".ne-view"].forEach((selector) => {
    setStyle(container.querySelector(selector), {
      flex: "1 1 auto",
      minHeight: "100%",
      height: "100%",
    })
  })
}
