import { mkdir, mkdtemp, rm } from "fs/promises"
import { tmpdir } from "os"
import * as path from "path"
import { describe, expect, it } from "vitest"
import { findLocalAssetsDir } from "../src/vite-assets"

/** 造一个临时项目根，测试结束自动清理 */
async function withTempRoot<T>(fn: (root: string) => Promise<T>): Promise<T> {
  const root = await mkdtemp(path.join(tmpdir(), "yuque-assets-test-"))
  try {
    return await fn(root)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

describe("findLocalAssetsDir", () => {
  it("定位带 scope 发布名安装的资源目录", async () => {
    await withTempRoot(async (root) => {
      const assetsDir = path.resolve(
        root,
        "node_modules",
        "@zhangzhengyang27",
        "yuque-editor-core",
        "dist",
        "yuque-assets",
      )
      await mkdir(assetsDir, { recursive: true })

      await expect(findLocalAssetsDir(root)).resolves.toBe(assetsDir)
    })
  })

  it("定位 alias 短名安装的资源目录", async () => {
    await withTempRoot(async (root) => {
      const assetsDir = path.resolve(
        root,
        "node_modules",
        "yuque-editor-core",
        "dist",
        "yuque-assets",
      )
      await mkdir(assetsDir, { recursive: true })

      await expect(findLocalAssetsDir(root)).resolves.toBe(assetsDir)
    })
  })

  it("短名与发布名同时存在时优先短名", async () => {
    await withTempRoot(async (root) => {
      const shortDir = path.resolve(
        root,
        "node_modules",
        "yuque-editor-core",
        "dist",
        "yuque-assets",
      )
      const scopedDir = path.resolve(
        root,
        "node_modules",
        "@zhangzhengyang27",
        "yuque-editor-core",
        "dist",
        "yuque-assets",
      )
      await mkdir(shortDir, { recursive: true })
      await mkdir(scopedDir, { recursive: true })

      await expect(findLocalAssetsDir(root)).resolves.toBe(shortDir)
    })
  })

  it("YUQUE_ASSETS_DIR 优先级最高", async () => {
    await withTempRoot(async (root) => {
      const envDir = path.resolve(root, "custom-assets")
      const scopedDir = path.resolve(
        root,
        "node_modules",
        "@zhangzhengyang27",
        "yuque-editor-core",
        "dist",
        "yuque-assets",
      )
      await mkdir(envDir, { recursive: true })
      await mkdir(scopedDir, { recursive: true })

      const prev = process.env.YUQUE_ASSETS_DIR
      process.env.YUQUE_ASSETS_DIR = envDir
      try {
        await expect(findLocalAssetsDir(root)).resolves.toBe(envDir)
      } finally {
        if (prev === undefined) delete process.env.YUQUE_ASSETS_DIR
        else process.env.YUQUE_ASSETS_DIR = prev
      }
    })
  })

  it("只有 assets/yuque-assets 时也能定位（包自身开发场景）", async () => {
    await withTempRoot(async (root) => {
      const assetsDir = path.resolve(root, "assets", "yuque-assets")
      await mkdir(assetsDir, { recursive: true })

      await expect(findLocalAssetsDir(root)).resolves.toBe(assetsDir)
    })
  })
})
