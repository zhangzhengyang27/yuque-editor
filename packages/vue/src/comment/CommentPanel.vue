<script setup lang="ts">
import { ref, computed } from "vue"
import type { Comment } from "./types"
import CommentCard from "./CommentCard.vue"

const props = defineProps<{
  comments: Comment[]
}>()

const emit = defineEmits<{
  (e: "reply", commentId: string, content: string): void
  (e: "resolve", commentId: string): void
  (e: "unresolve", commentId: string): void
  (e: "delete", commentId: string): void
  (e: "scroll-to", commentId: string): void
  (e: "hover", commentId: string): void
  (e: "leave"): void
  (e: "close"): void
}>()

type FilterType = "all" | "unresolved" | "resolved"
const currentFilter = ref<FilterType>("all")

const filteredComments = computed(() => {
  switch (currentFilter.value) {
    case "unresolved":
      return props.comments.filter((c) => !c.resolved)
    case "resolved":
      return props.comments.filter((c) => c.resolved)
    default:
      return [...props.comments]
  }
})

const unresolvedCount = computed(() => props.comments.filter((c) => !c.resolved).length)
const totalCount = computed(() => props.comments.length)

function setFilter(type: FilterType) {
  currentFilter.value = type
}
</script>

<template>
  <Teleport to="body">
    <div class="yuque-comment-panel">
      <!-- 头部 -->
      <div class="yuque-comment-panel-header">
        <div style="display: flex; align-items: center">
          <span class="yuque-comment-panel-title">评论</span>
          <span class="yuque-comment-panel-count">{{ totalCount }}</span>
        </div>
        <button class="yuque-comment-panel-close" @click="emit('close')">✕</button>
      </div>

      <!-- 筛选 -->
      <div class="yuque-comment-panel-filters">
        <button
          class="yuque-comment-filter-btn"
          :class="{ active: currentFilter === 'all' }"
          @click="setFilter('all')"
        >
          全部 {{ totalCount }}
        </button>
        <button
          class="yuque-comment-filter-btn"
          :class="{ active: currentFilter === 'unresolved' }"
          @click="setFilter('unresolved')"
        >
          待解决 {{ unresolvedCount }}
        </button>
        <button
          class="yuque-comment-filter-btn"
          :class="{ active: currentFilter === 'resolved' }"
          @click="setFilter('resolved')"
        >
          已解决 {{ totalCount - unresolvedCount }}
        </button>
      </div>

      <!-- 评论列表 -->
      <div class="yuque-comment-panel-body">
        <!-- 空状态 -->
        <div v-if="filteredComments.length === 0" class="yuque-comment-panel-empty">
          <div class="yuque-comment-panel-empty-icon">💬</div>
          <div>
            {{
              currentFilter === "all"
                ? "暂无评论"
                : currentFilter === "unresolved"
                  ? "没有待解决的评论"
                  : "没有已解决的评论"
            }}
          </div>
        </div>

        <!-- 评论卡片 -->
        <CommentCard
          v-for="comment in filteredComments"
          :key="comment.id"
          :comment="comment"
          @reply="(content) => emit('reply', comment.id, content)"
          @resolve="emit('resolve', comment.id)"
          @unresolve="emit('unresolve', comment.id)"
          @delete="emit('delete', comment.id)"
          @scroll-to="emit('scroll-to', comment.id)"
          @hover="emit('hover', comment.id)"
          @leave="emit('leave')"
        />
      </div>
    </div>
  </Teleport>
</template>
