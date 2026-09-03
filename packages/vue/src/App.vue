<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue"
import { YuqueRichText } from "yuque-editor-core/vue"
import type { YuqueDocScheme, YuqueEditorRef, UploadResult } from "yuque-editor-core/editor"
import { CommentManager } from "./comment/comment-manager"
import type { Comment, CommentEvent, HighlightSelection } from "./comment/types"
import { DEFAULT_USER } from "./comment/utils"
import CommentPopover from "./comment/CommentPopover.vue"
import CommentPanel from "./comment/CommentPanel.vue"
import ReplyEditorPanel from "./comment/ReplyEditorPanel.vue"
import "./comment/styles.css"
import "./demo.css"

const INITIAL_VALUE = `<h1>Hello Yuque Editor!</h1>
<p>这是一个 <strong>Vue 示例</strong>，使用 yuque-editor-core 加载语雀编辑器。</p>
<h2>功能特性</h2>
<ul>
  <li>富文本编辑 · 图片/视频上传</li>
  <li>工具栏 · 字号 · 对齐</li>
  <li>undo/redo · 加粗/斜体/下划线</li>
  <li>字数统计 · 格式切换 · 划词评论</li>
</ul>
<p>试试编辑上面的内容吧！选中任意文字可添加评论。</p>
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

/** 对齐图标的横线坐标：[x1, x2, y] */
const ALIGN_BARS: Record<(typeof ALIGNMENTS)[number], Array<[number, number, number]>> = {
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

const EXPORT_SCHEMES: Array<{ scheme: YuqueDocScheme; label: string }> = [
  { scheme: "text/html", label: "HTML" },
  { scheme: "text/markdown", label: "Markdown" },
  { scheme: "text/plain", label: "纯文本" },
  { scheme: "text/lake", label: "Lake" },
  { scheme: "json", label: "JSON" },
]

type Theme = "light" | "dark"

/** 页面框架主题（Lake 编辑器内容区样式固定浅色，不受影响）；选择持久化到 localStorage */
function initTheme(): Theme {
  const saved = localStorage.getItem("yuque-demo-theme")
  if (saved === "light" || saved === "dark") return saved
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

const theme = ref<Theme>(initTheme())
// immediate：挂载时立刻应用初始主题（否则刷新后 data-theme 缺失，页面回落浅色）
watch(
  theme,
  (t) => {
    document.documentElement.dataset.theme = t
    localStorage.setItem("yuque-demo-theme", t)
  },
  { immediate: true },
)
const toggleTheme = () => {
  theme.value = theme.value === "dark" ? "light" : "dark"
}

// ==================== 状态 ====================

const editorRef = ref<YuqueEditorRef | null>(null)
const editorContainerRef = ref<HTMLElement | null>(null)
const content = ref(INITIAL_VALUE)
const wordCount = ref(0)
const empty = ref(false)
const logs = ref<string[]>([])
const showRail = ref(window.innerWidth >= 1080)
const showPanel = ref(false)
const comments = ref<Comment[]>([])
const unresolvedCount = computed(() => comments.value.filter((c) => !c.resolved).length)
const showPopover = ref(false)
const popoverAnchor = ref<DOMRect | null>(null)
const popoverHighlight = ref<HighlightSelection | null>(null)

let commentManager: CommentManager | null = null

// 字数统计需要全量序列化文档，长文档下开销大，对输入做防抖
let wordCountTimer: ReturnType<typeof setTimeout> | null = null
function queueWordCount() {
  if (wordCountTimer) clearTimeout(wordCountTimer)
  wordCountTimer = setTimeout(() => {
    wordCountTimer = null
    wordCount.value = editorRef.value?.wordCount() ?? 0
    empty.value = editorRef.value?.isEmpty() ?? true
  }, 200)
}

// ==================== 事件日志 ====================

function addLog(msg: string) {
  const ts = new Date().toLocaleTimeString()
  logs.value.unshift(`[${ts}] ${msg}`)
  if (logs.value.length > 50) logs.value.pop()
}

function clearLogs() {
  logs.value = []
}

/** 刷新字数统计并写日志（多语句逻辑不放内联 handler） */
function logWordCount() {
  wordCount.value = editorRef.value?.wordCount() ?? 0
  addLog(`wordCount: ${wordCount.value}`)
}

// ==================== 编辑器事件 ====================

function handleChange(v: string) {
  content.value = v
  queueWordCount()
  // 内容变化后刷新划词高亮（路径基于 childIndices，编辑后已错位）
  commentManager?.refreshHighlights()
}

function handleLoad() {
  addLog("Editor loaded!")
  wordCount.value = editorRef.value?.wordCount() ?? 0
  initCommentSystem()
}

function handleError(err: Error) {
  addLog(`ERROR: ${err.message}`)
  console.error("Editor error:", err)
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

// ==================== 工具栏命令 ====================

function cmd(label: string, fn: () => void) {
  try {
    fn()
    addLog(`exec: ${label}`)
  } catch (e) {
    addLog(`exec FAIL: ${label} — ${e instanceof Error ? e.message : String(e)}`)
  }
}

function applyColor(c: string) {
  editorRef.value?.setColor(c)
  addLog(`setColor: ${c}`)
}

function applyBgColor(c: string) {
  editorRef.value?.setBgColor(c)
  addLog(`setBgColor: ${c}`)
}

function applyParagraph(e: Event) {
  const style = (e.target as HTMLSelectElement).value as ParagraphStyle
  cmd(`style=${style}`, () => editorRef.value?.setParagraphStyle(style))
}

function applyFontSize(e: Event) {
  const size = Number((e.target as HTMLSelectElement).value)
  cmd(`fontsize=${size}`, () => editorRef.value?.setFontsize(size))
}

function applyAlignment(a: (typeof ALIGNMENTS)[number]) {
  cmd(`alignment=${a}`, () => editorRef.value?.setAlignment(a))
}

// ==================== 检查器 ====================

function resetContent() {
  content.value = "<p><strong>通过 setContent 重置的内容</strong></p>"
  addLog("setContent: reset")
}

function getSummary() {
  const text = editorRef.value?.getSummaryContent() ?? ""
  addLog(`summary: "${text.slice(0, 60)}${text.length > 60 ? "…" : ""}"`)
}

function checkEmpty() {
  addLog(`isEmpty: ${editorRef.value?.isEmpty()}`)
}

function exportAs(scheme: YuqueDocScheme) {
  const v = editorRef.value?.getContent(scheme) ?? ""
  addLog(`${scheme}: "${v.slice(0, 80)}${v.length > 80 ? "…" : ""}"`)
}

// ==================== 评论系统 ====================

function initCommentSystem() {
  nextTick(() => {
    if (!editorContainerRef.value) return
    // 编辑器重初始化（配置变化 / HMR）会再次触发 @load，
    // 先销毁旧管理器，避免 canvas 与 document 级监听器泄漏
    commentManager?.destroy()

    const docContainer =
      (editorContainerRef.value.querySelector(".doc-container") as HTMLElement) ||
      (editorContainerRef.value.querySelector('[class*="lake-core"]') as HTMLElement) ||
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

// ==================== 底部回复编辑器 ====================

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
  <div class="app">
    <!-- ===== 顶栏 ===== -->
    <header class="app-header">
      <div class="header-inner">
        <div class="brand">
          <svg class="brand-mark" viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">
            <rect width="28" height="28" rx="8" fill="var(--accent)" />
            <path
              d="M8.5 19.5c5.5-.8 9.6-5.2 10.8-11-6 .9-10.2 5.2-10.8 11z"
              fill="#fff"
              opacity="0.95"
            />
          </svg>
          <span class="brand-name">Yuque Editor</span>
          <span class="brand-tag">Vue Demo</span>
        </div>
        <div class="header-actions">
          <button
            type="button"
            class="ghost-btn"
            :class="{ active: showPanel }"
            :aria-pressed="showPanel"
            title="打开评论面板"
            @click="showPanel = !showPanel"
          >
            评论
            <span v-if="unresolvedCount > 0" class="badge">{{ unresolvedCount }}</span>
          </button>
          <button
            type="button"
            class="ghost-btn"
            :class="{ active: showRail }"
            :aria-pressed="showRail"
            title="显示 / 隐藏检查器与事件日志"
            @click="showRail = !showRail"
          >
            控制台
          </button>
          <button
            type="button"
            class="ghost-btn icon-only"
            :aria-label="theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'"
            :title="theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'"
            @click="toggleTheme"
          >
            {{ theme === "dark" ? "☀" : "☾" }}
          </button>
        </div>
      </div>
    </header>

    <!-- ===== 工作区 ===== -->
    <div class="workspace" :class="{ 'rail-hidden': !showRail }">
      <section class="main-col">
        <!-- 分组工具栏（execCommand 演示） -->
        <div class="toolbar card" role="toolbar" aria-label="编辑器命令工具栏">
          <div class="tool-group">
            <button
              type="button"
              class="tool-btn"
              title="撤销 (undo)"
              aria-label="撤销"
              @click="cmd('undo', () => editorRef?.undo())"
            >
              ↺
            </button>
            <button
              type="button"
              class="tool-btn"
              title="重做 (redo)"
              aria-label="重做"
              @click="cmd('redo', () => editorRef?.redo())"
            >
              ↻
            </button>
          </div>

          <span class="tool-divider" />

          <div class="tool-group">
            <button
              type="button"
              class="tool-btn text-bold"
              title="加粗 (setBold)"
              @click="cmd('bold', () => editorRef?.setBold())"
            >
              B
            </button>
            <button
              type="button"
              class="tool-btn text-italic"
              title="斜体 (setItalic)"
              @click="cmd('italic', () => editorRef?.setItalic())"
            >
              I
            </button>
            <button
              type="button"
              class="tool-btn text-underline"
              title="下划线 (setUnderline)"
              @click="cmd('underline', () => editorRef?.setUnderline())"
            >
              U
            </button>
            <button
              type="button"
              class="tool-btn text-strike"
              title="删除线 (setStrikethrough)"
              @click="cmd('strikethrough', () => editorRef?.setStrikethrough())"
            >
              S
            </button>
            <button
              type="button"
              class="tool-btn"
              title="清除格式 (clearFormat)"
              @click="cmd('clearFormat', () => editorRef?.clearFormat())"
            >
              <span class="tool-clear">清除</span>
            </button>
          </div>

          <span class="tool-divider" />

          <div class="tool-group">
            <span class="swatch-row">
              <button
                v-for="c in FOREGROUND_COLORS"
                :key="c"
                type="button"
                class="swatch"
                :style="{ background: c }"
                :title="`字色 ${c}`"
                :aria-label="`字色 ${c}`"
                @click="applyColor(c)"
              />
            </span>
            <button
              type="button"
              class="tool-btn"
              title="清除字色 (clearColor)"
              @click="cmd('clearColor', () => editorRef?.clearColor())"
            >
              <span class="tool-clear">清字色</span>
            </button>
          </div>

          <div class="tool-group">
            <span class="swatch-row">
              <button
                v-for="c in BACKGROUND_COLORS"
                :key="c"
                type="button"
                class="swatch"
                :style="{ background: c }"
                :title="`底色 ${c}`"
                :aria-label="`底色 ${c}`"
                @click="applyBgColor(c)"
              />
            </span>
            <button
              type="button"
              class="tool-btn"
              title="清除底色 (clearBgColor)"
              @click="cmd('clearBgColor', () => editorRef?.clearBgColor())"
            >
              <span class="tool-clear">清底色</span>
            </button>
          </div>

          <span class="tool-divider" />

          <div class="tool-group">
            <select
              class="tool-select"
              title="段落样式"
              aria-label="段落样式"
              @change="applyParagraph"
            >
              <option v-for="style in PARAGRAPH_STYLES" :key="style.value" :value="style.value">
                {{ style.label }}
              </option>
            </select>
            <select class="tool-select" title="字号" aria-label="字号" @change="applyFontSize">
              <option v-for="size in FONT_SIZES" :key="size" :value="size">{{ size }}px</option>
            </select>
          </div>

          <span class="tool-divider" />

          <div class="tool-group">
            <button
              v-for="a in ALIGNMENTS"
              :key="a"
              type="button"
              class="tool-btn"
              :title="`对齐 ${a} (setAlignment)`"
              :aria-label="`对齐 ${a}`"
              @click="applyAlignment(a)"
            >
              <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
                <line
                  v-for="(b, i) in ALIGN_BARS[a]"
                  :key="i"
                  :x1="b[0]"
                  :y1="b[2]"
                  :x2="b[1]"
                  :y2="b[2]"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                />
              </svg>
            </button>
            <button
              type="button"
              class="tool-btn"
              title="增加缩进 (indent)"
              aria-label="增加缩进"
              @click="cmd('indent', () => editorRef?.indent())"
            >
              ⇥
            </button>
            <button
              type="button"
              class="tool-btn"
              title="减少缩进 (outdent)"
              aria-label="减少缩进"
              @click="cmd('outdent', () => editorRef?.outdent())"
            >
              ⇤
            </button>
          </div>
        </div>

        <!-- 编辑器主卡片 -->
        <div class="editor-card card">
          <div ref="editorContainerRef" class="editor-shell">
            <YuqueRichText
              ref="editorRef"
              :value="content"
              show-toolbar
              show-toc
              :upload-image="fakeUpload"
              @change="handleChange"
              @load="handleLoad"
              @error="handleError"
              @focus="handleFocus"
              @blur="handleBlur"
              @selectionchange="handleSelectionChange"
            />
          </div>
          <div class="editor-foot">
            <span class="pill">
              字数<b>{{ wordCount }}</b>
            </span>
            <span class="pill">
              字符<b>{{ content.length }}</b>
            </span>
            <span class="pill">
              isEmpty<b>{{ empty ? "true" : "false" }}</b>
            </span>
            <span class="foot-hint">粘贴图片可触发 uploadImage（结果见浏览器控制台）</span>
          </div>
        </div>
      </section>

      <!-- ===== 右侧：检查器 + 事件日志 ===== -->
      <aside v-if="showRail" class="rail">
        <section class="rail-section card">
          <h2 class="rail-title">检查器</h2>
          <div class="inspector-grid">
            <button type="button" class="cell-btn" @click="resetContent">重置内容</button>
            <button type="button" class="cell-btn" @click="getSummary">纯文本摘要</button>
            <button type="button" class="cell-btn" @click="checkEmpty">isEmpty</button>
            <button type="button" class="cell-btn" @click="logWordCount">字数统计</button>
            <button
              type="button"
              class="cell-btn"
              @click="cmd('focusToStart', () => editorRef?.focusToStart())"
            >
              光标至开头
            </button>
            <button
              type="button"
              class="cell-btn"
              @click="cmd('selectAll', () => editorRef?.selectAll())"
            >
              全选
            </button>
          </div>

          <h2 class="rail-title" style="margin-top: 16px">导出格式</h2>
          <div class="scheme-row">
            <button
              v-for="{ scheme, label } in EXPORT_SCHEMES"
              :key="scheme"
              type="button"
              class="cell-btn"
              @click="exportAs(scheme)"
            >
              {{ label }}
            </button>
          </div>

          <p class="rail-hint">
            命令结果输出到下方事件日志。选中文字可添加划词评论，粘贴一张图片即可触发 uploadImage
            模拟上传。
          </p>
        </section>

        <section class="rail-section card logs-section">
          <div class="logs-head">
            <h2 class="rail-title">
              事件日志 <span class="count">{{ logs.length }}</span>
            </h2>
            <button type="button" class="text-btn" @click="clearLogs">清空</button>
          </div>
          <div class="logs">
            <template v-if="logs.length === 0">
              <span class="logs-empty">操作编辑器，事件日志将显示在这里…</span>
            </template>
            <template v-else>
              <div v-for="(log, i) in logs" :key="i" class="log-line" :class="{ latest: i === 0 }">
                {{ log }}
              </div>
            </template>
          </div>
        </section>
      </aside>
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

    <!-- 底部回复编辑器（fixed 定位，评论面板打开时右侧避让） -->
    <div class="reply-editor-wrapper" :class="{ 'has-panel': showPanel }">
      <ReplyEditorPanel placeholder="输入回复内容，支持富文本格式…" @submit="handleReplySubmit" />
    </div>
  </div>
</template>

<style>
/* Vue 示例特有：评论徽标与底部回复编辑器定位 */
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

.workspace {
  padding-bottom: 180px;
}
</style>
