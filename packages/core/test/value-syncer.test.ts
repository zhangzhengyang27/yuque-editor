import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { ValueSyncer, DEFAULT_SYNC_RETRY_DELAYS } from "../src/controlled"

/** 可编程的假编辑器：文档内容手动控制，记录 setContent 调用 */
function makeHooks(initial = "") {
  const state = {
    doc: initial,
    setContentCalls: [] as string[],
    getContentCalls: 0,
  }
  const hooks = {
    getContent: () => {
      state.getContentCalls++
      return state.doc
    },
    setContent: (content: string) => {
      state.setContentCalls.push(content)
      state.doc = content
    },
  }
  return { state, hooks }
}

describe("ValueSyncer.shouldEmit", () => {
  it("普通用户编辑返回 true", () => {
    const { hooks } = makeHooks()
    const syncer = new ValueSyncer(hooks, "", "text/html")

    expect(syncer.shouldEmit("user input")).toBe(true)
  })

  it("写入尚未生效时，完全相同回声被吞掉且去重只生效一次", () => {
    // setContent 不立即反映到 getContent（模拟编辑器异步应用内容），
    // 此时 pendingProgrammatic 保持未决，等回声到来时消费
    const hooks = {
      getContent: () => "<p>stale</p>",
      setContent: () => {},
    }
    const syncer = new ValueSyncer(hooks, "<p>stale</p>", "text/html")

    expect(syncer.sync("<p>hi</p>")).toBe(false)
    expect(syncer.shouldEmit("<p>hi</p>")).toBe(false)
    // 回声消费后 pendingProgrammatic 已清空，同样的值再次出现按新编辑处理
    expect(syncer.shouldEmit("<p>hi</p>")).toBe(true)
  })

  it("写入尚未生效时，编辑器先回吐的空白文档被视为回声", () => {
    const hooks = {
      getContent: () => "<p>stale</p>",
      setContent: () => {},
    }
    const syncer = new ValueSyncer(hooks, "<p>stale</p>", "text/html")

    expect(syncer.sync("<p>hi</p>")).toBe(false)
    expect(syncer.shouldEmit("")).toBe(false)
    expect(syncer.shouldEmit("<p><br></p>")).toBe(false)
    // 真正的回声随后到来，仍被消费
    expect(syncer.shouldEmit("<p>hi</p>")).toBe(false)
  })

  it("初始化灌值完成后，空白编辑作为真实变更放行", () => {
    const { hooks } = makeHooks("")
    const syncer = new ValueSyncer(hooks, "", "text/html")

    syncer.sync("<p>init</p>")
    // 同步已生效、回声窗口已关闭：用户全选删除产生的空白必须向上派发
    expect(syncer.shouldEmit("")).toBe(true)
    expect(syncer.shouldEmit("<p>typed</p>")).toBe(true)
  })

  it("dispose 后一律返回 false", () => {
    const { hooks } = makeHooks()
    const syncer = new ValueSyncer(hooks, "", "text/html")
    syncer.dispose()

    expect(syncer.shouldEmit("anything")).toBe(false)
  })
})

describe("ValueSyncer.sync", () => {
  it("目标与已知内容一致时短路，不触碰编辑器", () => {
    const { state, hooks } = makeHooks("<p>same</p>")
    const syncer = new ValueSyncer(hooks, "<p>same</p>", "text/html")

    expect(syncer.sync("<p>same</p>")).toBe(true)
    expect(state.setContentCalls).toHaveLength(0)
  })

  it("空文档的等价形态视为相同，不重复回写", () => {
    const { state, hooks } = makeHooks("<p><br></p>")
    const syncer = new ValueSyncer(hooks, "", "text/html")

    expect(syncer.sync("")).toBe(true)
    expect(state.setContentCalls).toHaveLength(0)
  })

  it("内容不一致时回写编辑器", () => {
    const { state, hooks } = makeHooks("<p>old</p>")
    const syncer = new ValueSyncer(hooks, "<p>old</p>", "text/html")

    expect(syncer.sync("<p>new</p>")).toBe(true)
    expect(state.setContentCalls).toEqual(["<p>new</p>"])
    // 同步已验证生效后 pendingProgrammatic 会被清空（此时的回声由
    // editor.ts 的 lastSetContent 吞掉），相同内容再次出现不会被误吞
    expect(syncer.shouldEmit("<p>new</p>")).toBe(true)
  })

  it("回写后编辑器内容仍不一致时返回 false（等待重试）", () => {
    // 模拟「setDocument 未生效」：setContent 不改变 getContent 的返回
    const calls: string[] = []
    const brokenHooks = {
      getContent: () => "<p>old</p>",
      setContent: (c: string) => {
        calls.push(c)
      },
    }
    const syncer = new ValueSyncer(brokenHooks, "<p>old</p>", "text/html")

    expect(syncer.sync("<p>new</p>")).toBe(false)
    expect(calls).toEqual(["<p>new</p>"])
  })

  it("dispose 后 sync 返回 false", () => {
    const { hooks } = makeHooks()
    const syncer = new ValueSyncer(hooks, "", "text/html")
    syncer.dispose()

    expect(syncer.sync("<p>x</p>")).toBe(false)
  })
})

describe("ValueSyncer.syncWithRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("首次失败后按延迟重试，命中后取消剩余重试", () => {
    const state = { doc: "<p>stale</p>", setContentCalls: [] as string[] }
    // setContent 不更新 doc：模拟编辑器延迟应用内容
    const hooks = {
      getContent: () => state.doc,
      setContent: (c: string) => {
        state.setContentCalls.push(c)
      },
    }
    const syncer = new ValueSyncer(hooks, "<p>stale</p>", "text/html", DEFAULT_SYNC_RETRY_DELAYS)

    syncer.syncWithRetry("<p>fresh</p>")
    vi.advanceTimersByTime(1) // delay 0：回写失败
    vi.advanceTimersByTime(32) // delay 32：仍失败
    expect(state.setContentCalls).toHaveLength(2)

    state.doc = "<p>fresh</p>" // 编辑器真正应用内容
    vi.advanceTimersByTime(88) // delay 120：命中
    expect(state.setContentCalls).toHaveLength(2)

    vi.advanceTimersByTime(10_000) // 剩余重试已被取消
    expect(state.setContentCalls).toHaveLength(2)
  })

  it("新值到来时取消上一轮重试，旧值不会覆盖", () => {
    const { state, hooks } = makeHooks("<p>base</p>")
    const syncer = new ValueSyncer(hooks, "<p>base</p>", "text/html", DEFAULT_SYNC_RETRY_DELAYS)

    syncer.syncWithRetry("<p>A</p>")
    syncer.syncWithRetry("<p>B</p>")
    vi.advanceTimersByTime(10_000)

    expect(state.setContentCalls).toEqual(["<p>B</p>"])
    expect(state.doc).toBe("<p>B</p>")
  })

  it("cancelRetry 取消未执行的重试", () => {
    const { state, hooks } = makeHooks("<p>base</p>")
    const syncer = new ValueSyncer(hooks, "<p>base</p>", "text/html", DEFAULT_SYNC_RETRY_DELAYS)

    syncer.syncWithRetry("<p>x</p>")
    syncer.cancelRetry()
    vi.advanceTimersByTime(10_000)

    expect(state.setContentCalls).toHaveLength(0)
  })

  it("dispose 后不再重试", () => {
    const { state, hooks } = makeHooks("<p>base</p>")
    const syncer = new ValueSyncer(hooks, "<p>base</p>", "text/html", DEFAULT_SYNC_RETRY_DELAYS)

    syncer.syncWithRetry("<p>x</p>")
    syncer.dispose()
    vi.advanceTimersByTime(10_000)

    expect(state.setContentCalls).toHaveLength(0)
  })
})
