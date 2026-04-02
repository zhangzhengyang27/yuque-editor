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

# 启动 React 示例
pnpm run dev:react

# 启动 Vue 示例
pnpm run dev:vue
```

## 包说明

### packages/core — yuque-editor-core

语雀（Lake）编辑器核心封装，支持离线资源，输出 CJS + ESM + 类型声明。

详见 [packages/core/README.md](./packages/core/README.md)。

### packages/react

React 18 + TypeScript + Vite 示例，演示：

- 初始化编辑器并加载内容
- 获取摘要（JSON）
- 清空内容
- 获取字数统计
- 查看原始 HTML

### packages/vue

Vue 3 + TypeScript + Vite 示例，功能同 React 版本。

## 环境要求

- Node.js >= 18
- pnpm >= 9

## License

MIT
