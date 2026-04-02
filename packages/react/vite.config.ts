import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { yuqueAssets } from 'yuque-editor-core/vite-assets'

const rootDir = import.meta.dirname

export default defineConfig({
  plugins: [
    react(),
    yuqueAssets({
      // 在 monorepo 中显式指定 core 的资源目录
      assetsDir: resolve(rootDir, '../core/assets/yuque-assets'),
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(rootDir, 'src'),
    },
  },
})
