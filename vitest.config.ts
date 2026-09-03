import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.ts"],
    // 默认 node 环境；需要 DOM 的测试文件用文件级注释切换：
    // @vitest-environment happy-dom
    environment: "node",
  },
})
