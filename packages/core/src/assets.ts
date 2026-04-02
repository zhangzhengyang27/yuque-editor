import type { YuqueEditorAssets } from "./editor"

export const LOCAL_ASSET_FILES = {
  docCss: "doc.css",
  antdCss: "antd.css",
  react: "react.production.min.js",
  reactDom: "react-dom.production.min.js",
  codeMirror: "CodeMirror.js",
  kitchenScript: "kitchen.js",
  docUmd: "doc.umd.js",
  katex: "katex.js"
} as const

export type LocalAssetKey = keyof typeof LOCAL_ASSET_FILES
export type LocalAssetFileName = (typeof LOCAL_ASSET_FILES)[LocalAssetKey]

export function localAssets(baseUrl = "/yuque-assets"): YuqueEditorAssets {
  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl
  return {
    docCss: `${base}/${LOCAL_ASSET_FILES.docCss}`,
    antdCss: `${base}/${LOCAL_ASSET_FILES.antdCss}`,
    react: `${base}/${LOCAL_ASSET_FILES.react}`,
    reactDom: `${base}/${LOCAL_ASSET_FILES.reactDom}`,
    codeMirror: `${base}/${LOCAL_ASSET_FILES.codeMirror}`,
    kitchenScript: `${base}/${LOCAL_ASSET_FILES.kitchenScript}`,
    docUmd: `${base}/${LOCAL_ASSET_FILES.docUmd}`,
    katex: `${base}/${LOCAL_ASSET_FILES.katex}`
  }
}

export function resolveLocalAssets(
  resolve: (file: LocalAssetFileName, key: LocalAssetKey) => string
): YuqueEditorAssets {
  return {
    docCss: resolve(LOCAL_ASSET_FILES.docCss, "docCss"),
    antdCss: resolve(LOCAL_ASSET_FILES.antdCss, "antdCss"),
    react: resolve(LOCAL_ASSET_FILES.react, "react"),
    reactDom: resolve(LOCAL_ASSET_FILES.reactDom, "reactDom"),
    codeMirror: resolve(LOCAL_ASSET_FILES.codeMirror, "codeMirror"),
    kitchenScript: resolve(LOCAL_ASSET_FILES.kitchenScript, "kitchenScript"),
    docUmd: resolve(LOCAL_ASSET_FILES.docUmd, "docUmd"),
    katex: resolve(LOCAL_ASSET_FILES.katex, "katex")
  }
}
