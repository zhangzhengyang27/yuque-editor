<template>
  <div class="emoji-picker" v-click-outside="close">
    <div class="emoji-picker-trigger" @click="toggle">
      <svg viewBox="0 0 24 24" width="18" height="18">
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
        <circle cx="9" cy="10" r="1.5" fill="currentColor"/>
        <circle cx="15" cy="10" r="1.5" fill="currentColor"/>
        <path d="M8 14c.5 2 2 3 4 3s3.5-1 4-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </div>
    
    <div v-show="visible" class="emoji-picker-dropdown">
      <div class="emoji-picker-header">
        <span class="emoji-picker-title">表情</span>
        <button class="emoji-picker-close" @click="close">×</button>
      </div>
      <div class="emoji-picker-content">
        <div class="emoji-category">常用</div>
        <div class="emoji-list">
          <button
            v-for="emoji in commonEmojis"
            :key="emoji"
            class="emoji-item"
            @click="select(emoji)"
          >
            {{ emoji }}
          </button>
        </div>
        
        <div class="emoji-category">表情</div>
        <div class="emoji-list">
          <button
            v-for="emoji in faceEmojis"
            :key="emoji"
            class="emoji-item"
            @click="select(emoji)"
          >
            {{ emoji }}
          </button>
        </div>
        
        <div class="emoji-category">手势</div>
        <div class="emoji-list">
          <button
            v-for="emoji in gestureEmojis"
            :key="emoji"
            class="emoji-item"
            @click="select(emoji)"
          >
            {{ emoji }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  (e: 'select', emoji: string): void
}>()

const visible = ref(false)

// 常用表情
const commonEmojis = ['👍', '👎', '❤️', '🎉', '😄', '😂', '😊', '😍', '🤔', '👀']

// 表情
const faceEmojis = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
  '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
  '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸',
  '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️',
  '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡'
]

// 手势
const gestureEmojis = [
  '👍', '👎', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙',
  '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊',
  '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪'
]

function toggle() {
  visible.value = !visible.value
}

function close() {
  visible.value = false
}

function select(emoji: string) {
  emit('select', emoji)
  close()
}

// 点击外部关闭指令
const vClickOutside = {
  mounted(el: HTMLElement, binding: any) {
    const handler = (e: MouseEvent) => {
      if (!el.contains(e.target as Node)) {
        binding.value()
      }
    }
    document.addEventListener('click', handler)
    ;(el as any)._clickOutside = handler
  },
  unmounted(el: HTMLElement) {
    const handler = (el as any)._clickOutside
    if (handler) {
      document.removeEventListener('click', handler)
    }
  }
}
</script>

<style scoped>
.emoji-picker {
  position: relative;
  display: inline-flex;
}

.emoji-picker-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  cursor: pointer;
  color: #666;
  transition: all 0.2s;
}

.emoji-picker-trigger:hover {
  background: #f0f0f0;
  color: #333;
}

.emoji-picker-dropdown {
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

.emoji-picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.emoji-picker-title {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.emoji-picker-close {
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

.emoji-picker-close:hover {
  background: #f5f5f5;
  color: #666;
}

.emoji-picker-content {
  max-height: 240px;
  overflow-y: auto;
  padding: 8px;
}

.emoji-category {
  font-size: 12px;
  color: #999;
  padding: 8px 4px 4px;
  font-weight: 500;
}

.emoji-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.emoji-item {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s;
}

.emoji-item:hover {
  background: #f0f0f0;
  transform: scale(1.1);
}
</style>
