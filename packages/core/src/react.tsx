import React, { forwardRef, useEffect, useImperativeHandle, useRef } from "react"
import type { YuqueEditorOptions, YuqueEditorRef, YuqueDocScheme } from "./editor"
import { createYuqueEditor, normalizeError, shallowEqual } from "./editor"
import { ValueSyncer, INIT_SYNC_RETRY_DELAYS, DEFAULT_SYNC_RETRY_DELAYS } from "./controlled"

export interface YuqueRichTextProps extends Omit<
  YuqueEditorOptions,
  "container" | "onChange" | "onLoad" | "onError" | "value"
> {
  value: string
  onChange?: (value: string) => void
  onLoad?: () => void
  onError?: (error: Error) => void
  onFocus?: () => void
  onBlur?: () => void
  onSelectionChange?: () => void
  onFocusStatusChange?: (focused: boolean) => void
  onBeforeDestroy?: () => void
  /**
   * 强制重建编辑器的逃生舱。
   * `shallowEqual` 对函数一律返回 `true`（避免父组件每次渲染的新函数引用导致重建），
   * 因此 `uploadImage` / `uploadVideo` 换了实现也不会触发重建。需要时改变此值即可。
   */
  instanceKey?: string | number
}

/** 从 props 中提取影响编辑器实例重建的配置项 */
function extractConfig(props: YuqueRichTextProps) {
  return {
    scheme: props.scheme,
    readOnly: props.readOnly,
    assets: props.assets,
    uploadImage: props.uploadImage,
    uploadVideo: props.uploadVideo,
    showToolbar: props.showToolbar,
    showToc: props.showToc,
    paragraphSpacing: props.paragraphSpacing,
    defaultFontSize: props.defaultFontSize,
    darkMode: props.darkMode,
    disabledToolbarItems: props.disabledToolbarItems,
    toolbarItems: props.toolbarItems,
    instanceKey: props.instanceKey
  }
}

function hasRenderedContent(container: HTMLDivElement | null, value: string) {
  if (!container) return false
  if (!value.trim()) return true
  const engine = container.querySelector(".ne-engine")
  const text = engine?.textContent?.trim() ?? ""
  return text.length > 0
}

function applyEditorLayout(container: HTMLDivElement | null) {
  if (!container) return

  const setStyle = (element: Element | null, styles: Partial<CSSStyleDeclaration>) => {
    if (!(element instanceof HTMLElement)) return
    Object.assign(element.style, styles)
  }

  setStyle(container, {
    display: "flex",
    flex: "1 1 auto",
    flexDirection: "column",
    minHeight: "100%",
    height: "100%"
  })

  const wrapper = container.firstElementChild
  setStyle(wrapper, {
    display: "flex",
    flex: "1 1 auto",
    flexDirection: "column",
    minHeight: "100%",
    height: "100%"
  })

  const editor = container.querySelector(".ne-editor")
  setStyle(editor, {
    display: "flex",
    flex: "1 1 auto",
    flexDirection: "column",
    minHeight: "100%",
    height: "100%"
  })

  const adapt = container.querySelector(".ne-layout-mode-adapt")
  setStyle(adapt, {
    display: "flex",
    flex: "1 1 auto",
    flexDirection: "column",
    minHeight: "100%",
    height: "100%"
  })

  setStyle(container.querySelector(".ne-ui"), {
    display: "flex",
    flex: "0 0 auto",
    flexDirection: "column"
  })

  setStyle(container.querySelector(".ne-editor-body"), {
    display: "flex",
    flex: "1 1 auto",
    flexDirection: "column",
    minHeight: "0",
    height: "100%"
  })

  setStyle(container.querySelector(".ne-editor-wrap"), {
    display: "flex",
    flex: "1 1 auto",
    flexDirection: "column",
    minHeight: "0",
    height: "100%"
  })

  setStyle(container.querySelector(".ne-editor-wrap-content"), {
    display: "flex",
    flex: "1 1 auto",
    flexDirection: "column",
    minHeight: "0",
    height: "100%"
  })

  setStyle(container.querySelector(".ne-editor-outer-wrap-box"), {
    display: "flex",
    flex: "1 1 auto",
    flexDirection: "column",
    minHeight: "0",
    height: "100%"
  })

  ;[".ne-editor-wrap-box", ".ne-editor-box", ".ne-engine-box"].forEach((selector) => {
    setStyle(container.querySelector(selector), {
      display: "flex",
      flex: "1 1 auto",
      flexDirection: "column",
      minHeight: "0",
      height: "100%"
    })
  })

  ;[".ne-engine", ".ne-view"].forEach((selector) => {
    setStyle(container.querySelector(selector), {
      flex: "1 1 auto",
      minHeight: "100%",
      height: "100%"
    })
  })
}

export const YuqueRichText = forwardRef<YuqueEditorRef, YuqueRichTextProps>(
  function YuqueRichText(
    props: YuqueRichTextProps,
    ref: React.ForwardedRef<YuqueEditorRef>
  ) {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const editorRef = useRef<YuqueEditorRef | null>(null)
    /** 受控值同步器，与当前编辑器实例一一对应，随实例一起销毁重建 */
    const syncerRef = useRef<ValueSyncer | null>(null)
    const propsRef = useRef(props)
    propsRef.current = props

    // 稳定化配置引用：只在配置语义变化时才触发重建
    const configRef = useRef(extractConfig(props))

    useImperativeHandle(ref, () => {
      const checkReady = () => {
        if (!editorRef.current) {
          throw new Error("YuqueRichText：编辑器尚未初始化完成")
        }
        return editorRef.current
      }
      return {
        appendContent: (html: string, breakLine?: boolean) => checkReady().appendContent(html, breakLine),
        setContent: (content: string, type?: YuqueDocScheme) => checkReady().setContent(content, type),
        getContent: (type?: YuqueDocScheme) => checkReady().getContent(type),
        isEmpty: () => checkReady().isEmpty(),
        getSummaryContent: () => checkReady().getSummaryContent(),
        wordCount: () => checkReady().wordCount(),
        focusToStart: (offset?: number) => checkReady().focusToStart(offset),
        insertBreakLine: () => checkReady().insertBreakLine(),
        destroy: () => checkReady().destroy(),
        undo: () => checkReady().undo(),
        redo: () => checkReady().redo(),
        insertText: (text: string) => checkReady().insertText(text),
        setBold: (value?: boolean) => checkReady().setBold(value),
        setItalic: (value?: boolean) => checkReady().setItalic(value),
        setUnderline: (value?: boolean) => checkReady().setUnderline(value),
        setStrikethrough: (value?: boolean) => checkReady().setStrikethrough(value),
        setColor: (color: string) => checkReady().setColor(color),
        setBgColor: (color: string) => checkReady().setBgColor(color),
        clearColor: () => checkReady().clearColor(),
        clearBgColor: () => checkReady().clearBgColor(),
        setAlignment: (value) => checkReady().setAlignment(value),
        setParagraphStyle: (style) => checkReady().setParagraphStyle(style),
        setFontsize: (size: number) => checkReady().setFontsize(size),
        indent: () => checkReady().indent(),
        outdent: () => checkReady().outdent(),
        clearFormat: () => checkReady().clearFormat(),
        selectAll: () => checkReady().selectAll(),
        getWordCount: () => checkReady().getWordCount()
      } satisfies YuqueEditorRef
      // 内部只通过 editorRef.current 延迟取值，不含任何需要更新的闭包变量
    }, [])

    useEffect(() => {
      const nextConfig = extractConfig(props)

      // 逐项浅比较，只在配置真正变化时才重建实例
      const keys = Object.keys(configRef.current) as (keyof typeof nextConfig)[]
      const changed = keys.some(
        (k) => !shallowEqual(configRef.current[k], nextConfig[k])
      )
      if (!changed && editorRef.current) return

      configRef.current = nextConfig

      // 使用标记对象代替版本号，避免 StrictMode 下快异步竞态问题
      const active = { current: true }

      const el = containerRef.current
      if (!el) return

      void (async () => {
        // onChange 回调可能在 createYuqueEditor 内部（初始灌值阶段）就同步触发，
        // 此时同步器尚未创建；为避免把回声误报给上层，先标记初始化灌值
        let syncer: ValueSyncer | null = null
        try {
          // 拦截 onLoad：不在 createYuqueEditor 内部调用，等 api 返回后再调用
          // 因为 createYuqueEditor 在 onLoad 回调时还未返回 api 对象
          let pendingOnLoad = false

          const api = await createYuqueEditor({
            ...nextConfig,
            container: el,
            value: props.value,
            onLoad: () => {
              if (!active.current) return
              pendingOnLoad = true
            },
            onError: (error) => {
              if (!active.current) return
              propsRef.current.onError?.(error)
            },
            onChange: (v) => {
              if (!active.current) return
              if (syncer && !syncer.shouldEmit(v)) return
              propsRef.current.onChange?.(v)
            },
            onFocus: () => {
              if (!active.current) return
              propsRef.current.onFocus?.()
            },
            onBlur: () => {
              if (!active.current) return
              propsRef.current.onBlur?.()
            },
            onSelectionChange: () => {
              if (!active.current) return
              propsRef.current.onSelectionChange?.()
            },
            onFocusStatusChange: (focused) => {
              if (!active.current) return
              propsRef.current.onFocusStatusChange?.(focused)
            },
            onBeforeDestroy: () => {
              propsRef.current.onBeforeDestroy?.()
            }
          })

          if (!active.current) {
            api.destroy()
            return
          }
          // 先赋值 ref，再触发 onLoad，确保用户在 onLoad 里可以访问 ref
          editorRef.current = api

          // 创建与当前实例绑定的同步器，回收时随实例一起销毁
          syncer = new ValueSyncer(
            {
              getContent: (scheme) => api.getContent(scheme),
              setContent: (content, scheme) => api.setContent(content, scheme),
              isRendered: (content) => hasRenderedContent(el, content),
              beforeSync: () => applyEditorLayout(el)
            },
            props.value ?? "",
            (props.scheme ?? "text/html") as YuqueDocScheme,
            INIT_SYNC_RETRY_DELAYS
          )
          syncerRef.current = syncer

          // 初始化后强制校验一次：编辑器可能「数据已更新但 DOM 未重绘」，
          // 必须显式修正布局并把最新 value 补齐（修复初始化完成前 value 变化被丢弃的问题）
          const target = propsRef.current.value ?? ""
          if (!syncer.sync(target, true)) {
            syncer.syncWithRetry(target)
          }

          if (pendingOnLoad) {
            propsRef.current.onLoad?.()
          }
        } catch (error) {
          if (!active.current) return
          propsRef.current.onError?.(normalizeError(error))
        }
      })()

      return () => {
        active.current = false
        // 同步器随实例销毁，取消全部未执行的重试
        syncerRef.current?.dispose()
        syncerRef.current = null
        editorRef.current?.destroy()
        editorRef.current = null
      }
    // 依赖 extractConfig 提取的配置项，避免每次渲染都重建编辑器
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.scheme, props.readOnly, props.assets, props.uploadImage, props.uploadVideo, props.showToolbar, props.showToc, props.paragraphSpacing, props.defaultFontSize, props.darkMode, props.disabledToolbarItems, props.toolbarItems, props.instanceKey])

    // 外部 value / scheme 变化 → 同步到编辑器
    useEffect(() => {
      const syncer = syncerRef.current
      if (!syncer) return
      syncer.setScheme((props.scheme ?? "text/html") as YuqueDocScheme)
      syncer.syncWithRetry(props.value ?? "")
      // 新一轮 value 到来时取消上一轮未完成的重试
      return () => syncer.cancelRetry()
    }, [props.value, props.scheme])

    return <div ref={containerRef} style={{ display: "flex", flex: "1 1 auto", minHeight: "100%", height: "100%" }} />
  }
)

export default YuqueRichText
