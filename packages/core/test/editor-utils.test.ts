// @vitest-environment happy-dom
import { describe, expect, it } from "vitest"
import { DEFAULT_TOOLBAR_ITEMS, buildToolbarConfig, stripHtml, stripMarkdown } from "../src/editor"

/** 断言 items 没有首/尾/相邻的冗余分隔符 */
function expectNoRedundantSeparators(items: string[]) {
  expect(items[0]).not.toBe("|")
  expect(items[items.length - 1]).not.toBe("|")
  for (let i = 1; i < items.length; i++) {
    if (items[i] === "|") {
      expect(items[i - 1], `items[${i - 1}] 与 items[${i}] 不应连续分隔符`).not.toBe("|")
    }
  }
}

describe("buildToolbarConfig", () => {
  it("toolbarItems 白名单优先且原样传递", () => {
    expect(buildToolbarConfig(["bold", "|", "italic"])).toEqual({
      agentConfig: { default: { items: ["bold", "|", "italic"] } },
    })
  })

  it("disabledToolbarItems 从默认列表剔除", () => {
    const config = buildToolbarConfig(undefined, ["undo", "redo"])
    const items = config?.agentConfig?.default?.items as string[]
    expect(items).not.toContain("undo")
    expect(items).not.toContain("redo")
    expect(items).toContain("bold")
  })

  it("剔除整组项后，相邻分隔符被折叠、首部分隔符被去掉", () => {
    // cardSelect 是首项，undo/redo/formatPainter/clearFormat 位于前两个分隔符之间，
    // 全部剔除后原始列表形如 ["|", "|", "style", ...]，需要折叠
    const config = buildToolbarConfig(undefined, [
      "cardSelect",
      "undo",
      "redo",
      "formatPainter",
      "clearFormat",
    ])
    const items = config?.agentConfig?.default?.items as string[]
    expect(items[0]).toBe("style")
    expectNoRedundantSeparators(items)
    expect(items).toContain("bold")
  })

  it("同时传入时以 toolbarItems 为准", () => {
    expect(buildToolbarConfig(["bold"], ["bold"])).toEqual({
      agentConfig: { default: { items: ["bold"] } },
    })
  })

  it("两者都未传时不做配置", () => {
    expect(buildToolbarConfig(undefined, undefined)).toBeUndefined()
  })

  it("禁用全部默认项后 items 为空数组", () => {
    const config = buildToolbarConfig(
      undefined,
      DEFAULT_TOOLBAR_ITEMS.filter((item) => item !== "|"),
    )
    expect(config?.agentConfig?.default?.items).toEqual([])
  })
})

describe("stripHtml", () => {
  it("块级元素之间补空格，避免相邻块单词粘连", () => {
    expect(stripHtml("<p>foo</p><p>bar</p>")).toBe("foo bar")
  })

  it("br 视为空格", () => {
    expect(stripHtml("a<br>b")).toBe("a b")
  })

  it("script/style 的内容不计入正文", () => {
    const text = stripHtml(
      "<p>visible</p><script>var evil = 1;</script><style>.hide { color: red }</style>",
    )
    expect(text).toBe("visible")
    expect(text).not.toContain("evil")
    expect(text).not.toContain("hide")
  })

  it("多余空白被折叠", () => {
    expect(stripHtml("<p>a   b</p>\n<p>c\n d</p>")).toBe("a b c d")
  })
})

describe("stripMarkdown", () => {
  it("剔除代码块 / 行内代码 / 链接 / 标记符号", () => {
    const md = [
      "# Title",
      "",
      "**bold** and `code`",
      "",
      "```js",
      "var x = 1;",
      "```",
      "[link](https://example.com)",
    ].join("\n")
    const text = stripMarkdown(md)

    expect(text).toBe("Title bold and")
    expect(text).not.toContain("var x")
    expect(text).not.toContain("link")
    expect(text).not.toContain("#")
  })

  it("引用与列表标记被剔除", () => {
    expect(stripMarkdown("> quoted\n- item1\n1. item2")).toBe("quoted item1 item2")
  })
})
