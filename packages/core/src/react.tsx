import React, { forwardRef, useEffect, useImperativeHandle, useRef } from "react"
import type { YuqueEditorOptions, YuqueEditorRef, YuqueDocScheme } from "./editor"
import { createYuqueEditor, normalizeError, shallowEqual } from "./editor"

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
    toolbarItems: props.toolbarItems
  }
}

export const YuqueRichText = forwardRef<YuqueEditorRef, YuqueRichTextProps>(
  function YuqueRichText(
    props: YuqueRichTextProps,
    ref: React.ForwardedRef<YuqueEditorRef>
  ) {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const editorRef = useRef<YuqueEditorRef | null>(null)
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
    })

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
        editorRef.current?.destroy()
        editorRef.current = null
      }
    // 依赖 extractConfig 提取的配置项，避免每次渲染都重建编辑器
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.scheme, props.readOnly, props.assets, props.uploadImage, props.uploadVideo, props.showToolbar, props.showToc, props.paragraphSpacing, props.defaultFontSize, props.darkMode, props.disabledToolbarItems, props.toolbarItems])

    useEffect(() => {
      const api = editorRef.current
      if (!api) return
      const next = props.value ?? ""
      const current = api.getContent(props.scheme as YuqueDocScheme)
      if (current !== next) {
        api.setContent(next, props.scheme as YuqueDocScheme)
      }
    }, [props.value, props.scheme])

    return <div ref={containerRef} />
  }
)

export default YuqueRichText
