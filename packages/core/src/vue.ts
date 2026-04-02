import { defineComponent, h, onBeforeUnmount, onMounted, ref, watch } from "vue"
import type { PropType } from "vue"
import { createYuqueEditor, normalizeError, shallowEqual } from "./editor"
import type { YuqueEditorOptions, YuqueEditorRef, YuqueDocScheme } from "./editor"

export const YuqueRichText = defineComponent({
  name: "YuqueRichText",
  props: {
    value: {
      type: String,
      required: true
    },
    scheme: {
      type: String as PropType<YuqueDocScheme>,
      required: false,
      default: "text/html"
    },
    readOnly: {
      type: Boolean,
      required: false,
      default: false
    },
    assets: {
      type: Object as PropType<YuqueEditorOptions["assets"]>,
      required: false
    },
    uploadImage: {
      type: Function as PropType<YuqueEditorOptions["uploadImage"]>,
      required: false
    },
    uploadVideo: {
      type: Function as PropType<YuqueEditorOptions["uploadVideo"]>,
      required: false
    },
    showToolbar: {
      type: Boolean,
      required: false,
      default: true
    },
    showToc: {
      type: Boolean,
      required: false
    },
    paragraphSpacing: {
      type: Boolean,
      required: false
    },
    defaultFontSize: {
      type: Number,
      required: false
    },
    darkMode: {
      type: Boolean,
      required: false
    }
  },
  emits: ["change", "load", "error"],
  setup(props, { emit, expose }) {
    const container = ref<HTMLElement | null>(null)
    let api: YuqueEditorRef | null = null
    let destroyed = false
    let initSeq = 0
    let lastApplied = { value: props.value, scheme: props.scheme }

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
      darkMode: props.darkMode
    }

    const configKeys = Object.keys(lastConfig) as (keyof typeof lastConfig)[]

    const init = async () => {
      if (!container.value) return
      const seq = ++initSeq
      const nextValue = props.value
      const nextScheme = props.scheme

      api?.destroy()
      api = null

      try {
        const nextApi = await createYuqueEditor({
          container: container.value,
          value: nextValue,
          scheme: nextScheme,
          readOnly: props.readOnly,
          assets: props.assets,
          uploadImage: props.uploadImage,
          uploadVideo: props.uploadVideo,
          showToolbar: props.showToolbar,
          showToc: props.showToc,
          paragraphSpacing: props.paragraphSpacing,
          defaultFontSize: props.defaultFontSize,
          darkMode: props.darkMode,
          onLoad: () => emit("load"),
          onError: (error) => emit("error", error),
          onChange: (v) => emit("change", v)
        })

        if (destroyed || seq !== initSeq) {
          nextApi.destroy()
          return
        }

        api = nextApi
        lastApplied = { value: nextValue, scheme: nextScheme }
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
      api?.destroy()
      api = null
    })

    watch(
      () => [
        props.scheme,
        props.readOnly,
        props.assets,
        props.uploadImage,
        props.uploadVideo,
        props.showToolbar,
        props.showToc,
        props.paragraphSpacing,
        props.defaultFontSize,
        props.darkMode
      ] as const,
      async () => {
        if (!container.value) return

        // 浅比较：只有配置真正变化时才重建实例
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
          darkMode: props.darkMode
        }
        const changed = configKeys.some(
          (k) => !shallowEqual(lastConfig[k], nextConfig[k])
        )
        if (!changed && api) return

        lastConfig = nextConfig
        await init()
      },
      { flush: "post" }
    )

    watch(
      () => props.value,
      (nextValue) => {
        if (!api) return
        const current = api.getContent(props.scheme)
        if (current !== nextValue) {
          api.setContent(nextValue, props.scheme)
        }
        lastApplied = { value: nextValue, scheme: props.scheme }
      },
      { flush: "post" }
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
        api?.destroy()
        api = null
      }
    })

    return () => h("div", { ref: container })
  }
})

export default YuqueRichText
