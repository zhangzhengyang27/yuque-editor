<script setup lang="ts">
import { ref, onBeforeUnmount, nextTick, computed } from "vue"
import { YuqueRichText } from "yuque-editor-core/vue"
import type { YuqueEditorRef, YuqueDocScheme } from "yuque-editor-core/editor"
import { CommentManager } from "./comment/comment-manager"
import type { Comment, CommentEvent, HighlightSelection } from "./comment/types"
import { DEFAULT_USER } from "./comment/utils"
import CommentPopover from "./comment/CommentPopover.vue"
import CommentPanel from "./comment/CommentPanel.vue"
import ReplyEditorPanel from "./comment/ReplyEditorPanel.vue"

import "./comment/styles.css"

const INITIAL_VALUE = `<h1>Hello Yuque Editor!</h1>
<p>这是一个 <strong>Vue 示例</strong>，使用 yuque-editor-core 加载语雀编辑器。</p>
<h2>功能特性</h2>
<ul>
  <li>富文本编辑 · 图片/视频上传</li>
  <li>工具栏 · 字号 · 对齐</li>
  <li>undo/redo · 加粗/斜体/下划线</li>
  <li>字数统计 · 格式切换</li>
</ul>
<h2>评论功能</h2>
<p>选中任意文字，会出现「💬 评论」浮动按钮，点击即可添加评论。</p>
<p>试试编辑上面的内容吧！</p>
`

const content = ref(INITIAL_VALUE)
const wordCount = ref(0)
const editorRef = ref<YuqueEditorRef | null>(null)
const editorContainerRef = ref<HTMLDivElement | null>(null)
const logs = ref<string[]>([])

// 字数统计需要全量序列化文档，长文档下开销大，对输入做防抖
let wordCountTimer: ReturnType<typeof setTimeout> | null = null
function queueWordCount() {
  if (wordCountTimer) clearTimeout(wordCountTimer)
  wordCountTimer = setTimeout(() => {
    wordCountTimer = null
    wordCount.value = editorRef.value?.wordCount() ?? 0
  }, 200)
}

// --- 评论系统状态 ---
const comments = ref<Comment[]>([])
const showPanel = ref(false)
const showPopover = ref(false)
const popoverAnchor = ref<DOMRect | null>(null)
const popoverHighlight = ref<HighlightSelection | null>(null)
let commentManager: CommentManager | null = null
const unresolvedCount = computed(() => comments.value.filter((c) => !c.resolved).length)

// === 日志 ===
function addLog(msg: string) {
  const ts = new Date().toLocaleTimeString()
  logs.value.unshift(`[${ts}] ${msg}`)
  if (logs.value.length > 50) logs.value.pop()
}

function clearLogs() {
  logs.value = []
}

/** 刷新字数统计并写日志（模板按钮入口；多语句逻辑不放内联 handler） */
function logWordCount() {
  wordCount.value = editorRef.value?.wordCount() ?? 0
  addLog(`wordCount: ${wordCount.value}`)
}

function resetContent() {
  content.value = "<p><strong>通过 setContent 重置的内容</strong></p>"
  addLog("setContent: reset")
}

function applyColor(c: string) {
  editorRef.value?.setColor(c)
  addLog(`setColor: ${c}`)
}

function applyBgColor(c: string) {
  editorRef.value?.setBgColor(c)
  addLog(`setBgColor: ${c}`)
}

// === 编辑器事件 ===
function handleLoad() {
  addLog("Editor loaded!")
  wordCount.value = editorRef.value?.wordCount() ?? 0
  initCommentSystem()
}

function handleError(err: Error) {
  addLog(`ERROR: ${err.message}`)
  console.error("Editor error:", err)
}

function handleChange(v: string) {
  content.value = v
  queueWordCount()
  // 内容变化后刷新划词高亮（路径基于 childIndices，编辑后已错位）
  commentManager?.refreshHighlights()
}

function handleFocus() {
  addLog("focus")
}
function handleBlur() {
  addLog("blur")
}
function handleSelectionChange() {
  addLog("selectionchange")
}

// === 辅助方法 ===
function getSummary() {
  const text = editorRef.value?.getSummaryContent() ?? ""
  addLog(`summary: "${text.slice(0, 60)}${text.length > 60 ? "…" : ""}"`)
}
function checkEmpty() {
  const empty = editorRef.value?.isEmpty()
  addLog(`isEmpty: ${empty}`)
}

// === execCommand 封装 ===
function cmd(label: string, fn: () => void) {
  try {
    fn()
    addLog(`exec: ${label}`)
  } catch (e) {
    addLog(`exec FAIL: ${label} — ${e instanceof Error ? e.message : String(e)}`)
  }
}
function getContent(scheme: YuqueDocScheme) {
  const v = editorRef.value?.getContent(scheme) ?? ""
  addLog(`${scheme}: "${v.slice(0, 80)}${v.length > 80 ? "…" : ""}"`)
}

// ==================== 评论系统 ====================

const PARAGRAPH_STYLES = ["p", "h1", "h2", "h3", "h4"] as const
const ALIGNMENTS = ["left", "center", "right", "justify"] as const
const FOREGROUND_COLORS = ["#FF6B00", "#1677FF", "#52C41A", "#F5222D", "#722ED1", "#000000"]
const BACKGROUND_COLORS = ["#FFEB3B", "#E1F5FE", "#F3E5F5", "#E8F5E9", "#FFF3E0"]

function initCommentSystem() {
  nextTick(() => {
    if (!editorContainerRef.value) return
    // 编辑器重初始化（配置变化 / HMR）会再次触发 @load，
    // 先销毁旧管理器，避免 canvas 与 document 级监听器泄漏
    commentManager?.destroy()

    const docContainer =
      (editorContainerRef.value.querySelector(".doc-container") as HTMLElement) ||
      (editorContainerRef.value.querySelector('[class*="lake-core"]') as HTMLElement) ||
      (editorContainerRef.value.querySelector(".editor-wrapper") as HTMLElement) ||
      editorContainerRef.value

    commentManager = new CommentManager({
      container: docContainer,
      currentUser: DEFAULT_USER,
      onChange: (updatedComments) => {
        comments.value = updatedComments
      },
    })

    commentManager.on("highlight:add", (event: CommentEvent) => {
      const data = event.data as { highlight: HighlightSelection; rangeRect: DOMRect }
      popoverHighlight.value = data.highlight
      popoverAnchor.value = data.rangeRect
      showPopover.value = true
    })
  })
}

function handleSubmitComment(text: string) {
  commentManager?.addComment(text, popoverHighlight.value ?? undefined)
  showPopover.value = false
  popoverHighlight.value = null
}

function handleCancelComment() {
  showPopover.value = false
  popoverHighlight.value = null
}

function handleReply(commentId: string, replyContent: string) {
  commentManager?.addReply(commentId, replyContent)
}

function handleResolve(commentId: string) {
  commentManager?.resolveComment(commentId)
}
function handleUnresolve(commentId: string) {
  commentManager?.unresolveComment(commentId)
}
function handleDelete(commentId: string) {
  if (confirm("确定要删除这条评论吗？")) {
    commentManager?.deleteComment(commentId)
  }
}

function handleScrollTo(commentId: string) {
  commentManager?.scrollToComment(commentId)
}
function handleCommentHover(commentId: string) {
  commentManager?.setHoveredComment(commentId)
}
function handleCommentLeave() {
  commentManager?.setHoveredComment(null)
}
function handlePanelClose() {
  showPanel.value = false
  commentManager?.setHoveredComment(null)
}

// ==================== Reply Editor ====================

const replyEditorRef = ref<InstanceType<typeof ReplyEditorPanel> | null>(null)
const replies = ref<Array<{ id: string; content: string; time: Date }>>([])

function handleReplySubmit(text: string) {
  replies.value.push({ id: Date.now().toString(), content: text, time: new Date() })
  console.log("收到回复:", text)
}

onBeforeUnmount(() => {
  if (wordCountTimer) clearTimeout(wordCountTimer)
  commentManager?.destroy()
  commentManager = null
})
</script>

<template>
  <div class="app-layout">
    <!-- 主内容区（评论面板打开时避让 380px） -->
    <div class="app-main" :class="{ 'has-panel': showPanel }">
      <div style="max-width: 960px; margin: 0 auto; padding: 20px 16px">
        <h1 style="text-align: center; margin-bottom: 20px">Yuque Editor — Vue Demo</h1>

        <!-- ===== 功能测试面板 ===== -->
        <div class="test-panels">
          <!-- 基础操作 -->
          <div class="test-panel">
            <div class="panel-title">基础操作</div>
            <div class="panel-body">
              <button class="cmd-btn" @click="getSummary">getSummaryContent</button>
              <button class="cmd-btn" @click="checkEmpty">isEmpty</button>
              <button class="cmd-btn" @click="logWordCount">wordCount</button>
              <button class="cmd-btn" @click="resetContent">setContent</button>
            </div>
          </div>

          <!-- 撤销/重做 -->
          <div class="test-panel">
            <div class="panel-title">撤销 / 重做</div>
            <div class="panel-body">
              <button class="cmd-btn" @click="cmd('undo', () => editorRef?.undo())">undo</button>
              <button class="cmd-btn" @click="cmd('redo', () => editorRef?.redo())">redo</button>
            </div>
          </div>

          <!-- 文字格式 -->
          <div class="test-panel">
            <div class="panel-title">文字格式</div>
            <div class="panel-body">
              <button class="cmd-btn" @click="cmd('bold', () => editorRef?.setBold())">
                setBold
              </button>
              <button class="cmd-btn" @click="cmd('italic', () => editorRef?.setItalic())">
                setItalic
              </button>
              <button class="cmd-btn" @click="cmd('underline', () => editorRef?.setUnderline())">
                setUnderline
              </button>
              <button
                class="cmd-btn"
                @click="cmd('strikethrough', () => editorRef?.setStrikethrough())"
              >
                setStrikethrough
              </button>
              <button class="cmd-btn" @click="cmd('clearFormat', () => editorRef?.clearFormat())">
                clearFormat
              </button>
            </div>
          </div>

          <!-- 颜色 -->
          <div class="test-panel">
            <div class="panel-title">颜色</div>
            <div class="panel-body">
              <div class="color-row">
                <button
                  v-for="c in FOREGROUND_COLORS"
                  :key="c"
                  :title="c"
                  :style="{ background: c }"
                  class="color-btn"
                  @click="applyColor(c)"
                />
                <button class="cmd-btn" @click="cmd('clearColor', () => editorRef?.clearColor())">
                  clearColor
                </button>
              </div>
              <div class="color-row">
                <button
                  v-for="c in BACKGROUND_COLORS"
                  :key="c"
                  :title="c"
                  :style="{ background: c }"
                  class="color-btn"
                  @click="applyBgColor(c)"
                />
              </div>
            </div>
          </div>

          <!-- 段落样式 -->
          <div class="test-panel">
            <div class="panel-title">段落样式</div>
            <div class="panel-body">
              <button
                v-for="s in PARAGRAPH_STYLES"
                :key="s"
                class="cmd-btn"
                @click="cmd(`style=${s}`, () => editorRef?.setParagraphStyle(s))"
              >
                style: {{ s }}
              </button>
            </div>
          </div>

          <!-- 对齐/缩进 -->
          <div class="test-panel">
            <div class="panel-title">对齐 / 缩进</div>
            <div class="panel-body">
              <button
                v-for="a in ALIGNMENTS"
                :key="a"
                class="cmd-btn"
                @click="cmd(`alignment=${a}`, () => editorRef?.setAlignment(a))"
              >
                {{ a }}
              </button>
              <button class="cmd-btn" @click="cmd('indent', () => editorRef?.indent())">
                indent
              </button>
              <button class="cmd-btn" @click="cmd('outdent', () => editorRef?.outdent())">
                outdent
              </button>
            </div>
          </div>

          <!-- 字号 -->
          <div class="test-panel">
            <div class="panel-title">字号</div>
            <div class="panel-body">
              <button
                v-for="sz in [12, 15, 18, 22, 24, 29, 32]"
                :key="sz"
                class="cmd-btn"
                @click="cmd(`fontsize=${sz}`, () => editorRef?.setFontsize(sz))"
              >
                {{ sz }}px
              </button>
            </div>
          </div>

          <!-- 焦点/光标 -->
          <div class="test-panel">
            <div class="panel-title">焦点 / 光标</div>
            <div class="panel-body">
              <button class="cmd-btn" @click="cmd('focusToStart', () => editorRef?.focusToStart())">
                focusToStart
              </button>
              <button class="cmd-btn" @click="cmd('selectAll', () => editorRef?.selectAll())">
                selectAll
              </button>
            </div>
          </div>

          <!-- 格式切换 -->
          <div class="test-panel">
            <div class="panel-title">格式切换 (getContent)</div>
            <div class="panel-body">
              <button
                v-for="s in ['text/html', 'text/markdown', 'text/plain', 'text/lake', 'json']"
                :key="s"
                class="cmd-btn"
                @click="getContent(s as YuqueDocScheme)"
              >
                {{ s }}
              </button>
            </div>
          </div>
        </div>

        <!-- ===== 编辑器 + 状态栏 ===== -->
        <div class="toolbar">
          <button
            class="toolbar-btn"
            :class="{ active: showPanel }"
            @click="showPanel = !showPanel"
          >
            💬 评论 <span v-if="unresolvedCount > 0" class="badge">{{ unresolvedCount }}</span>
          </button>
          <span class="word-count">字数: {{ wordCount }}</span>
          <span class="word-count">长度: {{ content.length }}</span>
        </div>

        <div ref="editorContainerRef" class="editor-wrapper">
          <YuqueRichText
            ref="editorRef"
            :value="content"
            show-toolbar
            @change="handleChange"
            @load="handleLoad"
            @error="handleError"
            @focus="handleFocus"
            @blur="handleBlur"
            @selectionchange="handleSelectionChange"
          />
        </div>

        <!-- ===== 事件日志 ===== -->
        <div class="log-section">
          <div class="log-header">
            <span style="font-size: 13px; font-weight: 600; color: #ddd">事件日志</span>
            <button class="cmd-btn" style="font-size: 11px; padding: 2px 8px" @click="clearLogs">
              清空
            </button>
          </div>
          <div class="log-box">
            <div v-if="logs.length === 0" style="color: #555; font-size: 12px">
              操作编辑器，事件日志将显示在这里…
            </div>
            <div
              v-for="(log, i) in logs"
              :key="i"
              :style="{
                color: i === 0 ? '#4fc3f7' : '#ccc',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                lineHeight: 1.6,
                fontSize: 12,
              }"
            >
              {{ log }}
            </div>
          </div>
        </div>

        <details class="html-viewer">
          <summary style="cursor: pointer; color: #666; font-size: 13px">查看原始 HTML</summary>
          <pre
            style="
              background: #f5f5f5;
              padding: 12px;
              border-radius: 4px;
              overflow: auto;
              max-height: 200px;
              font-size: 12px;
            "
            >{{ content }}</pre>
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

  <!-- 底部回复编辑器（fixed 定位，评论面板打开时右侧避让） -->
  <div class="reply-editor-wrapper" :class="{ 'has-panel': showPanel }">
    <ReplyEditorPanel
      ref="replyEditorRef"
      placeholder="输入回复内容，支持富文本格式…"
      @submit="handleReplySubmit"
    />
  </div>
</template>

<style>
body {
  margin: 0;
  background: #fff;
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
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

/* ===== 功能测试面板 ===== */
.test-panels {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.test-panel {
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 8px 10px;
}

.panel-title {
  font-size: 12px;
  font-weight: 600;
  color: #555;
  margin-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
  padding-bottom: 5px;
}

.panel-body {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  align-items: center;
}

.cmd-btn {
  font-size: 12px;
  padding: 3px 8px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  color: #333;
  white-space: nowrap;
  transition: all 0.15s;
}

.cmd-btn:hover {
  border-color: #1677ff;
  color: #1677ff;
}

.color-row {
  display: flex;
  gap: 4px;
  align-items: center;
  flex-wrap: wrap;
}

.color-btn {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: 1px solid #ddd;
  cursor: pointer;
  padding: 0;
}

/* ===== 编辑器工具栏 ===== */
.toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.toolbar-btn {
  padding: 5px 14px;
  font-size: 13px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  color: #333;
  transition: all 0.15s;
}

.toolbar-btn:hover {
  border-color: #1677ff;
  color: #1677ff;
}

.toolbar-btn.active {
  border-color: #1677ff;
  color: #1677ff;
  background: #e6f4ff;
}

.badge {
  display: inline-block;
  background: #ff4d4f;
  color: #fff;
  border-radius: 10px;
  padding: 0 5px;
  font-size: 11px;
  line-height: 16px;
  min-width: 16px;
  text-align: center;
}

.word-count {
  color: #999;
  font-size: 13px;
}

.editor-wrapper {
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 16px;
}

/* ===== 事件日志 ===== */
.log-section {
  margin-bottom: 16px;
}

.log-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.log-box {
  background: #1e1e1e;
  border-radius: 6px;
  padding: 10px 12px;
  height: 160px;
  overflow-y: auto;
  font-family: "SF Mono", Monaco, Menlo, monospace;
}

.html-viewer {
  margin-bottom: 16px;
}

.html-viewer pre {
  background: #f5f5f5;
  padding: 12px;
  border-radius: 4px;
  overflow: auto;
  max-height: 200px;
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
