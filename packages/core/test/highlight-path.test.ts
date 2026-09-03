// @vitest-environment happy-dom
import { describe, expect, it } from "vitest"
import { getNodeByPath, getNodePath } from "../../vue/src/comment/highlight-engine"

/**
 * 说明：highlight-engine.ts 目前位于 Vue 示例包中，这里直接跨包引用源码测试
 * 纯函数部分（childIndices 路径序列化）。
 */

function buildFixture(): { root: HTMLElement; p: Element; b: Element; text: Text } {
  const root = document.createElement("div")
  root.innerHTML = "<p>hello <b>world</b>!</p>"
  const p = root.querySelector("p")!
  const b = root.querySelector("b")!
  const text = b.firstChild as Text
  return { root, p, b, text }
}

describe("getNodePath / getNodeByPath", () => {
  it("从根到深 层节点往返序列化一致", () => {
    const { root, b, text } = buildFixture()

    const bPath = getNodePath(root, b)
    expect(bPath).toEqual([0, 1])
    expect(getNodeByPath(root, bPath!)).toBe(b)

    const textPath = getNodePath(root, text)
    expect(textPath).toEqual([0, 1, 0])
    expect(getNodeByPath(root, textPath!)).toBe(text)
  })

  it("根自身路径为空数组", () => {
    const { root } = buildFixture()
    expect(getNodePath(root, root)).toEqual([])
    expect(getNodeByPath(root, [])).toBe(root)
  })

  it("根外部的节点返回 null", () => {
    const { root } = buildFixture()
    document.body.appendChild(root)
    const outsider = document.createElement("span")
    document.body.appendChild(outsider)

    // outsider 的祖先链不经过 root
    expect(getNodePath(root, outsider)).toBeNull()
    // root 挂在 body 下，相对 body 的路径为 [0]
    expect(getNodePath(document.body, root)).toEqual([0])
  })

  it("无父节点的游离节点返回 null", () => {
    const orphan = document.createTextNode("orphan")
    const { root } = buildFixture()
    expect(getNodePath(root, orphan)).toBeNull()
  })

  it("按非法路径查找返回 null 而不是抛错", () => {
    const { root } = buildFixture()
    expect(getNodeByPath(root, [5])).toBeNull()
    expect(getNodeByPath(root, [0, 9, 9])).toBeNull()
  })
})
