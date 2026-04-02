<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import type { Comment } from './types'
import { formatRelativeTime, getUserInitial } from './utils'

defineProps<{
  comment: Comment
}>()

const emit = defineEmits<{
  (e: 'reply', content: string): void
  (e: 'resolve'): void
  (e: 'unresolve'): void
  (e: 'delete'): void
  (e: 'hover'): void
  (e: 'leave'): void
  (e: 'scroll-to'): void
}>()

const showReplyInput = ref(false)
const replyText = ref('')
const replyInputRef = ref<HTMLTextAreaElement | null>(null)

const canSubmitReply = computed(() => replyText.value.trim().length > 0)

function handleReply() {
  if (!canSubmitReply.value) return
  emit('reply', replyText.value.trim())
  replyText.value = ''
  showReplyInput.value = false
}

function toggleReply() {
  showReplyInput.value = !showReplyInput.value
  if (showReplyInput.value) {
    nextTick(() => {
      replyInputRef.value?.focus()
    })
  }
}

function onSubmitReply(e: Event) {
  if (e instanceof KeyboardEvent && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    handleReply()
  }
}

function handleCardClick() {
  emit('scroll-to')
}
</script>

<template>
  <div
    class="yuque-comment-card"
    :class="{ resolved: comment.resolved }"
    @mouseenter="emit('hover')"
    @mouseleave="emit('leave')"
  >
    <!-- 头部：头像 + 用户名 + 时间 + 状态 -->
    <div class="yuque-comment-card-header">
      <div class="yuque-comment-avatar">{{ getUserInitial(comment.user) }}</div>
      <div class="yuque-comment-meta">
        <div class="yuque-comment-author">{{ comment.user.name }}</div>
        <div class="yuque-comment-time">{{ formatRelativeTime(comment.createdAt) }}</div>
      </div>
      <span v-if="comment.resolved" class="yuque-comment-status resolved">已解决</span>
    </div>

    <!-- 高亮文本预览 -->
    <div
      v-if="comment.highlight"
      class="yuque-comment-highlight-text"
      @click="handleCardClick"
      :title="comment.highlight.text"
    >
      「{{ comment.highlight.text }}」
    </div>

    <!-- 评论内容 -->
    <div class="yuque-comment-content">{{ comment.content }}</div>

    <!-- 操作按钮 -->
    <div class="yuque-comment-actions">
      <button class="yuque-comment-action-btn" @click="toggleReply">
        {{ comment.replies.length > 0 ? `回复 (${comment.replies.length})` : '回复' }}
      </button>
      <button
        v-if="!comment.resolved"
        class="yuque-comment-action-btn resolve"
        @click="emit('resolve')"
      >
        标记已解决
      </button>
      <button
        v-else
        class="yuque-comment-action-btn resolve"
        @click="emit('unresolve')"
      >
        取消已解决
      </button>
      <button class="yuque-comment-action-btn delete" @click="emit('delete')">
        删除
      </button>
    </div>

    <!-- 回复列表 -->
    <div v-if="comment.replies.length > 0" class="yuque-comment-replies">
      <div v-for="reply in comment.replies" :key="reply.id" class="yuque-comment-reply">
        <div class="yuque-comment-reply-avatar">{{ getUserInitial(reply.user) }}</div>
        <div class="yuque-comment-reply-content">
          <div class="yuque-comment-reply-author">{{ reply.user.name }}</div>
          <div class="yuque-comment-reply-text">{{ reply.content }}</div>
          <div class="yuque-comment-reply-time">{{ formatRelativeTime(reply.createdAt) }}</div>
        </div>
      </div>
    </div>

    <!-- 回复输入框 -->
    <div v-if="showReplyInput" class="yuque-comment-reply-input">
      <textarea
        ref="replyInputRef"
        v-model="replyText"
        placeholder="写下回复... (Ctrl+Enter 发送)"
        rows="2"
        @keydown="onSubmitReply"
      />
      <button
        class="yuque-comment-reply-submit"
        :disabled="!canSubmitReply"
        @click="handleReply"
      >
        发送
      </button>
    </div>
  </div>
</template>
