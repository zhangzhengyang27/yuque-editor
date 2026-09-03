# 05 - 回复编辑器

## 1. 概述

### 功能描述

回复编辑器是一个基于 `contenteditable` 的轻量级富文本编辑器组件，专为评论回复场景设计。它提供了以下核心能力：

- **富文本格式化**：加粗、有序/无序列表、段落样式（正文/标题 1-3/引用）
- **链接插入/取消**：通过弹窗输入 URL，支持自动补全 `https://` 协议
- **表情选择器**：内置常用表情、面部表情、手势三类共 90 个 Emoji
- **快捷键支持**：`⌘+Enter` 提交、`Ctrl+B` 加粗
- **两种显示模式**：默认模式（带圆角边框，适合独立展示）和紧凑模式（无边框，适合内嵌在评论卡片中）

整个编辑器体系由三个组件构成，自底向上分别是：

```
ReplyEditorPanel（面板容器 — 负责外层布局和阴影）
  └── ReplyEditor（核心编辑器 — contenteditable + 工具栏 + 所有逻辑）
        └── EmojiPicker（表情选择器 — 独立弹出面板）
```

### 为什么不用现成的富文本库？

这是一个非常好的问题。在社区中，成熟的富文本编辑器库比比皆是——ProseMirror、TipTap、Quill、Slate、CKEditor……每一个都是数万行代码的工程巨兽。但我们选择回到最原始的 `contenteditable` + `document.execCommand` 方案，理由有三：

1. **场景极简**：回复编辑器不是全文编辑器。用户不会在回复里写三万字的文档、插入表格、嵌入视频。它只需要：加粗、列表、标题、链接、表情——这些 `execCommand` 原生就能搞定。引入 TipTap 之类就像用大炮打蚊子。

2. **零依赖**：不引入任何第三方编辑器库，意味着零安装开销、零版本冲突风险、零额外的 bundle 体积。对于一个"评论回复"级别的功能，这个考量至关重要。

3. **可定制性**：`execCommand` 虽然已被标记为 Deprecated（废弃），但目前所有主流浏览器仍然支持它，且短期内不会移除。而且对于我们的极简场景，它足够用。如果未来真的需要升级，可以把核心逻辑迁移到 TipTap 或 ProseMirror，但现阶段完全没有必要提前工程化。

> **导师说**：工程中有一个重要原则叫 YAGNI（You Aren't Gonna Need It）——你不会需要它。当你的需求只是一个能加粗和发表情的回复框时，就不要引入一个 200KB 的编辑器框架。先跑起来，再按需演进。

### 组件结构图

```
┌─────────────────────────────────────────────┐
│           ReplyEditorPanel.vue               │
│  ┌─────────────────────────────────────────┐ │
│  │           ReplyEditor.vue               │ │
│  │  ┌───────────────────────────────────┐  │ │
│  │  │    contenteditable 编辑区域       │  │ │
│  │  │    (min-height: 80px)             │  │ │
│  │  └───────────────────────────────────┘  │ │
│  │  ┌───────────────────────────────────┐  │ │
│  │  │           工具栏                  │  │ │
│  │  │  [段落▼] | [B][UL][OL][🔗][😊]  │  │ │
│  │  │                      ⌘+Enter 回复 │  │ │
│  │  └───────────────────────────────────┘  │ │
│  │  ┌───────────────────────────────────┐  │ │
│  │  │  EmojiPicker.vue (弹窗)           │  │ │
│  │  │  [常用][表情][手势]               │  │ │
│  │  └───────────────────────────────────┘  │ │
│  └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

---

## 2. contenteditable 基础

### 什么是 contenteditable

`contenteditable` 是 HTML5 的一个全局属性。给任意 HTML 元素加上 `contenteditable="true"`，它就变成了可编辑区域——用户可以直接在其中键入文字、删除、粘贴，浏览器会自动处理光标位置、选区、撤销重做等。

```html
<!-- 最简单的富文本编辑器 —— 一行代码 -->
<div contenteditable="true">在这里输入...</div>
```

浏览器在背后做了大量工作：
- 维护一个 **Selection（选区）** 和 **Range（范围）** 对象
- 处理键盘输入、粘贴、删除等事件
- 支持通过 `document.execCommand()` 执行格式化命令（加粗、斜体、列表等）
- 内置撤销/重做栈（`Ctrl+Z` / `Ctrl+Shift+Z`）

这就是为什么我们不引入任何编辑器库就能实现富文本编辑——浏览器本身就提供了这个能力。

### CSS Placeholder 实现（`:empty::before`）

`contenteditable` 有一个天然的缺陷：**没有原生的 placeholder 机制**。`<input>` 和 `<textarea>` 有 `placeholder` 属性，但 `contenteditable` 元素没有。

我们的解决方案是纯 CSS：

```css
/* 当编辑区内容为空时，通过伪元素显示占位符 */
.reply-editor-content:empty::before {
  content: attr(placeholder);  /* 从 HTML 属性读取占位符文本 */
  color: #999;                  /* 灰色文字 */
  pointer-events: none;         /* 不拦截鼠标事件 */
}
```

模板中的对应写法：

```html
<div
  class="reply-editor-content"
  contenteditable="true"
  :placeholder="placeholder"   <!-- 自定义属性，CSS 通过 attr() 读取 -->
  @input="onInput"
></div>
```

**原理拆解**：

1. `:empty` — CSS 伪类，匹配**没有任何子节点**（包括文本节点）的元素。当用户清空编辑区后，浏览器通常会使元素变为 empty。
2. `::before` — 伪元素，在元素内容之前插入一段虚拟内容。
3. `content: attr(placeholder)` — 从元素的 `placeholder` 属性读取值作为伪元素的文本内容。这是 `attr()` 函数的妙用。
4. `pointer-events: none` — 关键属性！让伪元素不拦截鼠标事件。否则用户点击占位符时，焦点会打到伪元素上，而不是进入编辑区。

> **注意**：这里有一个浏览器兼容性陷阱。有些浏览器在清空 contenteditable 后不会真正移除内部的 `<br>` 标签，导致 `:empty` 不生效。实际项目中可以配合 JS 在 blur 时检测内容并手动清理。但对于我们的场景，浏览器默认行为已经够用。

### 深度选择器 `:deep()` 的必要性

Vue 的 `<style scoped>` 会给组件内每个 DOM 元素添加一个 `data-v-xxxxxxxx` 属性，并将 CSS 选择器限定在带该属性的元素范围内。这带来了一个问题：**contenteditable 中用户输入产生的 HTML 元素不会被添加这个属性**。

举个例子，当用户通过工具栏插入一个 `<b>` 标签时，DOM 会变成：

```html
<div class="reply-editor-content" data-v-abc12345>
  <b>加粗文字</b>           <!-- 没有 data-v 属性！ -->
</div>
```

此时你写的 `.reply-editor-content b { font-weight: 600 }` 在 scoped 模式下会被编译为：

```css
.reply-editor-content[data-v-abc12345] b[data-v-abc12345] { font-weight: 600 }
```

由于 `<b>` 标签没有 `data-v-abc12345`，这条样式规则**永远不会命中**。

解决方案就是 `:deep()` 伪函数：

```css
/* 使用 :deep() 穿透 scoped 限制，样式可以命中编辑区内动态生成的元素 */
.reply-editor-content :deep(b),
.reply-editor-content :deep(strong) {
  font-weight: 600;
}
```

编译后变为：

```css
.reply-editor-content[data-v-abc12345] b { font-weight: 600 }
```

这样就不再要求 `<b>` 标签也带 scoped 属性了。这是 Vue scoped CSS 中处理动态内容的标准做法。

> **导师说**：`:deep()` 是 Vue 3 的写法（取代了 Vue 2 的 `>>>` 和 `/deep/`）。记住这个规则——只要你需要样式化**组件内部动态生成的 DOM**（contenteditable 的输入内容、v-html 渲染的 HTML、第三方组件的内部元素），就必须使用 `:deep()`。

---

## 3. ReplyEditor.vue 详解

这是整个回复编辑器的核心组件，包含了所有编辑逻辑、工具栏交互和弹窗管理。下面我们逐块拆解。

### 3.1 Props 与 Emits

```typescript
// 组件接收三个可选属性
interface Props {
  placeholder?: string   // 占位符文本
  compact?: boolean      // 紧凑模式（去除边框和圆角）
  autoFocus?: boolean    // 自动聚焦
}

// 设置默认值
const props = withDefaults(defineProps<Props>(), {
  placeholder: '请输入内容...',  // 默认提示文案
  compact: false,               // 默认非紧凑模式
  autoFocus: false              // 默认不自动聚焦
})

// 向父组件发射的事件
const emit = defineEmits<{
  (e: 'submit', content: string): void   // 提交内容（⌘+Enter 或点击回复按钮）
  (e: 'input', content: string): void    // 内容变化时实时通知
  (e: 'focus'): void                     // 编辑区获得焦点
  (e: 'blur'): void                      // 编辑区失去焦点
}>()
```

**为什么需要 `submit` 和 `input` 两个事件？**

- `input`：每次用户键入字符都会触发，适合做"正在输入..."提示、字数统计等实时功能。
- `submit`：只在用户明确点击回复按钮或按 `⌘+Enter` 时触发，适合做实际的"发送回复"操作。

这是一种常见的编辑器事件设计模式——将"正在编辑"和"确认提交"分开处理。

### 3.2 响应式状态表

```typescript
// DOM 引用
const editorRef = ref<HTMLElement | null>(null)       // 编辑区域 DOM
const linkInputRef = ref<HTMLInputElement | null>(null) // 链接弹窗输入框 DOM

// 内容状态
const content = ref('')                                    // 当前 HTML 内容
const hasContent = computed(() => content.value.trim().length > 0)  // 是否有内容（去除空白后）

// 格式状态 —— 用于工具栏按钮的 active 高亮
const isBold = ref(false)              // 当前选区是否加粗
const isUnorderedList = ref(false)     // 当前选区是否在无序列表中
const isOrderedList = ref(false)       // 当前选区是否在有序列表中
const isLink = ref(false)              // 当前选区是否在链接中

// 段落样式
const paragraphStyles = [
  { value: 'p', label: '正文' },
  { value: 'h1', label: '标题 1' },
  { value: 'h2', label: '标题 2' },
  { value: 'h3', label: '标题 3' },
  { value: 'blockquote', label: '引用' }
]
const currentParagraphStyle = ref(paragraphStyles[0])  // 当前段落样式，默认"正文"
const paragraphDropdownVisible = ref(false)              // 段落下拉菜单是否可见

// 链接弹窗
const linkDialogVisible = ref(false)  // 链接输入弹窗是否可见
const linkUrl = ref('')               // 弹窗中的 URL 输入值
```

这些状态共同驱动了整个编辑器的 UI 呈现：
- `isBold`/`isUnorderedList` 等通过 `:class="{ active: isBold }"` 控制工具栏按钮的高亮状态
- `paragraphDropdownVisible` 控制"段落样式"下拉菜单的显示/隐藏
- `linkDialogVisible` 控制链接输入弹窗的显示/隐藏

### 3.3 onInput、onKeyDown

```typescript
/**
 * 编辑区输入事件处理
 * 每次用户键入内容时触发，将编辑区的 innerHTML 同步到 content 变量
 */
function onInput() {
  content.value = editorRef.value?.innerHTML || ''  // 读取富文本 HTML
  emit('input', content.value)                       // 通知父组件
}

/**
 * 编辑区键盘事件处理
 * 负责拦截快捷键并执行对应操作
 */
function onKeyDown(e: KeyboardEvent) {
  // ⌘+Enter（Mac）/ Ctrl+Enter（Windows）—— 提交回复
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault()  // 阻止默认行为（避免插入换行）
    submit()            // 执行提交
    return
  }

  // Ctrl+B / ⌘+B —— 切换加粗
  if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
    e.preventDefault()  // 阻止浏览器默认的书签打开行为
    toggleBold()
    return
  }
}
```

**为什么 `metaKey || ctrlKey`？**

`metaKey` 对应 Mac 上的 `⌘（Command）` 键，`ctrlKey` 对应 Windows/Linux 上的 `Ctrl` 键。使用 `||` 同时监听两个修饰键，可以确保跨平台行为一致。

**为什么需要 `e.preventDefault()`？**

- `⌘+Enter` 默认在某些浏览器中可能有特殊行为
- `⌘+B` 在 Mac 上默认打开书签面板——如果不阻止，浏览器会弹出书签侧边栏而不是在编辑器里加粗文字

### 3.4 execCommand 封装

```typescript
/**
 * 封装 document.execCommand
 * 统一处理：执行命令 → 更新格式状态 → 重新聚焦
 *
 * @param command - execCommand 命令名（如 'bold', 'insertUnorderedList'）
 * @param value   - 命令参数（可选，如链接 URL）
 */
function execCommand(command: string, value: string | undefined = undefined) {
  document.execCommand(command, false, value)  // false 表示不显示 UI 提示
  updateFormatState()                           // 立即更新工具栏按钮状态
  editorRef.value?.focus()                      // 重新聚焦编辑区（保持光标位置）
}
```

**为什么不直接调用 `document.execCommand`，而要封装一层？**

1. **统一后处理**：每次执行命令后都需要更新格式状态（让工具栏按钮的 active 状态正确）并重新聚焦编辑区。封装后只需写一次。
2. **未来迁移便利**：如果将来要把 `execCommand` 替换为其他 API（如 `Selection` + `Range` 手动操作 DOM），只需修改这个函数即可，调用方完全不用改。

### 3.5 格式化功能

#### toggleBold — 加粗切换

```typescript
/**
 * 切换当前选区的加粗状态
 * 如果已加粗则取消，未加粗则应用
 */
function toggleBold() {
  execCommand('bold')  // execCommand 的 bold 命令自带 toggle 行为
}
```

`document.execCommand('bold')` 是一个 **toggle 命令**——如果当前选区已经加粗，它会取消加粗；如果没有，它会应用加粗。不需要我们手动判断当前状态。

#### toggleUnorderedList / toggleOrderedList — 列表切换

```typescript
/**
 * 切换无序列表
 */
function toggleUnorderedList() {
  execCommand('insertUnorderedList')
}

/**
 * 切换有序列表
 */
function toggleOrderedList() {
  execCommand('insertOrderedList')
}
```

同样，这两个命令也是 toggle 类型的。

#### 段落样式 — 下拉选择

```typescript
/**
 * 切换段落样式下拉菜单的显示/隐藏
 */
function toggleParagraphDropdown() {
  paragraphDropdownVisible.value = !paragraphDropdownVisible.value
}

/**
 * 关闭段落样式下拉菜单
 * 由 v-click-outside 指令在点击外部时调用
 */
function closeParagraphDropdown() {
  paragraphDropdownVisible.value = false
}

/**
 * 设置段落样式
 * 通过 formatBlock 命令将当前段落包裹在指定的 HTML 标签中
 *
 * @param style - 段落样式对象 { value: 'p'|'h1'|'h2'|'h3'|'blockquote', label: '显示名' }
 */
function setParagraphStyle(style: typeof paragraphStyles[0]) {
  currentParagraphStyle.value = style  // 更新当前显示的段落样式名
  const tag = style.value               // 获取标签名

  if (tag === 'blockquote') {
    // 引用块 —— formatBlock 需要 <blockquote> 标签名
    execCommand('formatBlock', 'blockquote')
  } else if (tag.startsWith('h')) {
    // 标题 —— formatBlock 支持 <h1>, <h2>, <h3> 等
    execCommand('formatBlock', tag)
  } else {
    // 正文 —— 恢复为 <p> 段落
    execCommand('formatBlock', 'p')
  }

  closeParagraphDropdown()  // 选择后自动关闭下拉菜单
}
```

`formatBlock` 命令的工作原理：它会在当前光标位置（或选区）外面包裹一个块级元素。例如，如果当前光标在一个普通的文本节点中，执行 `formatBlock('h1')` 后，这个文本节点会被包裹在 `<h1></h1>` 中。

**注意**：`formatBlock` 的参数需要带尖括号（`<h1>`），但现代浏览器也接受不带尖括号的写法（`h1`）。这里我们使用不带尖括号的方式，更简洁。

#### 链接插入/取消

```typescript
/**
 * 切换链接状态
 * 如果当前选区已经在链接中，则取消链接（unlink）
 * 否则弹出链接输入弹窗
 */
function toggleLink() {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return  // 没有选区则不做操作

  // 检查当前光标是否在一个 <a> 标签内
  const node = selection.anchorNode?.parentElement
  if (node && (node.tagName === 'A' || node.closest('a'))) {
    // 已在链接中 → 取消链接
    execCommand('unlink')
    return
  }

  // 不在链接中 → 显示链接输入弹窗
  linkDialogVisible.value = true
  linkUrl.value = ''
  nextTick(() => {
    linkInputRef.value?.focus()  // 弹窗渲染完毕后自动聚焦到输入框
  })
}

/**
 * 关闭链接输入弹窗并清空输入值
 */
function closeLinkDialog() {
  linkDialogVisible.value = false
  linkUrl.value = ''
}

/**
 * 确认插入链接
 * 处理 URL 格式规范化，然后执行 createLink 命令
 */
function confirmLink() {
  if (!linkUrl.value.trim()) {
    closeLinkDialog()  // 空输入直接关闭
    return
  }

  let url = linkUrl.value.trim()

  // 自动补全协议头 —— 如果用户输入的是 example.com 而不是 https://example.com
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url
  }

  execCommand('createLink', url)  // 创建链接
  closeLinkDialog()               // 关闭弹窗
}
```

**链接功能的交互设计细节**：

1. **Toggle 逻辑**：点击链接按钮时，如果光标已经在链接中（用户想把链接去掉），就执行 `unlink` 取消链接；否则才弹出输入框。这是一种"开/关"行为，比"只能添加"的体验更好。

2. **协议自动补全**：用户输入 `example.com` 时自动加上 `https://`。这是用户体验的标配——不要让用户手动输入协议前缀。

3. **nextTick 聚焦**：弹窗的 DOM 是通过 `v-if` 动态创建的，设置 `linkDialogVisible = true` 后 DOM 不会立即存在。需要等 Vue 完成 DOM 更新后再聚焦输入框——这就是 `nextTick` 的作用。

#### 表情插入

```typescript
/**
 * 插入表情符号
 * 通过 insertText 命令在当前光标位置插入文本
 *
 * @param emoji - 表情字符（如 '👍'）
 */
function insertEmoji(emoji: string) {
  execCommand('insertText', emoji)
}
```

**为什么用 `insertText` 而不是直接操作 DOM？**

`document.execCommand('insertText', false, emoji)` 会在当前光标位置插入纯文本，同时：
- 保持撤销栈完整（`Ctrl+Z` 可以撤销）
- 不引入额外的 HTML 标签（不会被包裹在 `<span>` 中）
- 正确处理光标位置

如果直接用 `document.createTextNode(emoji)` 操作 DOM，虽然也能工作，但会破坏浏览器的撤销栈，用户按 `Ctrl+Z` 无法撤销插入的表情。

### 3.6 updateFormatState（queryCommandState）

```typescript
/**
 * 更新格式状态
 * 通过 document.queryCommandState 查询当前选区的格式状态
 * 这些状态用于控制工具栏按钮的 active 高亮
 *
 * 这个函数在以下时机被调用：
 * 1. 每次执行 execCommand 后（在 execCommand 封装中）
 * 2. 全局 selectionchange 事件触发时（选区变化时）
 */
function updateFormatState() {
  // queryCommandState 返回 boolean：当前选区是否应用了指定格式
  isBold.value = document.queryCommandState('bold')
  isUnorderedList.value = document.queryCommandState('insertUnorderedList')
  isOrderedList.value = document.queryCommandState('insertOrderedList')

  // 链接状态需要特殊处理 —— queryCommandState 没有 'createLink' 状态查询
  // 改为检查当前光标是否在 <a> 标签内
  const selection = window.getSelection()
  if (selection && selection.anchorNode) {
    const node = selection.anchorNode.parentElement
    isLink.value = !!(node && (node.tagName === 'A' || node.closest('a')))
    // node.closest('a') 向上查找到最近祖先中的 <a> 标签
    // 这覆盖了光标在链接文本的深层子节点中的情况
  }
}
```

**为什么监听 `selectionchange` 事件？**

用户在编辑区中移动光标时（用鼠标点击不同位置，或用方向键移动），需要实时更新工具栏按钮的高亮状态。比如光标移到加粗文字上时，加粗按钮应该高亮；移到普通文字上时，加粗按钮应该取消高亮。

```typescript
// 在 onMounted 中注册全局监听
onMounted(() => {
  if (props.autoFocus) {
    focus()
  }
  document.addEventListener('selectionchange', updateFormatState)  // 全局选区变化
})

// 在 onBeforeUnmount 中清除监听 —— 防止内存泄漏
onBeforeUnmount(() => {
  document.removeEventListener('selectionchange', updateFormatState)
})
```

`selectionchange` 是一个 **document 级别**的事件（不是 element 级别的），只要页面中任何地方的选区发生变化都会触发。这意味着我们的回调可能会被频繁调用。但对于这种简单的状态查询操作，性能开销可以忽略不计。

### 3.7 submit / clear / focus / setContent / getContent

```typescript
/**
 * 提交内容
 * 向父组件发射 submit 事件，然后清空编辑区
 */
function submit() {
  if (!hasContent.value) return       // 空内容不提交
  emit('submit', content.value)       // 通知父组件
  // 清空编辑区
  if (editorRef.value) {
    editorRef.value.innerHTML = ''    // 清空 DOM
    content.value = ''                // 清空状态
  }
}

/**
 * 聚焦编辑区
 */
function focus() {
  editorRef.value?.focus()
}

/**
 * 清空编辑区内容
 */
function clear() {
  if (editorRef.value) {
    editorRef.value.innerHTML = ''    // 清空 DOM
    content.value = ''                // 清空状态
  }
}

/**
 * 获取当前编辑区 HTML 内容
 */
function getContent() {
  return content.value
}

/**
 * 设置编辑区内容
 * @param html - 要设置的 HTML 字符串
 */
function setContent(html: string) {
  if (editorRef.value) {
    editorRef.value.innerHTML = html   // 设置 DOM
    content.value = html               // 同步状态
  }
}
```

**注意**：`submit` 和 `clear` 都同时操作了 DOM（`innerHTML`）和 Vue 状态（`content`）。这是因为在 `contenteditable` 场景下，**DOM 是真实数据源**，Vue 的响应式变量只是一个"影子副本"。必须在两处同时更新才能保持同步。

### 3.8 expose

```typescript
/**
 * 通过 defineExpose 向父组件暴露方法
 * 这样父组件可以通过 ref 调用编辑器的内部方法
 */
defineExpose({
  focus,        // 聚焦
  clear,        // 清空
  getContent,   // 获取内容
  setContent,   // 设置内容
  submit        // 提交
})
```

Vue 3 的 `<script setup>` 默认不会暴露任何变量给父组件。`defineExpose` 是显式打开这扇门的唯一方式。父组件可以通过模板 ref 调用这些方法：

```vue
<template>
  <ReplyEditor ref="editorRef" />
  <button @click="editorRef?.submit()">提交</button>
</template>
```

### 3.9 自定义 vClickOutside 指令

```typescript
/**
 * 自定义指令：点击元素外部时触发回调
 *
 * 用法：v-click-outside="closeDropdown"
 * 当点击发生在绑定元素外部时，自动调用 closeDropdown 函数
 *
 * 实现原理：
 * 1. mounted 时在 document 上注册 click 事件监听
 * 2. 每次点击时检查事件目标是否在元素内部（el.contains）
 * 3. 如果不在内部，调用绑定值（回调函数）
 * 4. unmounted 时移除监听，防止内存泄漏
 */
const vClickOutside = {
  mounted(el: HTMLElement, binding: any) {
    const handler = (e: MouseEvent) => {
      // 检查点击目标是否在当前元素内部
      if (!el.contains(e.target as Node)) {
        binding.value()  // 在外部点击 → 执行回调
      }
    }
    document.addEventListener('click', handler)
    // 将 handler 引用存到元素上，方便 unmounted 时移除
    ;(el as any)._clickOutside = handler
  },
  unmounted(el: HTMLElement) {
    // 清理：移除事件监听
    const handler = (el as any)._clickOutside
    if (handler) {
      document.removeEventListener('click', handler)
    }
  }
}
```

**为什么不使用现成的 `v-click-outside` 库？**

和编辑器的选型思路一致——一个简单的功能不需要引入额外的包。这个指令只有 20 行代码，自己实现更轻量，也更可控。

**使用场景**：

```html
<!-- 段落下拉菜单：点击外部时关闭 -->
<div v-click-outside="closeParagraphDropdown">
  <button @click="toggleParagraphDropdown">段落样式</button>
  <div v-show="paragraphDropdownVisible">...</div>
</div>

<!-- 链接弹窗：点击外部时关闭 -->
<div v-if="linkDialogVisible" v-click-outside="closeLinkDialog">
  ...
</div>
```

> **导师说**：注意这个指令定义了两次——在 `ReplyEditor.vue` 和 `EmojiPicker.vue` 中各定义了一次。这是因为 Vue 的 `<script setup>` 中注册的自定义指令不会自动传递给子组件。如果要做到全局复用，应该提取为一个独立的文件并通过 `app.directive()` 全局注册。但对于当前场景，重复 20 行代码是完全可以接受的。

### 3.10 两种模式（默认 vs compact）

```html
<div class="reply-editor" :class="{ 'reply-editor-compact': compact }">
```

```css
/* 默认模式：带圆角、带边框 —— 适合作为独立卡片展示 */
.reply-editor {
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e8e8e8;
  overflow: hidden;
}

/* 紧凑模式：无圆角、无边框 —— 适合嵌入到其他容器中 */
.reply-editor-compact {
  border: none;
  border-radius: 0;
}
```

**使用场景**：

- **默认模式**：作为独立的评论输入框，放在页面底部。它有自己的边框和圆角，视觉上是一个完整的卡片。
- **紧凑模式**：嵌入到评论卡片的回复区域中。此时它不需要自己的边框——因为外层的评论卡片已经有边框了。

两种模式共享完全相同的编辑逻辑和工具栏，仅通过 CSS 类切换外观。

---

## 4. EmojiPicker.vue

表情选择器是一个独立的子组件，通过弹出面板展示表情列表，用户点击后发射 `select` 事件将表情传递给父组件。

### 4.1 数据（常用/表情/手势）

```typescript
// 常用表情 —— 10 个，精选高频使用的表情
const commonEmojis = ['👍', '👎', '❤️', '🎉', '😄', '😂', '😊', '😍', '🤔', '👀']

// 表情分类 —— 50 个面部表情
const faceEmojis = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
  '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
  '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸',
  '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️',
  '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡'
]

// 手势分类 —— 30 个手势表情
const gestureEmojis = [
  '👍', '👎', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙',
  '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊',
  '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪'
]
```

数据分为三类：
- **常用**：10 个精选——点赞、踩、爱心、庆祝、笑——是评论场景中最高频的表情
- **表情**：50 个面部表情，覆盖开心、难过、惊讶、生气等基本情绪
- **手势**：30 个手势类，覆盖了最常用的手部动作

### 4.2 核心逻辑

```typescript
const emit = defineEmits<{
  (e: 'select', emoji: string): void  // 用户选择表情时发射
}>()

const visible = ref(false)  // 控制弹出面板的显示/隐藏

/**
 * 切换弹出面板
 */
function toggle() {
  visible.value = !visible.value
}

/**
 * 关闭弹出面板
 * 由 v-click-outside 指令在点击外部时调用
 */
function close() {
  visible.value = false
}

/**
 * 选择表情
 * 发射 select 事件后自动关闭面板
 *
 * @param emoji - 选中的表情字符
 */
function select(emoji: string) {
  emit('select', emoji)
  close()  // 选择后自动关闭，减少一次点击操作
}
```

整个组件的逻辑非常简洁——三个函数分别对应"打开/关闭"、"关闭"、"选择"。选择后自动关闭面板是一个体验优化：用户选完表情后通常不需要继续浏览表情列表，自动关闭可以让他立即回到编辑流程中。

### 4.3 样式（网格布局、hover 效果）

```css
/* 触发按钮 —— 笑脸图标 */
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
  background: #f0f0f0;   /* hover 时浅灰背景 */
  color: #333;           /* 文字加深 */
}

/* 弹出面板 —— 向上展开 */
.emoji-picker-dropdown {
  position: absolute;
  bottom: 100%;           /* 关键：从触发按钮上方展开 */
  left: 50%;
  transform: translateX(-50%);  /* 水平居中 */
  margin-bottom: 8px;      /* 与触发按钮保持 8px 间距 */
  width: 280px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);  /* 阴影营造层次感 */
  border: 1px solid #e8e8e8;
  z-index: 1000;           /* 确保在所有元素之上 */
}

/* 可滚动内容区 —— 限制最大高度防止弹出框过长 */
.emoji-picker-content {
  max-height: 240px;
  overflow-y: auto;        /* 超出时垂直滚动 */
  padding: 8px;
}

/* 表情网格 —— Flexbox 自动换行 */
.emoji-list {
  display: flex;
  flex-wrap: wrap;         /* 自动换行 */
  gap: 4px;               /* 表情之间的间距 */
}

/* 单个表情按钮 */
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

/* hover 效果 —— 背景变灰 + 轻微放大 */
.emoji-item:hover {
  background: #f0f0f0;
  transform: scale(1.1);   /* 放大到 110% */
}
```

**弹出方向设计**：表情面板使用 `bottom: 100%` 从**上方**弹出，而不是从下方弹出。这是因为编辑器的工具栏在页面底部，如果向下弹出会被页面边界截断。向上弹出是这种场景下的正确选择。

**网格布局**：使用 `display: flex` + `flex-wrap: wrap` 实现自动换行的网格布局，而不是 CSS Grid。原因很简单——表情是固定 32×32px 的按钮，Flexbox 的 `wrap` 就能完美处理，不需要 Grid 的行列定义。

---

## 5. ReplyEditorPanel.vue

### 5.1 薄包装层设计思路

`ReplyEditorPanel.vue` 是一个**薄包装层（Thin Wrapper）**组件，它在 `ReplyEditor` 的基础上只做两件事：

1. **提供外层容器样式**（背景、顶部边框、阴影）
2. **透传 Props 和 Events**

```vue
<template>
  <div class="reply-editor-panel" :class="{ 'reply-editor-panel-compact': compact }">
    <!-- 直接透传所有 props 和 events -->
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
```

**为什么需要这个包装层？**

在 Vue 中，组件的 CSS 作用域是独立的。如果直接给 `ReplyEditor` 加外层样式（比如固定在页面底部），这些样式应该由使用方来提供，而不是写在编辑器组件内部。`ReplyEditorPanel` 就是在说："我来负责把你固定在页面底部，你只管做好编辑的事。"

**透传模式**：Panel 组件的 props、events 和 expose 的方法与 `ReplyEditor` 完全一致。这意味着使用方可以互换这两个组件而不需要修改任何调用代码。

### 5.2 样式

```css
/* 默认模式 —— 顶部边框 + 轻微阴影，适合固定在页面底部 */
.reply-editor-panel {
  background: #fff;
  border-top: 1px solid #e8e8e8;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.04);  /* 向上的阴影 */
}

/* 紧凑模式 —— 去掉边框和阴影，融入周围容器 */
.reply-editor-panel-compact {
  border-top: none;
  box-shadow: none;
}
```

注意阴影方向是 **向上**的（`0 -2px`）——因为面板固定在页面底部，阴影应该向上投射，营造"悬浮在内容之上"的视觉层次。

---

## 6. document.execCommand 详解

### 6.1 命令表

本项目用到的 `document.execCommand` 命令汇总：

| 命令 | 类型 | 用途 | 示例 |
|------|------|------|------|
| `bold` | toggle | 切换加粗 | `execCommand('bold')` |
| `insertUnorderedList` | toggle | 切换无序列表 | `execCommand('insertUnorderedList')` |
| `insertOrderedList` | toggle | 切换有序列表 | `execCommand('insertOrderedList')` |
| `formatBlock` | state | 包裹块级标签 | `execCommand('formatBlock', 'h1')` |
| `createLink` | state | 创建超链接 | `execCommand('createLink', 'https://...')` |
| `unlink` | state | 移除超链接 | `execCommand('unlink')` |
| `insertText` | state | 在光标处插入纯文本 | `execCommand('insertText', 'emoji')` |

**toggle vs state**：

- **toggle 命令**：如果当前选区已应用该格式，则移除；否则应用。一次调用就完成"开/关"切换。
- **state 命令**：直接应用指定格式或执行指定操作，不做 toggle 判断。

对应的查询命令 `document.queryCommandState()`：

| 查询命令 | 返回值 | 含义 |
|----------|--------|------|
| `queryCommandState('bold')` | `true/false` | 当前选区是否加粗 |
| `queryCommandState('insertUnorderedList')` | `true/false` | 当前选区是否在无序列表中 |
| `queryCommandState('insertOrderedList')` | `true/false` | 当前选区是否在有序列表中 |

### 6.2 注意事项

1. **已标记为 Deprecated**：`document.execCommand` 在 MDN 上已被标记为废弃。但所有主流浏览器（Chrome、Firefox、Safari、Edge）仍然支持它，且 W3C 目前没有提供替代方案的标准。对于简单的富文本需求，它在可预见的未来仍然可用。

2. **第二个参数始终传 `false`**：`document.execCommand(command, showUI, value)` 的第二个参数 `showUI` 控制是否显示浏览器原生的 UI（如弹出的字体选择对话框）。我们始终传 `false`，因为我们要自定义所有 UI。

3. **操作的是当前选区**：所有 `execCommand` 命令都作用于 `window.getSelection()` 返回的当前选区。如果没有选区且光标不在可编辑区域中，命令不会生效。

4. **浏览器行为不一致**：不同浏览器对同一命令的实现可能略有差异。例如，`formatBlock` 在某些浏览器中要求参数带尖括号（`<h1>`），而另一些浏览器两种写法都接受。对于我们的极简场景，这些差异可以忽略。

5. **撤销栈**：`execCommand` 操作会被自动纳入浏览器的撤销栈。用户可以通过 `Ctrl+Z` / `⌘+Z` 撤销操作。但直接操作 DOM（如修改 `innerHTML`）会清空撤销栈。这就是为什么我们使用 `insertText` 插入表情，而不是直接操作 DOM。

> **导师说**：`execCommand` 虽然被标记为废弃，但实际上是"没有可替代方案的废弃"。W3C 的 Input Events Level 2 规范本意是提供一个更好的替代方案，但进展缓慢。在实际项目中，对于评论回复这种轻量级场景，`execCommand` 仍然是最佳选择。如果你的编辑器需求复杂到需要表格、图片拖拽、多人协作，那时再考虑 ProseMirror 或 TipTap 也不迟。

---

## 7. 样式系统设计

### 7.1 主题色 #00b96b

整个编辑器体系使用 `#00b96b`（一种鲜亮的绿色）作为主题色，这与语雀的品牌色一致。主题色在以下位置使用：

```css
/* 引用块左边框 */
.reply-editor-content :deep(blockquote) {
  border-left: 4px solid #00b96b;
  background: #f6ffed;       /* 极浅的绿色背景，呼应主题 */
}

/* 链接颜色 */
.reply-editor-content :deep(a) {
  color: #00b96b;
}

/* 工具栏按钮激活状态 */
.reply-editor-tool-btn.active {
  background: #e6f7ff;       /* 浅蓝色背景，让按钮"浮起来" */
  color: #00b96b;            /* 绿色文字 */
}

/* 提交按钮 */
.reply-editor-submit {
  background: #00b96b;       /* 主色调背景 */
  color: #fff;               /* 白色文字 */
}

.reply-editor-submit:hover:not(:disabled) {
  background: #009e5a;       /* hover 时加深 */
}

/* 链接输入框聚焦态 */
.reply-editor-link-input:focus {
  border-color: #00b96b;
  box-shadow: 0 0 0 2px rgba(0, 185, 107, 0.1);  /* 同色系的聚焦光环 */
}
```

配色策略：
- **主要操作**（提交按钮、链接颜色）使用主题色 `#00b96b`
- **hover/交互态**使用加深色 `#009e5a`
- **激活状态**使用浅蓝色背景 `#e6f7ff` + 主题色文字——注意这里背景用的是浅蓝色而不是浅绿色，这样视觉对比度更好，用户的眼睛更容易捕捉到"哪个按钮被激活了"

### 7.2 :deep() 用法

编辑器中所有需要样式化 contenteditable 内部动态生成的元素的地方，都使用了 `:deep()`：

```css
/* 段落间距 */
.reply-editor-content :deep(p) {
  margin: 0 0 8px;
}
.reply-editor-content :deep(p:last-child) {
  margin-bottom: 0;           /* 最后一个段落不需要下边距 */
}

/* 列表样式 */
.reply-editor-content :deep(ul),
.reply-editor-content :deep(ol) {
  margin: 0 0 8px;
  padding-left: 24px;         /* 列表缩进 */
}

/* 引用块 */
.reply-editor-content :deep(blockquote) {
  margin: 0 0 8px;
  padding: 8px 12px;
  border-left: 4px solid #00b96b;
  background: #f6ffed;
  color: #666;                /* 引用文字颜色稍浅 */
}

/* 链接 */
.reply-editor-content :deep(a) {
  color: #00b96b;
  text-decoration: none;       /* 去掉下划线 */
}
.reply-editor-content :deep(a:hover) {
  text-decoration: underline;  /* hover 时才显示下划线 */
}

/* 加粗 */
.reply-editor-content :deep(b),
.reply-editor-content :deep(strong) {
  font-weight: 600;           /* 比 bold（700）稍轻，更现代 */
}

/* 标题层级 */
.reply-editor-content :deep(h1) { font-size: 20px; }
.reply-editor-content :deep(h2) { font-size: 18px; }
.reply-editor-content :deep(h3) { font-size: 16px; }
```

**为什么标题字号从 20px 开始这么小？**

在回复编辑器中，标题不需要像文章正文那样大。回复通常只有几行到十几行，过大的标题会显得不协调。20px/18px/16px 的梯度在紧凑空间中已经足够区分层级。

### 7.3 CSS 技巧

#### contenteditable 的 min-height + max-height

```css
.reply-editor-content {
  min-height: 80px;   /* 最小高度 80px，保证编辑区不会太小 */
  max-height: 200px;  /* 最大高度 200px，超出时出现滚动条 */
  overflow-y: auto;   /* 垂直方向自动滚动 */
}
```

这种"弹性高度"设计让编辑区可以随着内容增长而扩展（80px → 200px），但不会无限增大占用页面空间。超过 200px 后出现滚动条，用户体验类似于 `<textarea>` 的 `rows` 属性，但更灵活。

#### 编辑区 outline: none

```css
.reply-editor-content {
  outline: none;  /* 移除浏览器默认的聚焦轮廓 */
}
```

`contenteditable` 元素在获得焦点时，浏览器会默认显示一个蓝色（或系统色）的轮廓线。在我们的设计中，编辑区有自己的边框（`border: 1px solid #e8e8e8`），聚焦时的视觉反馈由外层容器的样式处理，所以需要移除默认的 outline。

> **无障碍提示**：在正式产品中，移除 `outline` 后应该提供一个替代的聚焦指示器（比如边框颜色变化），以确保键盘用户能知道焦点在哪里。当前实现中外层容器的边框已经提供了这个功能。

#### 弹窗向上展开的定位

```css
/* 通用弹窗向上展开模式 */
.emoji-picker-dropdown,
.reply-editor-link-dialog {
  position: absolute;
  bottom: 100%;                   /* 从父元素顶部开始 */
  left: 50%;
  transform: translateX(-50%);    /* 水平居中 */
  margin-bottom: 8px;             /* 与父元素保持间距 */
}
```

这个定位模式的组合是前端开发中的常见套路：
- `bottom: 100%`：弹窗的底部对齐到父元素的顶部，实现"向上弹出"
- `left: 50%` + `transform: translateX(-50%)`：水平居中对齐
- `margin-bottom: 8px`：弹窗和触发按钮之间留出呼吸空间

#### 按钮禁用态

```css
.reply-editor-submit:disabled {
  opacity: 0.5;           /* 半透明 */
  cursor: not-allowed;    /* 禁止光标 */
}
```

当编辑区内容为空时，提交按钮被禁用（`:disabled="!hasContent"`）。通过降低透明度和更换鼠标光标，给用户明确的"现在不能点"的视觉反馈。

---

## 8. 本章学到的知识点

### 技术知识点

1. **contenteditable**：HTML5 的全局属性，将任意元素变为可编辑区域。浏览器自动处理光标、选区、撤销栈等。

2. **document.execCommand**：浏览器原生提供的富文本命令接口。虽然已被标记为 Deprecated，但所有主流浏览器仍然支持，适合轻量级编辑器场景。

3. **document.queryCommandState**：查询当前选区是否应用了指定格式（如加粗、列表），用于驱动工具栏按钮的激活状态。

4. **CSS `:empty::before` + `attr()`**：纯 CSS 实现 contenteditable 的 placeholder 效果，无需 JavaScript。

5. **Vue `:deep()` 深度选择器**：穿透 scoped 样式的限制，样式化组件内部动态生成的 DOM 元素。

6. **自定义指令 `vClickOutside`**：通过 `mounted`/`unmounted` 生命周期注册/清理 document 级别的事件监听，实现"点击外部关闭"功能。

7. **defineExpose**：Vue 3 `<script setup>` 中向父组件暴露组件内部方法的标准方式。

8. **nextTick**：等待 Vue 完成 DOM 更新后再执行操作（如自动聚焦弹窗输入框）。

9. **薄包装层模式**：创建一个只负责布局/样式的包装组件，透传 props 和 events，实现关注点分离。

### 设计思想

1. **YAGNI 原则**：不需要 TipTap、ProseMirror 这种重量级编辑器框架，用 `execCommand` 就够用。先跑起来，再按需演进。

2. **关注点分离**：`EmojiPicker` 只负责表情选择，`ReplyEditor` 负责编辑逻辑，`ReplyEditorPanel` 负责外层布局。每个组件职责清晰。

3. **数据源的一致性**：在 contenteditable 场景下，DOM 是真实数据源。所有对内容的修改必须同时更新 DOM 和 Vue 响应式变量。

4. **交互闭环**：选择表情后自动关闭面板、点击外部关闭弹窗、提交后自动清空编辑区——每个操作都有完整的"触发 → 处理 → 反馈"闭环。

5. **跨平台兼容**：`metaKey || ctrlKey` 同时监听 Mac 和 Windows 的修饰键，确保快捷键在所有平台上正常工作。
