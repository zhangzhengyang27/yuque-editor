<template>
  <div class="reply-editor-panel" :class="{ 'reply-editor-panel-compact': compact }">
    <ReplyEditor
      ref="editorRef"
      :placeholder="placeholder"
      :compact="compact"
      :auto-focus="autoFocus"
      @submit="onSubmit"
      @input="onInput"
      @focus="onFocus"
      @blur="onBlur"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue"
import ReplyEditor from "./ReplyEditor.vue"

interface Props {
  placeholder?: string
  compact?: boolean
  autoFocus?: boolean
}

withDefaults(defineProps<Props>(), {
  placeholder: "请输入回复内容...",
  compact: false,
  autoFocus: false,
})

const emit = defineEmits<{
  (e: "submit", content: string): void
  (e: "input", content: string): void
  (e: "focus"): void
  (e: "blur"): void
}>()

const editorRef = ref<InstanceType<typeof ReplyEditor> | null>(null)

function onSubmit(content: string) {
  emit("submit", content)
}

function onInput(content: string) {
  emit("input", content)
}

function onFocus() {
  emit("focus")
}

function onBlur() {
  emit("blur")
}

// 暴露方法给父组件
function focus() {
  editorRef.value?.focus()
}

function clear() {
  editorRef.value?.clear()
}

function getContent() {
  return editorRef.value?.getContent() || ""
}

function setContent(html: string) {
  editorRef.value?.setContent(html)
}

function submit() {
  editorRef.value?.submit()
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
.reply-editor-panel {
  background: #fff;
  border-top: 1px solid #e8e8e8;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.04);
}

.reply-editor-panel-compact {
  border-top: none;
  box-shadow: none;
}
</style>
