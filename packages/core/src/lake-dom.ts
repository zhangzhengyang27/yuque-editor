/**
 * Lake 编辑器 DOM 布局修正与渲染检测（React / Vue 封装共用）。
 *
 * Lake 的内部结构是一串 `.ne-*` 容器，默认块级布局下长文档无法撑满宿主给定的
 * 固定高度容器；这里在同步受控值之前做一次布局修正，并提供「内容是否真的
 * 渲染到了 DOM」的检测，供 ValueSyncer 的重试校验使用。
 */

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
