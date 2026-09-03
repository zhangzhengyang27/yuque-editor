<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed, nextTick } from "vue"
import type { HighlightSelection } from "./types"

const props = defineProps<{
  visible: boolean
  anchorRect?: DOMRect | null
  highlight?: HighlightSelection | null
}>()

const emit = defineEmits<{
  (e: "submit", content: string): void
  (e: "cancel"): void
}>()

const text = ref("")
const popoverEl = ref<HTMLDivElement | null>(null)
const textareaEl = ref<HTMLTextAreaElement | null>(null)
const canSubmit = computed(() => text.value.trim().length > 0)

function handleSubmit() {
  if (!canSubmit.value) return
  emit("submit", text.value.trim())
  text.value = ""
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    handleSubmit()
  }
  if (e.key === "Escape") {
    emit("cancel")
  }
}

/** 根据锚点位置计算弹窗位置 */
function updatePosition() {
  if (!popoverEl.value || !props.anchorRect || !props.visible) return

  const popover = popoverEl.value
  const rect = props.anchorRect
  const popW = 340
  const gap = 10

  let top = rect.top - gap
  let left = rect.left + rect.width / 2 - popW / 2

  // 边界修正：不超出视口
  if (left < 8) left = 8
  if (left + popW > window.innerWidth - 8) left = window.innerWidth - popW - 8

  // 如果上方空间不足，显示在下方
  if (top < 8) {
    top = rect.bottom + gap
  }

  popover.style.top = `${top}px`
  popover.style.left = `${left}px`
}

watch(
  () => props.visible,
  (v) => {
    if (v) {
      nextTick(() => {
        updatePosition()
        // `autofocus` 属性在 v-if 重建时各浏览器行为不一，显式聚焦更可靠
        textareaEl.value?.focus()
      })
    }
  },
)

watch(
  () => props.anchorRect,
  () => {
    nextTick(() => updatePosition())
  },
)

function handleClickOutside(e: MouseEvent) {
  if (popoverEl.value && !popoverEl.value.contains(e.target as Node)) {
    // 只在弹窗可见时响应
    if (props.visible) {
      emit("cancel")
    }
  }
}

onMounted(() => {
  document.addEventListener("mousedown", handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener("mousedown", handleClickOutside)
})
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" ref="popoverEl" class="yuque-comment-popover" style="position: fixed">
      <div class="yuque-comment-popover-header">
        <span>添加评论</span>
        <button class="yuque-comment-popover-close" @click="emit('cancel')">✕</button>
      </div>

      <!-- 高亮文本预览 -->
      <div v-if="highlight" class="yuque-comment-popover-highlight">「{{ highlight.text }}」</div>

      <div class="yuque-comment-popover-body">
        <textarea
          ref="textareaEl"
          v-model="text"
          placeholder="写下你的评论... (Ctrl+Enter 发送)"
          @keydown="handleKeyDown"
        />
      </div>

      <div class="yuque-comment-popover-footer">
        <button class="yuque-comment-popover-cancel" @click="emit('cancel')">取消</button>
        <button class="yuque-comment-popover-submit" :disabled="!canSubmit" @click="handleSubmit">
          评论
        </button>
      </div>
    </div>
  </Teleport>
</template>
