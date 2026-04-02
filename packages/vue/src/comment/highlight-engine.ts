/**
 * 评论高亮引擎 — Canvas 覆盖层实现，不破坏编辑器 DOM 结构
 *
 * 核心思路：
 * 1. 在编辑器容器上叠加一个同尺寸的 Canvas
 * 2. Canvas pointer-events: none，不阻挡底层交互
 * 3. 通过 DOM Range API 计算选区位置，在 Canvas 上绘制高亮矩形
 * 4. 使用 XPath-like childIndices 路径序列化位置，支持跨会话持久化
 */

import type { HighlightSelection } from './types'

const HIGHLIGHT_COLOR = 'rgba(255, 224, 60, 0.4)'      // 正常高亮
const HIGHLIGHT_ACTIVE_COLOR = 'rgba(255, 180, 0, 0.6)'  // 激活/悬浮
const HIGHLIGHT_RESOLVED_COLOR = 'rgba(160, 220, 160, 0.35)' // 已解决

export interface HighlightEngineOptions {
  /** 需要叠加 Canvas 的容器 */
  container: HTMLElement
  /** 父级可滚动元素（用于 scroll 事件更新） */
  scrollContainer?: HTMLElement
}

export interface HighlightEntry {
  id: string
  selection: HighlightSelection
  resolved: boolean
}



/**
 * 从根容器到目标节点的 childIndices 路径
 */
export function getNodePath(root: Node, target: Node): number[] | null {
  const path: number[] = []
  let current = target
  while (current && current !== root) {
    const parent = current.parentNode
    if (!parent) return null
    const index = Array.from(parent.childNodes).indexOf(current as ChildNode)
    if (index === -1) return null
    path.unshift(index)
    current = parent
  }
  if (current !== root) return null
  return path
}

/**
 * 根据路径从根容器找到目标节点
 */
export function getNodeByPath(root: Node, path: number[]): Node | null {
  let current = root
  for (const index of path) {
    if (!current || !current.childNodes[index]) return null
    current = current.childNodes[index]
  }
  return current
}

/**
 * 从 Selection 创建 HighlightSelection 数据
 */
export function selectionToHighlight(
  root: HTMLElement,
  selection: Selection
): HighlightSelection | null {
  if (selection.rangeCount === 0 || selection.isCollapsed) return null

  const range = selection.getRangeAt(0)
  const startPath = getNodePath(root, range.startContainer)
  const endPath = getNodePath(root, range.endContainer)

  if (!startPath || !endPath) return null
  if (startPath.length === 0 && endPath.length === 0) return null

  return {
    startPath,
    startOffset: range.startOffset,
    endPath,
    endOffset: range.endOffset,
    text: selection.toString().trim()
  }
}

/**
 * 高亮引擎：管理 Canvas 覆盖层，绘制/更新/清除高亮
 */
export class HighlightEngine {
  private canvas: HTMLCanvasElement
  private container: HTMLElement
  private scrollContainer: HTMLElement
  private entries = new Map<string, HighlightEntry>()
  private activeId: string | null = null
  private hoveredId: string | null = null
  private _resizeObserver: ResizeObserver | null = null
  private _scrollBound = false

  constructor(options: HighlightEngineOptions) {
    this.container = options.container
    this.scrollContainer = options.scrollContainer ?? options.container

    // 创建 Canvas 覆盖层
    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: none;
      z-index: 1;
    `

    // 确保容器是定位上下文
    const containerStyle = getComputedStyle(this.container)
    if (containerStyle.position === 'static') {
      this.container.style.position = 'relative'
    }
    this.container.appendChild(this.canvas)

    this.setupResize()
    this.setupScroll()
    this.redraw()
  }

  /** 确保容器是定位上下文，Canvas 正确定位 */
  private setupResize() {
    this._resizeObserver = new ResizeObserver(() => {
      this.resizeCanvas()
      this.redraw()
    })
    this._resizeObserver.observe(this.container)
  }

  /** 监听滚动事件，实时更新高亮位置 */
  private setupScroll() {
    if (this._scrollBound) return
    this._scrollBound = true

    const update = () => {
      this.redraw()
      requestAnimationFrame(update)
    }
    // 使用 IntersectionObserver + scroll 事件来高效检测可见性
    this.scrollContainer.addEventListener('scroll', () => {
      this.redraw()
    }, { passive: true })
  }

  /** 同步 Canvas 尺寸与容器 */
  resizeCanvas() {
    const rect = this.container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    this.canvas.width = rect.width * dpr
    this.canvas.height = rect.height * dpr
    this.canvas.style.width = `${rect.width}px`
    this.canvas.style.height = `${rect.height}px`
    const ctx = this.canvas.getContext('2d')
    if (ctx) ctx.scale(dpr, dpr)
  }

  /** 添加/更新一条高亮 */
  addHighlight(id: string, selection: HighlightSelection, resolved = false) {
    this.entries.set(id, { id, selection, resolved })
    this.redraw()
  }

  /** 移除一条高亮 */
  removeHighlight(id: string) {
    this.entries.delete(id)
    this.redraw()
  }

  /** 更新高亮状态（已解决/未解决） */
  updateResolved(id: string, resolved: boolean) {
    const entry = this.entries.get(id)
    if (entry) {
      entry.resolved = resolved
      this.redraw()
    }
  }

  /** 设置激活的高亮（点击评论面板时） */
  setActive(id: string | null) {
    this.activeId = id
    this.redraw()
  }

  /** 设置悬浮的高亮 */
  setHovered(id: string | null) {
    this.hoveredId = id
    this.redraw()
  }

  /** 根据 HighlightSelection 计算容器内的矩形列表 */
  getHighlightRects(selection: HighlightSelection): DOMRect[] {
    const startNode = getNodeByPath(this.container, selection.startPath)
    const endNode = getNodeByPath(this.container, selection.endPath)
    if (!startNode || !endNode) return []

    try {
      const range = document.createRange()
      range.setStart(startNode, selection.startOffset)
      range.setEnd(endNode, selection.endOffset)

      const rects: DOMRect[] = []
      const containerRect = this.container.getBoundingClientRect()

      for (const rect of range.getClientRects()) {
        if (rect.width === 0 && rect.height === 0) continue
        // 转换为相对于容器的坐标
        rects.push(new DOMRect(
          rect.left - containerRect.left,
          rect.top - containerRect.top,
          rect.width,
          rect.height
        ))
      }

      // 合并同一行的矩形
      return mergeRects(rects)
    } catch {
      return []
    }
  }

  /** 重绘所有高亮 */
  redraw() {
    const ctx = this.canvas.getContext('2d')
    if (!ctx) return

    this.resizeCanvas()
    const containerRect = this.container.getBoundingClientRect()

    // 清空画布
    ctx.clearRect(0, 0, containerRect.width, containerRect.height)

    for (const [id, entry] of this.entries) {
      const rects = this.getHighlightRects(entry.selection)
      const isActive = id === this.activeId
      const isHovered = id === this.hoveredId

      let color = entry.resolved ? HIGHLIGHT_RESOLVED_COLOR : HIGHLIGHT_COLOR
      if (isActive || isHovered) {
        color = HIGHLIGHT_ACTIVE_COLOR
      }

      for (const rect of rects) {
        const padding = 1
        ctx.fillStyle = color
        ctx.fillRect(
          rect.left + padding,
          rect.top + padding,
          rect.width - padding * 2,
          rect.height - padding * 2
        )

        // 已解决：添加删除线效果
        if (entry.resolved && !isActive && !isHovered) {
          ctx.strokeStyle = 'rgba(120, 180, 120, 0.6)'
          ctx.lineWidth = 1
          ctx.beginPath()
          const midY = rect.top + rect.height / 2
          ctx.moveTo(rect.left + 2, midY)
          ctx.lineTo(rect.right - 2, midY)
          ctx.stroke()
        }
      }
    }
  }

  /** 滚动容器使指定高亮可见 */
  scrollToHighlight(id: string) {
    const entry = this.entries.get(id)
    if (!entry) return

    const rects = this.getHighlightRects(entry.selection)
    if (rects.length === 0) return

    const firstRect = rects[0]
    const containerRect = this.container.getBoundingClientRect()
    const scrollContainerRect = this.scrollContainer.getBoundingClientRect()

    // 计算高亮在 scrollContainer 中的绝对位置
    const absTop = containerRect.top - scrollContainerRect.top + firstRect.top
    const targetScroll = this.scrollContainer.scrollTop + absTop - scrollContainerRect.height / 3

    this.scrollContainer.scrollTo({
      top: Math.max(0, targetScroll),
      behavior: 'smooth'
    })
  }

  /** 销毁引擎，清理资源 */
  destroy() {
    this._resizeObserver?.disconnect()
    this.canvas.remove()
    this.entries.clear()
  }
}

/** 合并同行矩形（Y 坐标接近的合并为一个） */
function mergeRects(rects: DOMRect[]): DOMRect[] {
  if (rects.length <= 1) return rects

  const sorted = [...rects].sort((a, b) => a.top - b.top || a.left - b.left)
  const merged: DOMRect[] = [DOMRect.fromRect(sorted[0])]

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]
    const last = merged[merged.length - 1]

    if (Math.abs(current.top - last.top) < 5) {
      // 同行合并
      merged[merged.length - 1] = new DOMRect(
        Math.min(last.left, current.left),
        last.top,
        Math.max(last.right, current.right) - Math.min(last.left, current.left),
        Math.max(last.height, current.height)
      )
    } else {
      merged.push(DOMRect.fromRect(current))
    }
  }

  return merged
}
