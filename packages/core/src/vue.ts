import { defineComponent, h, onBeforeUnmount, onMounted, ref, watch } from "vue"
import type { PropType } from "vue"
import { createYuqueEditor, normalizeError, shallowEqual } from "./editor"
import type { YuqueEditorOptions, YuqueEditorRef, YuqueDocScheme } from "./editor"
import { ValueSyncer, INIT_SYNC_RETRY_DELAYS } from "./controlled"
import { applyEditorLayout, hasRenderedContent } from "./lake-dom"

export const YuqueRichText = defineComponent({
  name: "YuqueRichText",
  props: {
    value: {
      type: String,
      required: true,
    },
    scheme: {
      type: String as PropType<YuqueDocScheme>,
      required: false,
      default: "text/html",
    },
    readOnly: {
      type: Boolean,
      required: false,
      default: false,
    },
    assets: {
      type: Object as PropType<YuqueEditorOptions["assets"]>,
      required: false,
    },
    uploadImage: {
      type: Function as PropType<YuqueEditorOptions["uploadImage"]>,
      required: false,
    },
    uploadVideo: {
      type: Function as PropType<YuqueEditorOptions["uploadVideo"]>,
      required: false,
    },
    showToolbar: {
      type: Boolean,
      required: false,
      default: true,
    },
    showToc: {
      type: Boolean,
      required: false,
    },
    paragraphSpacing: {
      type: Boolean,
      required: false,
    },
    defaultFontSize: {
      type: Number,
      required: false,
    },
    darkMode: {
      type: Boolean,
      required: false,
    },
    disabledToolbarItems: {
      type: Array as PropType<string[]>,
      required: false,
    },
    toolbarItems: {
      type: Array as PropType<string[]>,
      required: false,
    },
    /**
     * 强制重建编辑器的逃生舱：函数型配置（uploadImage 等）引用变化不会触发重建，
     * 需要主动重建时改变此值即可。
     */
    instanceKey: {
      type: [String, Number] as PropType<string | number>,
      required: false,
    },
  },
  emits: [
    "change",
    "load",
    "error",
    "focus",
    "blur",
    "selectionchange",
    "focusstatuschange",
    "beforedestroy",
  ],
  setup(props, { emit, expose }) {
    const container = ref<HTMLElement | null>(null)
    let api: YuqueEditorRef | null = null
    /** 受控值同步器，与当前编辑器实例一一对应 */
    let syncer: ValueSyncer | null = null
    let destroyed = false
    let initSeq = 0

    // 缓存上一轮配置，用于浅比较判断是否真正变化
    let lastConfig = {
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
      instanceKey: props.instanceKey,
    }

    const configKeys = Object.keys(lastConfig) as (keyof typeof lastConfig)[]

    const init = async () => {
      if (!container.value) return
      const seq = ++initSeq

      api?.destroy()
      api = null
      syncer?.dispose()
      syncer = null

      try {
        // onChange 可能在 createYuqueEditor 内部（初始灌值阶段）就同步触发，
        // 此时同步器尚未创建。这一窗口内的 contentchange 一定是初始灌值的回声
        //（唯一变更源是我们自己的 setDocument），直接丢弃；
        // 同步器创建后的异步回声由 editor.ts 的 lastSetContent 机制吞掉。
        let localSyncer: ValueSyncer | null = null
        // 拦截 onLoad：等 api 赋值、同步器就绪后再触发，保证宿主在 @load 里
        // 可以立即使用 expose 出来的方法（与 React 封装行为一致）
        let pendingOnLoad = false

        const nextApi = await createYuqueEditor({
          container: container.value,
          value: props.value,
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
          onLoad: () => {
            pendingOnLoad = true
          },
          onError: (error) => emit("error", error),
          onChange: (v) => {
            if (destroyed || seq !== initSeq) return
            if (!localSyncer) return
            if (!localSyncer.shouldEmit(v)) return
            emit("change", v)
          },
          onFocus: () => emit("focus"),
          onBlur: () => emit("blur"),
          onSelectionChange: () => emit("selectionchange"),
          onFocusStatusChange: (focused) => emit("focusstatuschange", focused),
          onBeforeDestroy: () => emit("beforedestroy"),
        })

        if (destroyed || seq !== initSeq) {
          nextApi.destroy()
          return
        }

        api = nextApi
        // 初始化值以最新 props.value 为准（修复初始化完成前 value 变化被丢弃的问题）
        localSyncer = new ValueSyncer(
          {
            getContent: (scheme) => nextApi.getContent(scheme),
            setContent: (content, scheme) => nextApi.setContent(content, scheme),
            isRendered: (content) => hasRenderedContent(container.value, content),
            beforeSync: () => applyEditorLayout(container.value),
          },
          props.value,
          props.scheme,
          INIT_SYNC_RETRY_DELAYS,
        )
        syncer = localSyncer

        // 初始化后强制校验一次，补齐初始化期间可能发生的值变化
        if (!localSyncer.sync(props.value, true)) {
          localSyncer.syncWithRetry(props.value)
        }

        if (pendingOnLoad) {
          emit("load")
        }
      } catch (error) {
        if (destroyed || seq !== initSeq) return
        emit("error", normalizeError(error))
      }
    }

    onMounted(() => {
      void init()
    })

    onBeforeUnmount(() => {
      destroyed = true
      initSeq++
      syncer?.dispose()
      syncer = null
      api?.destroy()
      api = null
    })

    watch(
      () =>
        [
          props.scheme,
          props.readOnly,
          props.assets,
          props.uploadImage,
          props.uploadVideo,
          props.showToolbar,
          props.showToc,
          props.paragraphSpacing,
          props.defaultFontSize,
          props.darkMode,
          props.disabledToolbarItems,
          props.toolbarItems,
          props.instanceKey,
        ] as const,
      async () => {
        if (!container.value) return

        const nextConfig = {
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
          instanceKey: props.instanceKey,
        }
        const changed = configKeys.some((k) => !shallowEqual(lastConfig[k], nextConfig[k]))
        if (!changed && api) return

        lastConfig = nextConfig
        await init()
      },
      { flush: "post" },
    )

    // 外部 value 变化 → 同步到编辑器（回声由 ValueSyncer 过滤）
    watch(
      () => props.value,
      (nextValue) => {
        if (!syncer) return
        syncer.setScheme(props.scheme)
        syncer.syncWithRetry(nextValue)
      },
      { flush: "post" },
    )

    expose({
      appendContent(html: string, breakLine?: boolean) {
        api?.appendContent(html, breakLine)
      },
      setContent(content: string, type?: YuqueDocScheme) {
        api?.setContent(content, type)
      },
      getContent(type?: YuqueDocScheme) {
        return api?.getContent(type) ?? ""
      },
      isEmpty() {
        return api?.isEmpty() ?? true
      },
      getSummaryContent() {
        return api?.getSummaryContent() ?? ""
      },
      wordCount() {
        return api?.wordCount() ?? 0
      },
      focusToStart(offset?: number) {
        api?.focusToStart(offset)
      },
      insertBreakLine() {
        api?.insertBreakLine()
      },
      destroy() {
        syncer?.dispose()
        syncer = null
        api?.destroy()
        api = null
      },
      undo() {
        api?.undo()
      },
      redo() {
        api?.redo()
      },
      insertText(text: string) {
        api?.insertText(text)
      },
      setBold(value?: boolean) {
        api?.setBold(value)
      },
      setItalic(value?: boolean) {
        api?.setItalic(value)
      },
      setUnderline(value?: boolean) {
        api?.setUnderline(value)
      },
      setStrikethrough(value?: boolean) {
        api?.setStrikethrough(value)
      },
      setColor(color: string) {
        api?.setColor(color)
      },
      setBgColor(color: string) {
        api?.setBgColor(color)
      },
      clearColor() {
        api?.clearColor()
      },
      clearBgColor() {
        api?.clearBgColor()
      },
      setAlignment(value: "left" | "right" | "center" | "justify" | "distributed") {
        api?.setAlignment(value)
      },
      setParagraphStyle(style: "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6") {
        api?.setParagraphStyle(style)
      },
      setFontsize(size: number) {
        api?.setFontsize(size)
      },
      indent() {
        api?.indent()
      },
      outdent() {
        api?.outdent()
      },
      clearFormat() {
        api?.clearFormat()
      },
      selectAll() {
        api?.selectAll()
      },
      getWordCount() {
        return api?.getWordCount() ?? 0
      },
    })

    return () => h("div", { ref: container })
  },
})

export default YuqueRichText
