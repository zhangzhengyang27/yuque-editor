// @vitest-environment happy-dom
import { describe, expect, it } from "vitest"
import { ensureReadableSelectionStyle, ensureTocAvoidanceStyle } from "../src/lake-dom"

describe("ensureTocAvoidanceStyle", () => {
  it("向 document.head 注入避让样式", () => {
    ensureTocAvoidanceStyle()
    const style = document.querySelector("style[data-yuque-toc-avoidance]")
    expect(style).not.toBeNull()
    expect(style?.textContent).toContain(
      ".ne-editor.ne-normal-toc:not(.ne-ui-sidebar-visible) .ne-engine > *",
    )
    expect(style?.textContent).toContain("margin-right: 280px")
  })

  it("重复调用只注入一次（多实例安全）", () => {
    ensureTocAvoidanceStyle()
    ensureTocAvoidanceStyle()
    const styles = document.querySelectorAll("style[data-yuque-toc-avoidance]")
    expect(styles).toHaveLength(1)
  })
})

describe("ensureReadableSelectionStyle", () => {
  it("向 document.head 注入选区可读性样式", () => {
    ensureReadableSelectionStyle()
    const style = document.querySelector("style[data-yuque-selection]")
    expect(style).not.toBeNull()
    expect(style?.textContent).toContain(".ne-engine ::selection")
    expect(style?.textContent).toContain("#262626")
  })

  it("重复调用只注入一次（多实例安全）", () => {
    ensureReadableSelectionStyle()
    ensureReadableSelectionStyle()
    const styles = document.querySelectorAll("style[data-yuque-selection]")
    expect(styles).toHaveLength(1)
  })
})
