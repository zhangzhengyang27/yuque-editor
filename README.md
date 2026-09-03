# yuque-editor

基于 [yuque-editor-core](./packages/core) 的语雀（Lake）编辑器 monorepo，包含 React 和 Vue 示例项目。

## 结构

```
yuque-editor/
├── packages/
│   ├── core/          # yuque-editor-core 编辑器核心包
│   ├── react/         # React 18 示例
│   └── vue/           # Vue 3 示例
├── pnpm-workspace.yaml
└── package.json
```

## 快速开始

```bash
# 安装依赖
pnpm install

# 构建 core 包
pnpm run build

# 运行单元测试
pnpm test

# 启动 React 示例
pnpm run dev:react

# 启动 Vue 示例
pnpm run dev:vue
```

推送 / PR 时 GitHub Actions 会自动执行：单测 → 构建 core → 双示例类型检查 → 产物子路径 Node 解析校验（`scripts/verify-dist.mjs`）。

## 包说明

### packages/core — yuque-editor-core

语雀（Lake）编辑器核心封装，支持离线资源，输出 CJS + ESM + 类型声明。

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

## 环境要求

- Node.js >= 18
- pnpm >= 9

## 发布

发布 `yuque-editor-core` 包前，需要先构建 TypeScript 产物：

```bash
# 1. 更新版本号（packages/core/package.json 中的 version 字段）
# 2. 构建
cd packages/core
pnpm run build

# 3. 确认 dist 产物
ls dist/

# 4. 登录 npm（需要先有账号）
npm login

# 5. 发布
npm publish --access public

# 6. 打 git tag
git tag v0.0.7
git push origin v0.0.7
```

> **注意**：每次发布前务必先执行 `pnpm run build`，确保 dist 目录包含最新的编译产物。

## License

MIT
