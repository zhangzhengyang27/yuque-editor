// ESLint flat config（ESLint 9+）。
// 分工：Prettier 管格式，ESLint 只管代码质量与框架规则；
// 最后一条 eslint-config-prettier 关闭所有格式类规则，避免两者打架。
import js from "@eslint/js"
import tseslint from "typescript-eslint"
import pluginVue from "eslint-plugin-vue"
import reactHooks from "eslint-plugin-react-hooks"
import eslintConfigPrettier from "eslint-config-prettier"
import globals from "globals"

export default tseslint.config(
  // === 忽略：构建产物、第三方离线资源（体积大且非我们维护） ===
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "packages/core/assets/**",
      "**/*.tsbuildinfo",
      "pnpm-lock.yaml",
    ],
  },

  // === 基础规则（JS + TS + .vue 脚本块全部生效） ===
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs["flat/recommended"],

  // .vue 单文件组件：脚本内容交给 TypeScript 解析器
  {
    files: ["**/*.vue"],
    languageOptions: {
      parserOptions: { parser: tseslint.parser, sourceType: "module" },
    },
  },

  // TS 文件里关闭 no-undef：类型层面由 tsc 负责（CI 已跑类型检查），
  // 该规则不理解 TS 的类型/宏，只会产生误报
  {
    files: ["**/*.{ts,tsx,vue}"],
    rules: { "no-undef": "off" },
  },

  // CommonJS 构建脚本：require 是刻意的
  {
    files: ["**/*.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },

  // === 全局规则调整 ===
  {
    rules: {
      // App.vue 是单文件组件的约定命名，不强行多词
      "vue/multi-word-component-names": "off",
      // 可选 prop 不强制显式默认值（| null / undefined 语义已足够清晰）
      "vue/require-default-prop": "off",
      // 函数参数少用无意义的预赋值
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },

  // === 浏览器环境：编辑器源码与两个示例 ===
  {
    files: [
      "packages/core/src/**",
      "packages/core/test/**",
      "packages/react/src/**",
      "packages/vue/src/**",
    ],
    languageOptions: {
      globals: { ...globals.browser, ...globals.es2020 },
    },
  },

  // === Node 环境：脚本与配置文件 ===
  {
    files: [
      "packages/core/src/vite-assets.ts",
      "packages/core/scripts/**",
      "scripts/**",
      "*.config.*",
      "eslint.config.mjs",
    ],
    languageOptions: {
      globals: { ...globals.node, ...globals.es2020 },
    },
  },

  // === React Hooks：core 的 react.tsx 封装与 React 示例 ===
  {
    files: ["packages/core/src/react.tsx", "packages/react/src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },

  // === Prettier 兼容层：关闭一切格式类规则，必须放最后 ===
  eslintConfigPrettier,
)
