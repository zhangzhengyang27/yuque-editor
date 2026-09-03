/**
 * 评论工具函数
 */

import type { CommentUser } from "./types"

/** 格式化时间戳为相对时间 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  if (diff < 60 * 1000) return "刚刚"
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)} 小时前`
  if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / 86400000)} 天前`

  const date = new Date(timestamp)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

/** 获取用户头像首字 */
export function getUserInitial(user: CommentUser): string {
  return (user.name || "?").charAt(0).toUpperCase()
}

/** 默认 Demo 用户 */
export const DEFAULT_USER: CommentUser = {
  id: "demo_user",
  name: "Demo 用户",
  avatar: "",
}
