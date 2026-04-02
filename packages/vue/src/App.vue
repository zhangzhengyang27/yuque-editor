<script setup lang="ts">
import { ref, onBeforeUnmount, nextTick, computed } from 'vue'
import { YuqueRichText } from 'yuque-editor-core/vue'
import { CommentManager } from './comment/comment-manager'
import type { Comment, HighlightSelection } from './comment/types'
import { DEFAULT_USER } from './comment/utils'
import CommentPopover from './comment/CommentPopover.vue'
import CommentPanel from './comment/CommentPanel.vue'
import ReplyEditorPanel from './comment/ReplyEditorPanel.vue'

import './comment/styles.css'

const INITIAL_VALUE = `<h1>Hello Yuque Editor!</h1>
<p>这是一个 <strong>Vue 示例</strong>，使用 yuque-editor-core 加载语雀编辑器。</p>
<h2>功能特性</h2>
<ul>
  <li>富文本编辑</li>
  <li>Markdown 支持</li>
  <li>工具栏</li>
  <li>图片上传</li>
</ul>
<h2>评论功能</h2>
<p>选中任意文字，会出现「💬 评论」浮动按钮，点击即可添加评论。</p>
<p>评论会以黄色高亮标记在文本上，右侧面板可查看所有评论。试试选中这段文字添加评论吧！</p>
<p>试试编辑上面的内容吧！</p>
`

const content = ref(INITIAL_VALUE)
const wordCount = ref(0)
const editorRef = ref<any>(null)
const editorContainerRef = ref<HTMLDivElement | null>(null)

// --- 评论系统状态 ---
const comments = ref<Comment[]>([])
const showPanel = ref(false)
const showPopover = ref(false)
const popoverAnchor = ref<DOMRect | null>(null)
const popoverHighlight = ref<HighlightSelection | null>(null)
let commentManager: CommentManager | null = null

// 评论数量 badge
const unresolvedCount = computed(() => comments.value.filter(c => !c.resolved).length)

function handleLoad() {
  console.log('Editor loaded!')
  wordCount.value = editorRef.value?.wordCount() ?? 0

  // 初始化评论系统
  initCommentSystem()
}

function handleError(err: Error) {
  console.error('Editor error:', err)
}

function handleChange(v: string) {
  content.value = v
  wordCount.value = editorRef.value?.wordCount() ?? 0
}

function showSummary() {
  const text = editorRef.value?.getSummaryContent() ?? ''
  wordCount.value = editorRef.value?.wordCount() ?? 0
  alert(`摘要内容:\n${text}`)
}

function clearContent() {
  content.value = '<p>已清空内容，重新开始编辑吧！</p>'
}

// ==================== 评论系统 ====================

function initCommentSystem() {
  // 等待编辑器 DOM 渲染完成
  nextTick(() => {
    if (!editorContainerRef.value) return

    // 找到编辑器内部的文档容器
    const docContainer = editorContainerRef.value.querySelector('.doc-container') as HTMLElement
      || editorContainerRef.value.querySelector('[class*="lake-core"]') as HTMLElement
      || editorContainerRef.value.querySelector('.editor-wrapper') as HTMLElement
      || editorContainerRef.value

    commentManager = new CommentManager({
      container: docContainer,
      currentUser: DEFAULT_USER,
      onChange: (updatedComments) => {
        comments.value = updatedComments
      }
    })

    // 监听划词事件 → 显示评论弹窗
    commentManager.on('highlight:add', (event: any) => {
      popoverHighlight.value = event.data.highlight
      popoverAnchor.value = event.data.rangeRect
      showPopover.value = true
    })
  })
}

/** 提交评论（来自弹窗） */
function handleSubmitComment(content: string) {
  if (!commentManager) return
  commentManager.addComment(content, popoverHighlight.value ?? undefined)
  showPopover.value = false
  popoverHighlight.value = null
}

/** 取消评论 */
function handleCancelComment() {
  showPopover.value = false
  popoverHighlight.value = null
}

/** 切换评论面板 */
function togglePanel() {
  showPanel.value = !showPanel.value
}

/** 回复评论 */
function handleReply(commentId: string, replyContent: string) {
  commentManager?.addReply(commentId, replyContent)
}

/** 标记已解决 */
function handleResolve(commentId: string) {
  commentManager?.resolveComment(commentId)
}

/** 取消已解决 */
function handleUnresolve(commentId: string) {
  commentManager?.unresolveComment(commentId)
}

/** 删除评论 */
function handleDelete(commentId: string) {
  if (confirm('确定要删除这条评论吗？')) {
    commentManager?.deleteComment(commentId)
  }
}

/** 滚动到评论对应的高亮 */
function handleScrollTo(commentId: string) {
  commentManager?.scrollToComment(commentId)
}

/** 评论卡片悬浮联动 */
function handleCommentHover(commentId: string) {
  commentManager?.setHoveredComment(commentId)
}

function handleCommentLeave() {
  commentManager?.setHoveredComment(null)
}

/** 面板关闭时清除悬浮状态 */
function handlePanelClose() {
  showPanel.value = false
  commentManager?.setHoveredComment(null)
}

// ==================== 回复编辑器 ====================

const replyEditorRef = ref<InstanceType<typeof ReplyEditorPanel> | null>(null)
const replies = ref<Array<{ id: string; content: string; time: Date }>>([])

/** 处理回复提交 */
function handleReplySubmit(content: string) {
  const reply = {
    id: Date.now().toString(),
    content,
    time: new Date()
  }
  replies.value.push(reply)
  console.log('收到回复:', reply)
  
  // 这里可以调用 API 保存回复
  // await api.saveReply(reply)
}

// 清理
onBeforeUnmount(() => {
  commentManager?.destroy()
  commentManager = null
})
</script>

<template>
  <div class="app-layout">
    <!-- 主内容区 -->
    <div class="app-main">
      <div style="max-width: 800px; margin: 0 auto; padding: 24px">
        <h1 style="text-align: center">Yuque Editor Vue Demo</h1>

        <div class="toolbar">
          <button @click="showSummary">获取摘要</button>
          <button @click="clearContent">清空内容</button>
          <button
            class="yuque-comment-toggle-btn"
            :class="{ active: showPanel }"
            @click="togglePanel"
          >
            💬 评论
            <span v-if="unresolvedCount > 0" class="yuque-comment-badge">
              {{ unresolvedCount }}
            </span>
          </button>
          <span class="word-count">字数: {{ wordCount }}</span>
        </div>

        <div ref="editorContainerRef" class="editor-wrapper">
          <YuqueRichText
            ref="editorRef"
            :value="content"
            show-toolbar
            @change="handleChange"
            @load="handleLoad"
            @error="handleError"
          />
        </div>

        <details class="html-viewer">
          <summary style="cursor: pointer; color: #666">查看原始 HTML</summary>
          <pre>{{ content }}</pre>
        </details>
      </div>
    </div>

    <!-- 评论弹窗 -->
    <CommentPopover
      :visible="showPopover"
      :anchor-rect="popoverAnchor"
      :highlight="popoverHighlight"
      @submit="handleSubmitComment"
      @cancel="handleCancelComment"
    />

    <!-- 评论侧边栏 -->
    <CommentPanel
      v-if="showPanel"
      :comments="comments"
      @reply="handleReply"
      @resolve="handleResolve"
      @unresolve="handleUnresolve"
      @delete="handleDelete"
      @scroll-to="handleScrollTo"
      @hover="handleCommentHover"
      @leave="handleCommentLeave"
      @close="handlePanelClose"
    />
  </div>

  <!-- 底部回复编辑器 -->
  <ReplyEditorPanel
    ref="replyEditorRef"
    placeholder="输入回复内容，支持富文本格式..."
    @submit="handleReplySubmit"
  />
</template>

<style>
body {
  margin: 0;
  background: #fff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.app-layout {
  display: flex;
  min-height: 100vh;
}

.app-main {
  flex: 1;
  min-width: 0;
  transition: margin-right 0.25s ease;
}

.app-main.has-panel {
  margin-right: 380px;
}

.toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  align-items: center;
  flex-wrap: wrap;
}

.toolbar button {
  padding: 6px 14px;
  font-size: 13px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  color: #333;
  transition: all 0.15s;
}

.toolbar button:hover {
  border-color: #1677ff;
  color: #1677ff;
}

.word-count {
  color: #999;
  font-size: 13px;
}

.editor-wrapper {
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  overflow: hidden;
}

.html-viewer {
  margin-top: 16px;
}

.html-viewer pre {
  background: #f5f5f5;
  padding: 12px;
  border-radius: 4px;
  overflow: auto;
  max-height: 300px;
  font-size: 12px;
}

/* 底部回复编辑器样式 */
.reply-editor-wrapper {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: #fff;
  border-top: 1px solid #e8e8e8;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.04);
}

.reply-editor-wrapper.has-panel {
  right: 380px;
}

/* 主内容区增加底部间距，避免被回复编辑器遮挡 */
.app-main {
  padding-bottom: 160px;
}
</style>
