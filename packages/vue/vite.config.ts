import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"
import { resolve } from "path"
import { yuqueAssets } from "yuque-editor-core/vite-assets"

const rootDir = import.meta.dirname

export default defineConfig({
  plugins: [
    vue(),
    yuqueAssets({
      // 在 monorepo 中显式指定 core 的资源目录
      assetsDir: resolve(rootDir, "../core/assets/yuque-assets"),
    }),
  ],
  resolve: {
    alias: {
      "@": resolve(rootDir, "src"),
    },
  },
})
