/**
 * 块手柄控制器（对齐语雀：hover 块时左侧出现 ⋮⋮ 手柄，点击选中整块并弹出块菜单）。
 *
 * 设计约束（重要）：
 * - Lake 的三方命令集（execCommand）没有块级 API，内部模型也不对外暴露，
 *   因此本模块**不做任何直接的 DOM 结构操作**，全部交互走两条安全通道：
 *   1. DOM Selection：点击手柄时用 Range 选中整块内容——Lake 自身监听
 *      selectionchange，内部状态会跟随选区，命令即可命中当前块；
 *   2. execCommand：菜单动作全部映射既有命令（style/quote/indent/delete/copy/cut）。
 * - 拖拽排序涉及直接重排 Lake 渲染的块 DOM，内部模型同步行为未经验证，
 *   属于阶段 2（需先在 demo 验证），本模块暂不实现。
 */

import type { YuqueEditorRef } from "./editor"

/** 块菜单动作项；command 为 execCommand 命令名，action 为直接回调（二选一） */
export interface BlockMenuItem {
  label: string
  icon?: string
  command?: string
  args?: unknown[]
  action?: (editor: YuqueEditorRef) => void
  /** 分组标题（渲染为不可点的分组行） */
  heading?: boolean
}

export interface BlockHandleOptions {
  /** 编辑器根容器（createYuqueEditor 的 container，Lake 在其内渲染 .ne-engine） */
  container: HTMLElement
  /** 编辑器实例；菜单动作通过它的命令封装执行 */
  editor: YuqueEditorRef
  /** 深色模式（影响手柄与菜单配色） */
  darkMode?: boolean
  /** 默认块菜单；可通过 actions 覆盖 */
  actions?: BlockMenuItem[]
}

export interface BlockHandleController {
  destroy: () => void
}

const ENGINE_SELECTOR = ".ne-engine"
const HANDLE_ID = "yuque-block-handle"
const MENU_ID = "yuque-block-menu"

export const DEFAULT_BLOCK_ACTIONS: BlockMenuItem[] = [
  { label: "转为标题 1", command: "style", args: ["h1"] },
  { label: "转为标题 2", command: "style", args: ["h2"] },
  { label: "转为标题 3", command: "style", args: ["h3"] },
  { label: "转为正文", command: "style", args: ["p"] },
  { label: "转为引用", command: "quote" },
  { label: "增加缩进", command: "indent" },
  { label: "减少缩进", command: "outdent" },
  { label: "复制", command: "copy" },
  { label: "剪切", command: "cut" },
  { label: "删除", command: "delete" },
]

const BLOCK_BOUNDARY_TAGS = new Set([
  "P",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "UL",
  "OL",
  "BLOCKQUOTE",
  "TABLE",
  "PRE",
  "HR",
  "DIV",
])

export function createBlockHandleController(options: BlockHandleOptions): BlockHandleController {
  const { container, editor } = options
  const actions = options.actions ?? DEFAULT_BLOCK_ACTIONS
  const dark = !!options.darkMode

  const disposed = () => !handle.isConnected

  /** 手柄（⋮⋮）：懒创建，挂在 container 上以跟随滚动 */
  const handle = document.createElement("div")
  handle.id = HANDLE_ID
  handle.textContent = "⋮⋮"
  handle.style.cssText = [
    "position: absolute",
    "display: none",
    "align-items: center",
    "justify-content: center",
    "width: 22px",
    "height: 22px",
    "border-radius: 6px",
    "cursor: grab",
    "font-size: 14px",
    "line-height: 1",
    "letter-spacing: -2px",
    "user-select: none",
    "z-index: 30",
    `color: ${dark ? "rgba(255,255,255,0.45)" : "rgba(15,23,42,0.4)"}`,
    `background: ${dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.04)"}`,
  ].join(";")
  container.appendChild(handle)

  /** 块菜单：懒创建，挂在 container 上 */
  const menu = document.createElement("div")
  menu.id = MENU_ID
  menu.style.cssText = [
    "position: absolute",
    "display: none",
    "flex-direction: column",
    "min-width: 132px",
    "max-height: 320px",
    "overflow-y: auto",
    "padding: 4px",
    "border-radius: 10px",
    "z-index: 31",
    `background: ${dark ? "#1f1f1f" : "#ffffff"}`,
    `border: 1px solid ${dark ? "#333" : "#e5e7eb"}`,
    `box-shadow: 0 12px 32px ${dark ? "rgba(0,0,0,0.5)" : "rgba(15,23,42,0.12)"}`,
  ].join(";")
  container.appendChild(menu)

  const renderMenu = () => {
    menu.textContent = ""
    for (const item of actions) {
      const row = document.createElement(item.heading ? "div" : "button")
      row.textContent = item.label
      row.style.cssText = [
        "display: block",
        "width: 100%",
        "text-align: left",
        "padding: 5px 10px",
        "border: none",
        "border-radius: 6px",
        "background: transparent",
        "font-size: 12px",
        "cursor: pointer",
        `color: ${dark ? "rgba(255,255,255,0.78)" : "#374151"}`,
      ].join(";")
      if (item.heading) {
        row.style.cssText += `font-weight: 600;color:${dark ? "rgba(255,255,255,0.45)" : "#9ca3af"};cursor: default;`
      } else {
        row.addEventListener("mouseenter", () => {
          row.style.background = dark ? "rgba(255,255,255,0.08)" : "#f3f4f6"
        })
        row.addEventListener("mouseleave", () => {
          row.style.background = "transparent"
        })
        row.addEventListener("mousedown", (event) => {
          // 阻止 mousedown 清空选区：块内容仍处于选中态，命令才能命中
          event.preventDefault()
          event.stopPropagation()
          if (item.action) {
            item.action(editor)
          } else if (item.command) {
            // execCommand 走 YuqueEditorRef 未封装的命令时，用菜单自己的安全通道
            runCommand(item.command, item.args)
          }
          hideMenu()
          hideHandle()
        })
      }
      menu.appendChild(row)
    }
  }

  let currentBlock: Element | null = null

  const hideHandle = () => {
    handle.style.display = "none"
    currentBlock = null
  }

  const hideMenu = () => {
    menu.style.display = "none"
  }

  const runCommand = (command: string, args?: unknown[]) => {
    // 走 YuqueEditorRef 暴露的通用命令通道；命令不存在时 Lake 侧安全忽略
    editor.execCommand(command, ...(args ?? []))
  }

  /** 选中整个块的可见内容（Range 从块首到块尾） */
  const selectBlock = (block: Element) => {
    const range = document.createRange()
    range.selectNodeContents(block)
    const selection = window.getSelection()
    if (!selection) return
    selection.removeAllRanges()
    selection.addRange(range)
  }

  const positionHandleAt = (block: Element) => {
    const containerRect = container.getBoundingClientRect()
    const blockRect = block.getBoundingClientRect()
    handle.style.display = "flex"
    handle.style.top = `${blockRect.top - containerRect.top + Math.max((blockRect.height - 22) / 2, 0)}px`
    handle.style.left = `${Math.max(blockRect.left - containerRect.left - 30, 2)}px`
  }

  const handleContainerOver = (event: MouseEvent) => {
    if (menu.style.display === "flex") return
    const target = event.target as Element | null
    if (!target) return
    const engine = container.querySelector(ENGINE_SELECTOR)
    if (!engine || !engine.contains(target)) {
      hideHandle()
      return
    }

    // 向上找最近的块级子元素（限定为 engine 的直接子代，避免命中行内节点）
    let block: Element | null = target
    while (block && block.parentElement !== engine) {
      block = block.parentElement
      if (!block || block === container) {
        hideHandle()
        return
      }
    }
    if (!block || !BLOCK_BOUNDARY_TAGS.has(block.tagName)) {
      hideHandle()
      return
    }

    currentBlock = block
    positionHandleAt(block)
  }

  const handleContainerLeave = (event: MouseEvent) => {
    const related = event.relatedTarget as Node | null
    if (related && container.contains(related)) return
    hideHandle()
  }

  const handleDocumentDown = (event: MouseEvent) => {
    const target = event.target as Node | null
    if (menu.style.display !== "flex") return
    if (target && (menu.contains(target) || handle.contains(target))) return
    hideMenu()
  }

  const handleHandleDown = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (!currentBlock || disposed()) return
    // 关键顺序：先选中整块（Lake 跟随选区），再在原位弹出菜单
    selectBlock(currentBlock)
    renderMenu()
    const containerRect = container.getBoundingClientRect()
    const handleRect = handle.getBoundingClientRect()
    menu.style.display = "flex"
    const menuTop = handleRect.bottom - containerRect.top + 4
    const maxTop = containerRect.height - Math.min(menu.scrollHeight, 320) - 8
    menu.style.top = `${Math.max(Math.min(menuTop, Math.max(maxTop, 8)), 8)}px`
    menu.style.left = `${Math.max(handleRect.left - containerRect.left + 26, 2)}px`
  }

  container.addEventListener("mouseover", handleContainerOver)
  container.addEventListener("mouseleave", handleContainerLeave)
  handle.addEventListener("mousedown", handleHandleDown)
  document.addEventListener("mousedown", handleDocumentDown, true)

  return {
    destroy() {
      container.removeEventListener("mouseover", handleContainerOver)
      container.removeEventListener("mouseleave", handleContainerLeave)
      handle.removeEventListener("mousedown", handleHandleDown)
      document.removeEventListener("mousedown", handleDocumentDown, true)
      handle.remove()
      menu.remove()
    },
  }
}
