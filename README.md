# yuque-editor

基于 [`@zhangzhengyang27/yuque-editor-core`](./packages/core) 的语雀（Lake）编辑器 monorepo，包含核心包与 React / Vue 示例项目。

## 结构

```
yuque-editor/
├── packages/
│   ├── core/          # 核心包（发布名 @zhangzhengyang27/yuque-editor-core）
│   ├── react/         # React 18 示例
│   └── vue/           # Vue 3 示例
├── pnpm-workspace.yaml
└── package.json
```

## 快速开始（本地开发）

```bash
# 安装依赖
pnpm install

# 构建 core 包
pnpm run build

# 运行单元测试
pnpm test

# 代码检查 / 格式化
pnpm lint        # ESLint（flat config，见 eslint.config.mjs）
pnpm lint:fix
pnpm format      # Prettier（配置见 .prettierrc.json）
pnpm format:check

# 启动 React 示例
pnpm run dev:react

# 启动 Vue 示例
pnpm run dev:vue
```

> 格式由 Prettier 统一负责；ESLint 只管代码质量与框架规则（`eslint-config-prettier` 已关闭所有格式类规则）。`docs/` 教程与 `packages/core/assets/` 第三方离线资源不参与格式化。

推送 / PR 时 GitHub Actions 会自动执行：Lint → 格式检查 → 单测 → 构建 core → 双示例类型检查 → 产物子路径 Node 解析校验（`scripts/verify-dist.mjs`）。

## 包说明

### packages/core — `@zhangzhengyang27/yuque-editor-core`

语雀（Lake）编辑器核心封装，支持离线资源，输出 CJS + ESM + 类型声明。**三个包里只有它会被发布**，发布目标为 GitHub Packages 私有源。

详见 [packages/core/README.md](./packages/core/README.md)。

### packages/react

React 18 + TypeScript + Vite 示例，功能演示：

- 初始化编辑器并加载内容
- execCommand 全套操作（文字格式、颜色、对齐、字号、段落样式）
- undo / redo、焦点控制、全选
- 格式切换（html / markdown / plain / lake / json）
- 字数统计、摘要获取
- 实时事件日志

### packages/vue

Vue 3 + TypeScript + Vite 示例，功能同 React 版本，另含：

- 划词评论系统（高亮 + 气泡弹窗 + 侧边栏面板）
- 底部回复编辑器

## 使用指南（消费方项目接入）

### 1. 配置私有源

包发布在 GitHub Packages 私有源，**不发布到公共 npm**。缺少配置时安装会直接 404，所以先做两步配置。

用户级 `~/.npmrc`（含 token，不要提交进任何仓库）：

```ini
//npm.pkg.github.com/:_authToken=<classic PAT，勾选 read:packages>
```

项目级 `.npmrc`（放项目根，可提交，团队共享）：

```ini
@zhangzhengyang27:registry=https://npm.pkg.github.com
```

> PAT 在 [GitHub tokens 页面](https://github.com/settings/tokens/new?scopes=read:packages) 创建；只消费包勾 `read:packages` 即可，需要发布再加 `write:packages`。
> CI（GitHub Actions）里可省掉 PAT，用 `actions/setup-node` 的 `registry-url: https://npm.pkg.github.com` + `NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`。

### 2. 安装

```bash
# 装最新版
pnpm add @zhangzhengyang27/yuque-editor-core

# 锁定版本（推荐）
pnpm add @zhangzhengyang27/yuque-editor-core@0.2.0
```

如果想保留 `yuque-editor-core/xxx` 这种短 import 路径，用 npm alias 映射：

```jsonc
// package.json
"yuque-editor-core": "npm:@zhangzhengyang27/yuque-editor-core@0.2.0"
```

### 3. 引入

包提供多个子路径入口，按需引入可避免把不用的框架代码打进来。下表的 `…/xxx` 均指 `@zhangzhengyang27/yuque-editor-core/xxx`：

| 子路径          | 内容                                  | 适用场景              |
| --------------- | ------------------------------------- | --------------------- |
| `…/editor`      | `createYuqueEditor()`、实例 API、类型 | 框架无关的原生接入    |
| `…/react`       | `YuqueRichText` 组件                  | React 18              |
| `…/vue`         | `YuqueRichText` 组件                  | Vue 3                 |
| `…/controlled`  | 受控值同步工具                        | 自定义受控封装        |
| `…/vite-assets` | `yuqueAssets()` Vite 插件             | Vite 项目提供离线资源 |
| `…/assets`      | 离线资源清单                          | 自定义资源加载        |

React：

```tsx
import { YuqueRichText } from "@zhangzhengyang27/yuque-editor-core/react"
import type { YuqueEditorRef } from "@zhangzhengyang27/yuque-editor-core/editor"

export default function App() {
  const [value, setValue] = React.useState("<p>Hello</p>")
  const editorRef = React.useRef<YuqueEditorRef>(null)

  return <YuqueRichText ref={editorRef} value={value} onChange={setValue} />
}
```

Vue 3：

```vue
<script setup lang="ts">
import { ref } from "vue"
import { YuqueRichText } from "@zhangzhengyang27/yuque-editor-core/vue"

const value = ref("<p>Hello</p>")

function onChange(next: string) {
  value.value = next
}
</script>

<template>
  <YuqueRichText :value="value" @change="onChange" />
</template>
```

原生 DOM：

```ts
import { createYuqueEditor } from "@zhangzhengyang27/yuque-editor-core/editor"

const ref = await createYuqueEditor({
  container: document.getElementById("app")!,
  value: "<p>Hello</p>",
})
```

> `YuqueRichText` 是**受控组件**：必须把 `onChange` / `@change` 收到的值回写到 `value`，否则内部的重试同步可能用旧值覆盖用户输入。细节见 [packages/core/README.md](./packages/core/README.md)。

`react` / `react-dom` / `vue` 都是**可选** peer dependency（React ≥ 18，Vue ≥ 3），项目里已经有就直接复用，不会重复打包。

### 4. 提供离线资源（必做）

编辑器依赖 8 个语雀离线资源文件，浏览器需要通过 `/yuque-assets/*` 访问到它们，否则编辑器会白屏并报 `未检测到 window.Doc`。

Vite 项目加插件即可，dev 与 build 都由插件接管，不用往源码 `public/` 拷文件：

```ts
import { yuqueAssets } from "@zhangzhengyang27/yuque-editor-core/vite-assets"

export default {
  plugins: [yuqueAssets()],
}
```

非 Vite（webpack / Next.js / 纯静态托管）手动拷到站点根目录：

```bash
cp -r node_modules/@zhangzhengyang27/yuque-editor-core/dist/yuque-assets public/yuque-assets
```

插件找不到资源目录时，可显式指定（`assetsDir` 优先级高于自动搜索，也可用环境变量 `YUQUE_ASSETS_DIR`）：

```ts
yuqueAssets({
  baseUrl: "/static/editor-assets",
  assetsDir: "./local-assets/yuque-assets",
})
```

### 5. 常见报错

| 现象                                               | 原因                                     | 处理                                                                         |
| -------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------- |
| `404` 找不到 `@zhangzhengyang27/yuque-editor-core` | 缺项目级 registry 映射，请求打到了公共源 | 项目根 `.npmrc` 加 `@zhangzhengyang27:registry=https://npm.pkg.github.com`   |
| `401 Unauthorized` / `ENEEDAUTH`                   | 缺 token 或 PAT 权限不足                 | `~/.npmrc` 补 `//npm.pkg.github.com/:_authToken=...`，PAT 勾 `read:packages` |
| `Missing local yuque assets dir`                   | 资源目录定位失败                         | 使用 `yuqueAssets()` 插件，或传 `assetsDir` / 设 `YUQUE_ASSETS_DIR`          |
| 编辑器白屏、`未检测到 window.Doc`                  | 离线资源没以 `/yuque-assets/*` 提供      | 见上文「提供离线资源」                                                       |

## 环境要求

- Node.js >= 18
- pnpm >= 9

## 发布指南（维护者）

只有 `packages/core` 会发布，目标是 GitHub Packages 私有源（`packages/core/package.json` 的 `publishConfig.registry` 已配置）。

包内含语雀专有编译产物（`dist/yuque-assets/doc.umd.js` 等），**不要加 `--access public`、不要发到公共 npm**。

### 一次性准备

1. 创建 classic PAT（勾选 `write:packages`、`read:packages`）。
2. 写入用户级 `~/.npmrc`：`//npm.pkg.github.com/:_authToken=<TOKEN>`，不要提交进仓库。
3. 确认 `packages/core/package.json` 的 `publishConfig.registry` 仍为 `https://npm.pkg.github.com`。

### 每次发布

```bash
# 1. 发布前守门（与 CI 一致；verify-dist 校验产物子路径在 Node 下可解析）
pnpm lint && pnpm format:check && pnpm test && pnpm build && node scripts/verify-dist.mjs

# 2. 升版本（patch / minor / major 按语义选择）
cd packages/core
npm version minor --no-git-tag-version   # 只改 version 字段，git 操作手动做（见下方坑 1）

# 3. 提交版本号并打 tag（tag 名与 npm version 保持一致）
cd ../..
git add packages/core/package.json
git commit -m "chore(release): core v0.2.1"
git tag v0.2.1

# 4. 发布（prepack 会自动执行 pnpm run build，无需手动构建）
cd packages/core
npm publish
cd ../..

# 5. 推送主干与 tag
git push origin main
git push origin v0.2.1
```

### 两个实测坑

- **`npm version` 不会自动提交和打 tag**：本仓库（npm 11 + pnpm workspace）下 `npm version minor` 只改 `package.json` 就退出，既不 commit 也不 tag，即使 `git-tag-version=true` 也一样。所以用 `--no-git-tag-version` 明确关掉 git 操作，第 3 步手动做。
- **`git push --follow-tags` 推不上 tag**：`git tag` 默认创建的是轻量 tag，而 `--follow-tags` 只推 annotated tag。必须显式 `git push origin v0.2.1`。

### 发布后核对

```bash
# 已上架版本列表
npm view @zhangzhengyang27/yuque-editor-core versions --registry=https://npm.pkg.github.com

# 本次产物清单与体积（离线预演，不联网发布）
cd packages/core && npm pack --dry-run
```

- 到 GitHub 包页面确认可见性为 **Private**（首次发布后包可见性可能继承公开仓库为 public，需在 Package settings → Change visibility 改）。
- 改动过 `packages/core/README.md` 或源码后，线上包内容要重新发一个版本才会更新。

## License

MIT
