<template>
  <div class="reply-editor" :class="{ 'reply-editor-compact': compact }">
    <!-- 编辑器区域 -->
    <div
      ref="editorRef"
      class="reply-editor-content"
      contenteditable="true"
      :placeholder="placeholder"
      @input="onInput"
      @keydown="onKeyDown"
      @focus="onFocus"
      @blur="onBlur"
    ></div>

    <!-- 工具栏 -->
    <div class="reply-editor-toolbar">
      <div class="reply-editor-tools">
        <!-- 段落样式 -->
        <div v-click-outside="closeParagraphDropdown" class="reply-editor-dropdown">
          <button class="reply-editor-tool-btn" @mousedown.prevent @click="toggleParagraphDropdown">
            <span>{{ currentParagraphStyle.label }}</span>
            <svg viewBox="0 0 24 24" width="12" height="12">
              <path
                d="M7 10l5 5 5-5"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
          <div v-show="paragraphDropdownVisible" class="reply-editor-dropdown-menu">
            <button
              v-for="style in paragraphStyles"
              :key="style.value"
              class="reply-editor-dropdown-item"
              :class="{ active: currentParagraphStyle.value === style.value }"
              @mousedown.prevent
              @click="setParagraphStyle(style)"
            >
              {{ style.label }}
            </button>
          </div>
        </div>

        <div class="reply-editor-divider"></div>

        <!-- 加粗 -->
        <button
          class="reply-editor-tool-btn"
          :class="{ active: isBold }"
          title="加粗 (Ctrl+B)"
          @mousedown.prevent
          @click="toggleBold"
        >
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path
              d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6V4zm0 8h9a4 4 0 014 4 4 4 0 01-4 4H6v-8z"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>

        <!-- 无序列表 -->
        <button
          class="reply-editor-tool-btn"
          :class="{ active: isUnorderedList }"
          title="无序列表"
          @mousedown.prevent
          @click="toggleUnorderedList"
        >
          <svg viewBox="0 0 24 24" width="16" height="16">
            <line
              x1="8"
              y1="6"
              x2="21"
              y2="6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
            <line
              x1="8"
              y1="12"
              x2="21"
              y2="12"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
            <line
              x1="8"
              y1="18"
              x2="21"
              y2="18"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
            <circle cx="4" cy="6" r="2" fill="currentColor" />
            <circle cx="4" cy="12" r="2" fill="currentColor" />
            <circle cx="4" cy="18" r="2" fill="currentColor" />
          </svg>
        </button>

        <!-- 有序列表 -->
        <button
          class="reply-editor-tool-btn"
          :class="{ active: isOrderedList }"
          title="有序列表"
          @mousedown.prevent
          @click="toggleOrderedList"
        >
          <svg viewBox="0 0 24 24" width="16" height="16">
            <line
              x1="10"
              y1="6"
              x2="21"
              y2="6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
            <line
              x1="10"
              y1="12"
              x2="21"
              y2="12"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
            <line
              x1="10"
              y1="18"
              x2="21"
              y2="18"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
            <path
              d="M4 6h1v4M4 6v-.5A1.5 1.5 0 015.5 4v0A1.5 1.5 0 017 5.5V6"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
            <path
              d="M4 12h1v4M4 12v-.5A1.5 1.5 0 015.5 10v0A1.5 1.5 0 017 11.5V12"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
            <path
              d="M4 18h1v4M4 18v-.5A1.5 1.5 0 015.5 16v0A1.5 1.5 0 017 17.5V18"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
        </button>

        <!-- 链接 -->
        <button
          class="reply-editor-tool-btn"
          :class="{ active: isLink }"
          title="插入链接"
          @mousedown.prevent
          @click="toggleLink"
        >
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path
              d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>

        <!-- 表情 -->
        <EmojiPicker @select="insertEmoji" />
      </div>

      <div class="reply-editor-actions">
        <span class="reply-editor-hint">⌘ + Enter 提交</span>
        <button class="reply-editor-submit" :disabled="!hasContent" @click="submit">
          <svg v-if="!compact" viewBox="0 0 24 24" width="14" height="14">
            <circle cx="12" cy="12" r="10" fill="currentColor" />
            <path d="M12 8v8M8 12h8" stroke="white" stroke-width="2" stroke-linecap="round" />
          </svg>
          回复
        </button>
      </div>
    </div>

    <!-- 链接输入弹窗 -->
    <div
      v-if="linkDialogVisible"
      v-click-outside="closeLinkDialog"
      class="reply-editor-link-dialog"
    >
      <div class="reply-editor-link-dialog-header">
        <span>插入链接</span>
        <button class="reply-editor-link-dialog-close" @click="closeLinkDialog">×</button>
      </div>
      <div class="reply-editor-link-dialog-body">
        <input
          ref="linkInputRef"
          v-model="linkUrl"
          type="text"
          placeholder="https://example.com"
          class="reply-editor-link-input"
          @keydown.enter="confirmLink"
        />
      </div>
      <div class="reply-editor-link-dialog-footer">
        <button class="reply-editor-link-btn reply-editor-link-btn-cancel" @click="closeLinkDialog">
          取消
        </button>
        <button class="reply-editor-link-btn reply-editor-link-btn-confirm" @click="confirmLink">
          确定
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from "vue"
import type { Directive } from "vue"
import EmojiPicker from "./EmojiPicker.vue"

interface Props {
  placeholder?: string
  compact?: boolean
  autoFocus?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: "请输入内容...",
  compact: false,
  autoFocus: false,
})

const emit = defineEmits<{
  (e: "submit", content: string): void
  (e: "input", content: string): void
  (e: "focus"): void
  (e: "blur"): void
}>()

const editorRef = ref<HTMLElement | null>(null)
const linkInputRef = ref<HTMLInputElement | null>(null)

const content = ref("")
const hasContent = computed(() => content.value.trim().length > 0)

// 格式状态
const isBold = ref(false)
const isUnorderedList = ref(false)
const isOrderedList = ref(false)
const isLink = ref(false)

// 段落样式
const paragraphStyles = [
  { value: "p", label: "正文" },
  { value: "h1", label: "标题 1" },
  { value: "h2", label: "标题 2" },
  { value: "h3", label: "标题 3" },
  { value: "blockquote", label: "引用" },
]
const currentParagraphStyle = ref(paragraphStyles[0])
const paragraphDropdownVisible = ref(false)

// 链接弹窗
const linkDialogVisible = ref(false)
const linkUrl = ref("")
/** 打开链接弹窗时保存的编辑器内选区，confirmLink 时恢复，避免选区落入输入框 */
let savedRange: Range | null = null

// 点击外部关闭指令（handler 存 WeakMap，避免在元素上挂自定义属性）
const clickOutsideHandlers = new WeakMap<HTMLElement, (e: MouseEvent) => void>()

const vClickOutside: Directive<HTMLElement, () => void> = {
  mounted(el, binding) {
    const handler = (e: MouseEvent) => {
      if (!el.contains(e.target as Node)) {
        binding.value()
      }
    }
    document.addEventListener("click", handler)
    clickOutsideHandlers.set(el, handler)
  },
  unmounted(el) {
    const handler = clickOutsideHandlers.get(el)
    if (handler) {
      document.removeEventListener("click", handler)
    }
    clickOutsideHandlers.delete(el)
  },
}

onMounted(() => {
  if (props.autoFocus) {
    focus()
  }
  document.addEventListener("selectionchange", updateFormatState)
})

onBeforeUnmount(() => {
  document.removeEventListener("selectionchange", updateFormatState)
})

function onInput() {
  content.value = editorRef.value?.innerHTML || ""
  emit("input", content.value)
}

function onKeyDown(e: KeyboardEvent) {
  // Cmd/Ctrl + Enter 提交
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
    e.preventDefault()
    submit()
    return
  }

  // Ctrl+B 加粗
  if ((e.ctrlKey || e.metaKey) && e.key === "b") {
    e.preventDefault()
    toggleBold()
    return
  }
}

function onFocus() {
  emit("focus")
}

function onBlur() {
  emit("blur")
}

function submit() {
  if (!hasContent.value) return
  emit("submit", content.value)
  // 清空内容
  if (editorRef.value) {
    editorRef.value.innerHTML = ""
    content.value = ""
  }
}

function focus() {
  editorRef.value?.focus()
}

function clear() {
  if (editorRef.value) {
    editorRef.value.innerHTML = ""
    content.value = ""
  }
}

function getContent() {
  return content.value
}

function setContent(html: string) {
  if (editorRef.value) {
    editorRef.value.innerHTML = html
    content.value = html
  }
}

// 格式化命令
function execCommand(command: string, value: string | undefined = undefined) {
  document.execCommand(command, false, value)
  updateFormatState()
  editorRef.value?.focus()
}

function toggleBold() {
  execCommand("bold")
}

function toggleUnorderedList() {
  execCommand("insertUnorderedList")
}

function toggleOrderedList() {
  execCommand("insertOrderedList")
}

function toggleParagraphDropdown() {
  paragraphDropdownVisible.value = !paragraphDropdownVisible.value
}

function closeParagraphDropdown() {
  paragraphDropdownVisible.value = false
}

function setParagraphStyle(style: (typeof paragraphStyles)[0]) {
  currentParagraphStyle.value = style
  const tag = style.value

  if (tag === "blockquote") {
    execCommand("formatBlock", "blockquote")
  } else if (tag.startsWith("h")) {
    execCommand("formatBlock", tag)
  } else {
    execCommand("formatBlock", "p")
  }

  closeParagraphDropdown()
}

function toggleLink() {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return

  // 检查是否已有链接
  const node = selection.anchorNode?.parentElement
  if (node && (node.tagName === "A" || node.closest("a"))) {
    // 取消链接
    execCommand("unlink")
    return
  }

  // 保存当前选区：弹窗输入框会抢走焦点，确认时需要恢复后再 createLink
  savedRange = selection.getRangeAt(0).cloneRange()
  linkDialogVisible.value = true
  linkUrl.value = ""
  nextTick(() => {
    linkInputRef.value?.focus()
  })
}

function closeLinkDialog() {
  linkDialogVisible.value = false
  linkUrl.value = ""
  savedRange = null
}

/** 把选区恢复到打开弹窗前的位置 */
function restoreSavedSelection() {
  if (!savedRange) return
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(savedRange)
  savedRange = null
}

function confirmLink() {
  if (!linkUrl.value.trim()) {
    closeLinkDialog()
    return
  }

  let url = linkUrl.value.trim()
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url
  }

  restoreSavedSelection()
  execCommand("createLink", url)
  closeLinkDialog()
}

function insertEmoji(emoji: string) {
  execCommand("insertText", emoji)
}

function updateFormatState() {
  // 只反映本编辑器内的选区：主编辑器等其他区域选中文字时，
  // queryCommandState 会返回那边的状态，导致工具栏高亮错乱
  const selection = window.getSelection()
  const inside = !!(
    selection &&
    selection.anchorNode &&
    editorRef.value?.contains(selection.anchorNode)
  )
  if (!inside) {
    isBold.value = false
    isUnorderedList.value = false
    isOrderedList.value = false
    isLink.value = false
    return
  }

  isBold.value = document.queryCommandState("bold")
  isUnorderedList.value = document.queryCommandState("insertUnorderedList")
  isOrderedList.value = document.queryCommandState("insertOrderedList")

  // 检查链接状态
  if (selection && selection.anchorNode) {
    const node = selection.anchorNode.parentElement
    isLink.value = !!(node && (node.tagName === "A" || node.closest("a")))
  }
}

defineExpose({
  focus,
  clear,
  getContent,
  setContent,
  submit,
})
</script>

<style scoped>
.reply-editor {
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e8e8e8;
  overflow: hidden;
}

.reply-editor-compact {
  border: none;
  border-radius: 0;
}

.reply-editor-content {
  min-height: 80px;
  max-height: 200px;
  padding: 12px 16px;
  outline: none;
  font-size: 14px;
  line-height: 1.6;
  color: #333;
  overflow-y: auto;
}

.reply-editor-content:empty::before {
  content: attr(placeholder);
  color: #999;
  pointer-events: none;
}

.reply-editor-content :deep(p) {
  margin: 0 0 8px;
}

.reply-editor-content :deep(p:last-child) {
  margin-bottom: 0;
}

.reply-editor-content :deep(ul),
.reply-editor-content :deep(ol) {
  margin: 0 0 8px;
  padding-left: 24px;
}

.reply-editor-content :deep(li) {
  margin-bottom: 4px;
}

.reply-editor-content :deep(blockquote) {
  margin: 0 0 8px;
  padding: 8px 12px;
  border-left: 4px solid #00b96b;
  background: #f6ffed;
  color: #666;
}

.reply-editor-content :deep(a) {
  color: #00b96b;
  text-decoration: none;
}

.reply-editor-content :deep(a:hover) {
  text-decoration: underline;
}

.reply-editor-content :deep(b),
.reply-editor-content :deep(strong) {
  font-weight: 600;
}

.reply-editor-content :deep(h1),
.reply-editor-content :deep(h2),
.reply-editor-content :deep(h3) {
  margin: 0 0 8px;
  font-weight: 600;
}

.reply-editor-content :deep(h1) {
  font-size: 20px;
}

.reply-editor-content :deep(h2) {
  font-size: 18px;
}

.reply-editor-content :deep(h3) {
  font-size: 16px;
}

.reply-editor-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-top: 1px solid #f0f0f0;
  background: #fafafa;
}

.reply-editor-tools {
  display: flex;
  align-items: center;
  gap: 4px;
}

.reply-editor-divider {
  width: 1px;
  height: 20px;
  background: #e0e0e0;
  margin: 0 4px;
}

.reply-editor-tool-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border: none;
  background: transparent;
  color: #666;
  font-size: 13px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.reply-editor-tool-btn:hover {
  background: #e8e8e8;
  color: #333;
}

.reply-editor-tool-btn.active {
  background: #e6f7ff;
  color: #00b96b;
}

.reply-editor-dropdown {
  position: relative;
}

.reply-editor-dropdown-menu {
  position: absolute;
  bottom: 100%;
  left: 0;
  margin-bottom: 4px;
  min-width: 100px;
  background: #fff;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border: 1px solid #e8e8e8;
  z-index: 100;
}

.reply-editor-dropdown-item {
  display: block;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: transparent;
  text-align: left;
  font-size: 13px;
  color: #333;
  cursor: pointer;
  transition: all 0.15s;
}

.reply-editor-dropdown-item:hover {
  background: #f5f5f5;
}

.reply-editor-dropdown-item.active {
  background: #e6f7ff;
  color: #00b96b;
}

.reply-editor-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.reply-editor-hint {
  font-size: 12px;
  color: #999;
}

.reply-editor-submit {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: #00b96b;
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.reply-editor-submit:hover:not(:disabled) {
  background: #009e5a;
}

.reply-editor-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 链接弹窗 */
.reply-editor-link-dialog {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: 8px;
  width: 280px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  border: 1px solid #e8e8e8;
  z-index: 1000;
}

.reply-editor-link-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.reply-editor-link-dialog-close {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: #999;
  font-size: 18px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.reply-editor-link-dialog-close:hover {
  background: #f5f5f5;
  color: #666;
}

.reply-editor-link-dialog-body {
  padding: 12px 16px;
}

.reply-editor-link-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 14px;
  outline: none;
  transition: all 0.2s;
}

.reply-editor-link-input:focus {
  border-color: #00b96b;
  box-shadow: 0 0 0 2px rgba(0, 185, 107, 0.1);
}

.reply-editor-link-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid #f0f0f0;
}

.reply-editor-link-btn {
  padding: 6px 16px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.reply-editor-link-btn-cancel {
  border: 1px solid #d9d9d9;
  background: #fff;
  color: #666;
}

.reply-editor-link-btn-cancel:hover {
  border-color: #00b96b;
  color: #00b96b;
}

.reply-editor-link-btn-confirm {
  border: none;
  background: #00b96b;
  color: #fff;
}

.reply-editor-link-btn-confirm:hover {
  background: #009e5a;
}
</style>
