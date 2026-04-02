/**
 * 评论管理器 — 框架无关的评论业务逻辑
 *
 * 职责：
 * - 管理评论 CRUD
 * - 协调 HighlightEngine 与 DOM 交互
 * - 管理选区监听与浮动按钮
 * - 事件通知
 */

import type {
  Comment,
  CommentEvent,
  CommentEventType,
  CommentReply,
  CommentSystemOptions,
  CommentUser,
  HighlightSelection
} from './types'
import { HighlightEngine, selectionToHighlight } from './highlight-engine'

let _nextId = 1
function genId(): string {
  return `c_${Date.now()}_${_nextId++}`
}

export type EventCallback = (event: CommentEvent) => void

export class CommentManager {
  // --- 状态 ---
  private comments: Comment[] = []
  private container: HTMLElement
  private currentUser: CommentUser
  private highlightEngine: HighlightEngine

  // --- 选区浮动按钮 ---
  private floatingBtn: HTMLDivElement | null = null
  private _selectionListenerActive = false

  // --- 回调 ---
  private eventListeners = new Map<CommentEventType, Set<EventCallback>>()
  private onChangeCallback?: (comments: Comment[]) => void

  // --- 内部状态 ---
  private _disposed = false

  constructor(options: CommentSystemOptions) {
    this.container = options.container
    this.currentUser = options.currentUser
    this.onChangeCallback = options.onChange

    // 查找可滚动父容器
    const scrollContainer = this.findScrollContainer(options.container)

    this.highlightEngine = new HighlightEngine({
      container: options.container,
      scrollContainer
    })

    // 恢复已有评论的高亮
    this.setupSelectionListener()
  }

  // ==================== 公开 API ====================

  /** 获取所有评论 */
  getComments(): Comment[] {
    return [...this.comments]
  }

  /** 获取指定 ID 的评论 */
  getComment(id: string): Comment | undefined {
    return this.comments.find(c => c.id === id)
  }

  /** 添加评论 */
  addComment(content: string, highlight?: HighlightSelection): Comment {
    const comment: Comment = {
      id: genId(),
      content,
      user: this.currentUser,
      highlight,
      replies: [],
      resolved: false,
      createdAt: Date.now()
    }

    this.comments.push(comment)

    if (highlight) {
      this.highlightEngine.addHighlight(comment.id, highlight)
    }

    this.emitChange()
    this.emit({ type: 'comment:add', data: { comment } })
    return comment
  }

  /** 添加回复 */
  addReply(commentId: string, content: string): CommentReply | null {
    const comment = this.comments.find(c => c.id === commentId)
    if (!comment) return null

    const reply: CommentReply = {
      id: genId(),
      content,
      user: this.currentUser,
      createdAt: Date.now()
    }

    comment.replies.push(reply)
    this.emitChange()
    this.emit({ type: 'reply:add', data: { commentId, reply } })
    return reply
  }

  /** 标记为已解决 */
  resolveComment(commentId: string) {
    const comment = this.comments.find(c => c.id === commentId)
    if (!comment) return

    comment.resolved = true
    this.highlightEngine.updateResolved(commentId, true)
    this.emitChange()
    this.emit({ type: 'comment:resolve', data: { commentId } })
  }

  /** 取消已解决 */
  unresolveComment(commentId: string) {
    const comment = this.comments.find(c => c.id === commentId)
    if (!comment) return

    comment.resolved = false
    this.highlightEngine.updateResolved(commentId, false)
    this.emitChange()
    this.emit({ type: 'comment:unresolve', data: { commentId } })
  }

  /** 删除评论 */
  deleteComment(commentId: string) {
    const index = this.comments.findIndex(c => c.id === commentId)
    if (index === -1) return

    this.comments.splice(index, 1)
    this.highlightEngine.removeHighlight(commentId)
    this.emitChange()
    this.emit({ type: 'comment:delete', data: { commentId } })
  }

  /** 滚动到指定评论的高亮位置 */
  scrollToComment(commentId: string) {
    this.highlightEngine.setActive(commentId)
    this.highlightEngine.scrollToHighlight(commentId)

    // 3秒后取消激活状态
    setTimeout(() => {
      this.highlightEngine.setActive(null)
    }, 3000)
  }

  /** 设置悬浮高亮 */
  setHoveredComment(commentId: string | null) {
    this.highlightEngine.setHovered(commentId)
  }

  /** 获取高亮引擎（用于自定义渲染） */
  getHighlightEngine(): HighlightEngine {
    return this.highlightEngine
  }

  /** 获取当前用户 */
  getCurrentUser(): CommentUser {
    return this.currentUser
  }

  // ==================== 事件系统 ====================

  /** 监听事件 */
  on(type: CommentEventType, callback: EventCallback): () => void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set())
    }
    this.eventListeners.get(type)!.add(callback)

    // 返回取消监听函数
    return () => {
      this.eventListeners.get(type)?.delete(callback)
    }
  }

  // ==================== 内部方法 ====================

  private emit(event: CommentEvent) {
    const listeners = this.eventListeners.get(event.type)
    if (listeners) {
      for (const cb of listeners) {
        try { cb(event) } catch { /* 静默 */ }
      }
    }
  }

  private emitChange() {
    this.onChangeCallback?.([...this.comments])
  }

  /** 查找最近的滚动容器 */
  private findScrollContainer(el: HTMLElement): HTMLElement {
    let current = el.parentElement
    while (current) {
      const style = getComputedStyle(current)
      const overflow = style.overflow + style.overflowY
      if (overflow.includes('auto') || overflow.includes('scroll')) {
        return current
      }
      current = current.parentElement
    }
    return document.documentElement
  }

  // ==================== 选区浮动按钮 ====================

  /** 初始化文本选区监听，划词后显示「添加评论」浮动按钮 */
  private setupSelectionListener() {
    if (this._selectionListenerActive) return
    this._selectionListenerActive = true

    this.container.addEventListener('mouseup', this.onMouseUp)
    this.container.addEventListener('keyup', this.onMouseUp)
    document.addEventListener('click', this.onDocumentClick)
  }

  private onMouseUp = () => {
    if (this._disposed) return

    // 延迟一帧，确保 selection 已更新
    requestAnimationFrame(() => {
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        this.hideFloatingButton()
        return
      }

      // 检查选区是否在容器内
      const range = selection.getRangeAt(0)
      if (!this.container.contains(range.commonAncestorContainer)) {
        this.hideFloatingButton()
        return
      }

      const text = selection.toString().trim()
      if (text.length === 0) {
        this.hideFloatingButton()
        return
      }

      this.showFloatingButton(range)
    })
  }

  private showFloatingButton(range: Range) {
    const rect = range.getBoundingClientRect()

    if (!this.floatingBtn) {
      this.floatingBtn = document.createElement('div')
      this.floatingBtn.className = 'yuque-comment-float-btn'
      this.floatingBtn.innerHTML = '💬 评论'
      this.floatingBtn.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        this.onFloatingBtnClick()
      })
      document.body.appendChild(this.floatingBtn)
    }

    // 定位：选区右上方
    const top = rect.top + window.scrollY - 40
    const left = rect.left + window.scrollX + rect.width / 2 - 40

    this.floatingBtn.style.top = `${top}px`
    this.floatingBtn.style.left = `${left}px`
    this.floatingBtn.style.display = 'flex'
  }

  private hideFloatingButton() {
    if (this.floatingBtn) {
      this.floatingBtn.style.display = 'none'
    }
  }

  private onFloatingBtnClick() {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) return

    const range = selection.getRangeAt(0)
    if (!this.container.contains(range.commonAncestorContainer)) return

    const highlight = selectionToHighlight(this.container, selection)

    // 清除选区
    selection.removeAllRanges()
    this.hideFloatingButton()

    // 发出事件，让 UI 层显示评论弹窗
    this.emit({
      type: 'highlight:add',
      data: { highlight, rangeRect: range.getBoundingClientRect() }
    })
  }

  private onDocumentClick = (e: MouseEvent) => {
    if (this._disposed) return

    // 点击浮动按钮外部时隐藏
    if (this.floatingBtn && !this.floatingBtn.contains(e.target as Node)) {
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed) {
        this.hideFloatingButton()
      }
    }
  }

  // ==================== 销毁 ====================

  /** 销毁管理器，清理所有资源 */
  destroy() {
    this._disposed = true
    this.container.removeEventListener('mouseup', this.onMouseUp)
    this.container.removeEventListener('keyup', this.onMouseUp)
    document.removeEventListener('click', this.onDocumentClick)

    if (this.floatingBtn) {
      this.floatingBtn.remove()
      this.floatingBtn = null
    }

    this.highlightEngine.destroy()
    this.eventListeners.clear()
  }
}
