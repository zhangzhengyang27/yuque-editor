/**
 * 评论系统数据模型
 */

/** 评论用户（Demo 模式下使用模拟数据） */
export interface CommentUser {
  id: string
  name: string
  avatar: string
}

/** 高亮选区信息（XPath-like 路径序列化，不保存 DOM 引用） */
export interface HighlightSelection {
  /** 从根容器到 start 节点的 childIndices 路径 */
  startPath: number[]
  startOffset: number
  /** 从根容器到 end 节点的 childIndices 路径 */
  endPath: number[]
  endOffset: number
  /** 被选中的纯文本，用于展示和匹配校验 */
  text: string
}

/** 评论回复 */
export interface CommentReply {
  id: string
  content: string
  user: CommentUser
  createdAt: number
}

/** 单条评论 */
export interface Comment {
  id: string
  content: string
  user: CommentUser
  highlight?: HighlightSelection
  replies: CommentReply[]
  resolved: boolean
  createdAt: number
}

/** 评论系统配置 */
export interface CommentSystemOptions {
  /** 评论内容所在的可编辑容器（需要划词的 DOM 元素） */
  container: HTMLElement
  /** 当前用户 */
  currentUser: CommentUser
  /** 评论变更回调 */
  onChange?: (comments: Comment[]) => void
}

/** 评论系统事件类型 */
export type CommentEventType =
  | "select"
  | "highlight:add"
  | "highlight:remove"
  | "comment:add"
  | "comment:resolve"
  | "comment:unresolve"
  | "comment:delete"
  | "reply:add"

/** 评论系统事件 */
export interface CommentEvent {
  type: CommentEventType
  data?: unknown
}
