# yuque-editor-core

语雀（Lake）编辑器的核心封装，默认使用离线资源，不依赖运行时联网。

支持 React 18、Vue 3 和原生 DOM 三种接入方式，同时提供 CJS + ESM + 类型声明双格式输出。

## 特性

- 📦 **开箱即用** — 内置离线资源，零配置启动
- ⚡ **双格式输出** — CJS + ESM，Tree-shaking 友好
- 🔗 **多框架支持** — React 18 / Vue 3 / 原生 DOM
- 🛡️ **实例稳定** — 浅比较策略，避免不必要的实例重建
- 🔧 **Vite 插件** — 开发和构建时自动拷贝离线资源
- 🐛 **调试模式** — `YUQUE_EDITOR_DEBUG=1` 查看内部错误详情

## 安装

```bash
pnpm add yuque-editor-core
```

> React 和 Vue 为可选 peer dependency，按需安装即可。

## 资源（离线）

本项目已内置离线资源文件，构建后会把 `assets/yuque-assets` 拷贝到 `dist/yuque-assets`。

浏览器运行时需要把这些静态文件以 `/yuque-assets/*` 的路径提供出来（例如放到站点的 `public` 目录）。

## 使用

### 原生（DOM）

```ts
import { createYuqueEditor } from "yuque-editor-core/editor"

const ref = await createYuqueEditor({
  container: document.getElementById("app")!,
  value: "<p>Hello</p>"
})
```

### React

```tsx
import { YuqueRichText } from "yuque-editor-core/react"
import type { YuqueEditorRef } from "yuque-editor-core/editor"

export default function App() {
  const [value, setValue] = React.useState("<p>Hello</p>")
  const editorRef = React.useRef<YuqueEditorRef>(null)

  return (
    <YuqueRichText
      ref={editorRef}
      value={value}
      onChange={setValue}
    />
  )
}
```

### Vue 3

```vue
<template>
  <YuqueRichText
    ref="editorRef"
    :value="value"
    @change="onChange"
  />
</template>

<script setup lang="ts">
import { ref } from "vue"
import { YuqueRichText } from "yuque-editor-core/vue"
import type { YuqueEditorRef } from "yuque-editor-core/editor"

const editorRef = ref<YuqueEditorRef | null>(null)
const value = ref("<p>Hello</p>")

function onChange(next: string) {
  value.value = next
}
</script>
```

### 错误处理

React：通过 `onError` 回调监听初始化失败或内部异常。

```tsx
<YuqueRichText
  value={value}
  onChange={setValue}
  onError={(error) => {
    console.error("[YuqueRichText] 初始化/运行异常:", error)
  }}
/>
```

Vue 3：通过 `@error` 事件监听。

```vue
<YuqueRichText
  :value="value"
  @change="onChange"
  @error="onError"
/>
```

### 图片 / 视频上传

通过 `uploadImage` / `uploadVideo` 钩子接入自定义上传逻辑，支持 `url`、`file`、`base64` 三类输入：

```tsx
<YuqueRichText
  value={value}
  onChange={setValue}
  uploadImage={async ({ type, data }) => {
    // type: "url" | "file" | "base64"
    const formData = new FormData()
    if (type === "file") {
      formData.append("file", data as File)
    } else {
      // base64 string 需要自行转换或上传
    }
    const res = await fetch("/api/upload", { method: "POST", body: formData })
    const json = await res.json()
    // 返回 url（必填）、size（必填）、filename（可选）、cover（视频封面，可选）
    return { url: json.url, size: json.size, filename: json.filename }
  }}
/>
```

### 调试模式

设置环境变量 `YUQUE_EDITOR_DEBUG=1`，可在控制台查看被 `safeCall` 兜底吞掉的内部错误，便于排查问题：

```bash
YUQUE_EDITOR_DEBUG=1 pnpm dev
```

### Vite 插件

在开发和构建时自动把离线资源拷贝到项目 `public/yuque-assets`：

```ts
import { yuqueAssets } from "yuque-editor-core/vite-assets"

export default {
  plugins: [yuqueAssets()]
}
```

高级配置：

```ts
yuqueAssets({
  // 自定义输出目录，默认 "public/yuque-assets"
  publicSubDir: "static/editor-assets",
  // 显式指定本地资源目录，跳过自动搜索
  assetsDir: "./local-assets/yuque-assets"
})
```

## 实例 API

通过 `ref`（React）或模板引用（Vue）获取编辑器实例：

```tsx
const editorRef = useRef<YuqueEditorRef>(null)

// 写入内容
editorRef.current?.setContent("<p>New content</p>", "text/html")

// 读取内容
const html = editorRef.current?.getContent("text/html")

// 字数统计（中文 + 英文混合计数）
const count = editorRef.current?.wordCount()

// 销毁实例
editorRef.current?.destroy()
```

完整 API 列表：

| 方法 | 说明 |
|------|------|
| `appendContent(html, breakLine?)` | 在选区插入内容，`breakLine` 为 `true` 时先插入空行 |
| `setContent(content, scheme?)` | 写入内容并同步文档格式 |
| `getContent(scheme?)` | 按指定格式读取当前文档 |
| `isEmpty()` | 判断文档是否为空 |
| `getSummaryContent()` | 获取纯文本摘要 |
| `wordCount()` | 字数统计（中文按字符、英文按单词计数） |
| `focusToStart(offset?)` | 光标移至文档起始位置 |
| `insertBreakLine()` | 插入空行 |
| `destroy()` | 销毁实例、解绑事件并清理 DOM |
| `undo()` | 撤销上一个命令 |
| `redo()` | 重做上一个撤销的命令 |
| `insertText(text)` | 在当前选区插入普通文本 |
| `setBold(value?)` | 切换选中文本的加粗状态 |
| `setItalic(value?)` | 切换选中文本的斜体状态 |
| `setUnderline(value?)` | 切换选中文本的下划线状态 |
| `setStrikethrough(value?)` | 切换选中文本的中划线状态 |
| `setColor(color)` | 设置选中文本的颜色（支持渐变色） |
| `setBgColor(color)` | 设置选中文本的背景颜色 |
| `clearColor()` | 清除文本前景色 |
| `clearBgColor()` | 清除文本背景颜色 |
| `setAlignment(value)` | 设置段落对齐方式，可选值：`left` / `right` / `center` / `justify` / `distributed` |
| `setParagraphStyle(style)` | 设置段落样式，可选值：`p` / `h1` ~ `h6` |
| `setFontsize(size)` | 设置字号，可选值：`12, 13, 14, 15, 16, 19, 22, 24, 29, 32, 40` |
| `indent()` | 增加缩进 |
| `outdent()` | 减少缩进 |
| `clearFormat()` | 清除选区的格式 |
| `selectAll()` | 全选当前文档 |
| `getWordCount()` | `wordCount()` 的别名 |

> `destroy()` 仅移除编辑器自身的 DOM 节点，不会清空宿主容器的其他内容。

### 事件回调

| 事件 | 触发时机 |
|------|---------|
| `onChange` | 文档内容变化（已内置去重，不会因自身 setContent 重复触发） |
| `onLoad` | 编辑器初始化完成 |
| `onError` | 初始化失败或内部异常 |
| `onFocus` | 编辑器获得焦点 |
| `onBlur` | 编辑器失去焦点 |
| `onSelectionChange` | 选区发生变化 |
| `onFocusStatusChange` | 焦点状态变化，`focused` 参数指示是否获得焦点 |
| `onBeforeDestroy` | 编辑器销毁前触发 |

## 工具函数导出

除了编辑器组件，还导出了一些内部工具函数，可在特殊场景下使用：

```ts
import { shallowEqual, normalizeError, resetAssetLoaders } from "yuque-editor-core/editor"

// 浅比较 — 用于判断对象/函数是否语义相等
shallowEqual({ a: 1 }, { a: 1 }) // true

// 错误标准化 — 将任意值转为 Error 实例
normalizeError("string error") // Error: string error

// 重置资源加载器 — 适用于 SSR 多请求隔离或单元测试清理
resetAssetLoaders()
```

## 项目接手指南

这一节面向后续维护者，帮助快速建立对仓库结构、运行时链路和常见问题的整体认知。

### 目录与职责

| 文件 | 职责 |
|------|------|
| `src/editor.ts` | 核心能力：资源加载、编辑器初始化、实例 API 封装 |
| `src/react.tsx` | React 18 组件封装（`forwardRef` 暴露底层实例） |
| `src/vue.ts` | Vue 3 组件封装（`expose` 暴露底层实例） |
| `src/assets.ts` | 离线资源文件名定义与 URL 解析工具 |
| `src/vite-assets.ts` | Vite 插件，开发和构建时自动复制静态资源 |
| `assets/yuque-assets/*` | 内置离线资源源文件 |
| `scripts/postbuild.cjs` | 构建后整理 `dist` 目录结构并复制离线资源 |

### 调用时序图（初始化）

```mermaid
sequenceDiagram
  participant App as 业务应用
  participant Wrapper as React/Vue 封装层
  participant Core as createYuqueEditor
  participant Assets as ensureAssets
  participant Doc as window.Doc (doc.umd.js)
  participant Editor as Lake 编辑器实例

  App->>Wrapper: 传入 value/scheme/配置
  Wrapper->>Core: 调用 createYuqueEditor(options)
  Core->>Assets: 分层并行加载 CSS/JS 离线资源（去重）
  Assets-->>Core: 资源可用
  Core->>Doc: 读取 window.Doc
  Doc-->>Core: createOpenEditor/createOpenViewer
  Core->>Editor: 创建实例 + 注入插件配置
  Core->>Editor: setDocument(初始值)
  Editor-->>Core: contentchange 事件
  Core-->>Wrapper: onChange(value)
  Wrapper-->>App: 派发 change/load 回调
```

### 关键配置说明

| 配置项 | 类型 | 说明 |
|--------|------|------|
| `value` | `string` | 编辑器内容初始值和受控值 |
| `scheme` | `YuqueDocScheme` | 文档格式，可选：`text/html` / `text/markdown` / `text/plain` / `text/lake` / `json` |
| `readOnly` | `boolean` | 只读模式，底层走 `createOpenViewer` |
| `assets` | `Partial<YuqueEditorAssets>` | 覆盖默认离线资源地址 |
| `onChange` | `(value: string) => void` | 内容变更回调 |
| `onLoad` | `() => void` | 编辑器初始化完成回调 |
| `onError` | `(error: Error) => void` | 错误回调 |
| `onFocus` | `() => void` | 编辑器获得焦点时触发 |
| `onBlur` | `() => void` | 编辑器失去焦点时触发 |
| `onSelectionChange` | `() => void` | 选区变化时触发 |
| `onFocusStatusChange` | `(focused: boolean) => void` | 焦点状态变化时触发 |
| `onBeforeDestroy` | `() => void` | 编辑器销毁前触发 |
| `uploadImage` | `EditorUploadHandler` | 图片上传钩子，入参 `{ type, data }` |
| `uploadVideo` | `EditorUploadHandler` | 视频上传钩子，入参 `{ type, data }` |
| `showToolbar` | `boolean` | 控制工具栏显示，默认 `true` |
| `showToc` | `boolean` | 控制目录显示 |
| `paragraphSpacing` | `boolean` | 段落间距（经典排版） |
| `defaultFontSize` | `number` | 默认字号，默认 `15` |
| `darkMode` | `boolean` | 暗黑模式 |
| `disabledToolbarItems` | `string[]` | 禁用指定的工具栏按钮 |
| `toolbarItems` | `string[]` | 完全自定义工具栏按钮列表 |

### 常见坑位与排查

- **静态资源 404**：确认站点可访问 `/yuque-assets/*`，并包含 `doc.umd.js`、`kitchen.js` 等核心脚本。
- **`window.Doc` 未定义**：通常是 `doc.umd.js` 未加载成功，或资源加载顺序被外部脚本打断。
- **受控模式循环更新**：组件内部通过 `lastSetContent` 字符串比对自动抑制多余的 `onChange` 派发，正常使用即可。如仍有问题，检查 `onChange` 回调中是否直接回写了相同值。
- **切换 `scheme` 后内容异常**：切换格式会重建编辑器实例，确保上层同时更新了对应格式的 `value`。
- **上传失败**：检查 `uploadImage` / `uploadVideo` 返回值是否包含 `url` 和 `size` 字段。
- **多实例样式冲突**：资源加载器内置去重机制，同名资源只加载一次。
- **实例重建抖动**：React/Vue 组件使用 `shallowEqual` 浅比较配置项，只有真正变化时才重建实例。如果函数引用频繁变化，考虑用 `useCallback` / `computed` 稳定化。

### 本地开发与发布

```bash
# 构建
pnpm run build

# 验证发布产物
npm pack --dry-run
```

构建后会产出：

- `dist/*.cjs` — CommonJS 格式
- `dist/*.mjs` — ES Module 格式
- `dist/*.d.ts` — TypeScript 类型声明
- `dist/yuque-assets/*` — 离线静态资源目录

### 技术实现要点

**资源加载策略** — `ensureAssets` 采用分层并行加载，减少 RTT 等待：
1. 第一层：CSS 全部并行
2. 第二层：React 依赖链 + 无依赖脚本并行
3. 第三层：有严格顺序依赖的脚本串行（kitchen → docUmd）

**实例稳定性** — React/Vue 组件对配置项逐项浅比较（`shallowEqual`），只在配置语义真正变化时才重建编辑器实例，避免因函数引用不稳定导致的不必要重建。

**DOM 隔离** — 编辑器创建独立的 `editorRoot` 容器挂载到宿主 `container` 内，`destroy()` 时只移除 `editorRoot`，不会清空宿主容器的其他子节点。

**错误兜底** — `safeCall` 统一捕获编辑器内部回调中的异常（如销毁时的 TypeError），避免冒泡到宿主应用。可通过 `YUQUE_EDITOR_DEBUG=1` 查看被兜底的错误详情。

## License

[MIT](./LICENSE)
