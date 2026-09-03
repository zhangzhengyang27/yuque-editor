import type { YuqueDocScheme } from "./editor"

/**
 * 受控值同步器。
 *
 * 第三方编辑器是「外部可变状态」：用户键入会让它自己变，父组件传入的 `value` 也会让它变。
 * 两者的回声如果不加区分，就会形成
 * `用户输入 → contentchange → onChange → 父组件 setState → value 变化 → setContent → contentchange → …`
 * 的死循环，表现为光标跳到开头、撤销历史被清空。
 *
 * 这里把 React / Vue 各自散落的去重标记收敛到一个与框架无关的状态机里，供两侧复用：
 * - `shouldEmit()`：编辑器内部变更时判断要不要向上派发
 * - `sync()` / `syncWithRetry()`：外部 value 变化时写回编辑器
 */
export interface ValueSyncerHooks {
  /** 读取编辑器当前内容 */
  getContent: (scheme: YuqueDocScheme) => string
  /** 写入编辑器内容 */
  setContent: (content: string, scheme: YuqueDocScheme) => void
  /**
   * 可选：内容是否真的渲染到了 DOM。
   * 编辑器偶发「文档数据已更新但 DOM 未重绘」，仅比较字符串会漏判，此时需要重试。
   */
  isRendered?: (content: string) => boolean
  /** 可选：每次同步前的布局修正 */
  beforeSync?: () => void
}

/** 值同步的重试间隔（毫秒）。命中即取消后续重试。 */
export const DEFAULT_SYNC_RETRY_DELAYS: readonly number[] = [0, 32, 120, 360]
/** 初始化完成后的首次同步，多给一次长间隔兜底 */
export const INIT_SYNC_RETRY_DELAYS: readonly number[] = [0, 32, 120, 360, 1000]

/** 编辑器在「内容为空」时回吐的几种等价形态 */
function isBlankContent(value: string): boolean {
  const trimmed = value.trim()
  return (
    trimmed === "" ||
    trimmed === "<p></p>" ||
    trimmed === "<p><br></p>" ||
    trimmed === "<p><br/></p>"
  )
}

export class ValueSyncer {
  /** 主动 setContent 后、等待被 contentchange 回声抵消的值 */
  private pendingProgrammatic = ""
  /** 初始化阶段灌入的值，用于吞掉紧随其后的空白回声 */
  private initPayload = ""
  private lastApplied: string
  private lastEmitted: string
  private timers = new Set<ReturnType<typeof setTimeout>>()
  private disposed = false

  constructor(
    private hooks: ValueSyncerHooks,
    initialValue: string,
    private scheme: YuqueDocScheme,
    private retryDelays: readonly number[] = DEFAULT_SYNC_RETRY_DELAYS
  ) {
    this.lastApplied = initialValue
    this.lastEmitted = initialValue
  }

  getScheme(): YuqueDocScheme {
    return this.scheme
  }

  setScheme(scheme: YuqueDocScheme): void {
    this.scheme = scheme
  }

  /**
   * 编辑器内部内容变更时调用。
   * 返回 `true` 表示这是真实用户编辑，应向上派发 `onChange`；`false` 表示回声，应丢弃。
   */
  shouldEmit(value: string): boolean {
    if (this.disposed) return false

    // 我们刚主动写入过内容：这次变更大概率是它的回声
    if (this.pendingProgrammatic) {
      if (value === this.pendingProgrammatic) {
        this.pendingProgrammatic = "" // 去重只生效一次
        this.remember(value)
        return false
      }
      // 写入过程中编辑器可能先回吐一个空文档，同样视为回声
      if (isBlankContent(value) && !isBlankContent(this.pendingProgrammatic)) {
        return false
      }
    }

    // 初始化灌值时编辑器也会先回吐空文档
    if (this.initPayload) {
      if (isBlankContent(value)) return false
      this.initPayload = ""
    }

    this.remember(value)
    return true
  }

  /**
   * 外部 `value` 变化时调用：命中即取消剩余重试，返回是否已同步。
   *
   * @param force 跳过「值未变」短路，强制执行一次完整校验。
   *   初始化完成后必须用它跑一次——此时 `lastApplied` 已经等于目标值，
   *   但仍需确认内容真的渲染到了 DOM（编辑器偶发数据更新而 DOM 未重绘）。
   */
  sync(target: string, force = false): boolean {
    if (this.disposed) return false

    // 与编辑器当前已知内容一致，无需回写（最常见的回声路径，直接短路）
    if (!force && (target === this.lastApplied || target === this.lastEmitted)) return true

    this.hooks.beforeSync?.()

    const current = this.hooks.getContent(this.scheme)
    // 用「语义相等」比较：空文档有 '' / '<p></p>' / '<p><br></p>' 等等价形态，
    // 字符串不等就回写会带来重复的整文档 setContent 与重试窗口
    if (this.sameContent(current, target) && this.rendered(target)) {
      this.consumeInitPayload(target)
      this.remember(current)
      this.pendingProgrammatic = ""
      return true
    }

    this.pendingProgrammatic = target
    if (target) this.initPayload = target
    this.hooks.setContent(target, this.scheme)

    const next = this.hooks.getContent(this.scheme)
    if (this.sameContent(next, target) && this.rendered(target)) {
      this.consumeInitPayload(target)
      this.remember(next)
      // 清空未决回声：editor.ts 的 lastSetContent 可能已把这次 contentchange 吞掉
      // （onChange 未触发，pendingProgrammatic 未被 shouldEmit 消费），若不清空，
      // 用户后续输入恰好等于 target 时会被误判为回声而吞掉一次
      this.pendingProgrammatic = ""
      return true
    }

    return false
  }

  /** 内容语义相等：字符串相等，或两者都是「空文档」的等价形态 */
  private sameContent(a: string, b: string): boolean {
    return a === b || (isBlankContent(a) && isBlankContent(b))
  }

  /** 带重试的同步。新值到来会取消上一轮未完成的重试，避免旧值覆盖新值。 */
  syncWithRetry(target: string): void {
    this.cancelRetry()
    if (this.disposed) return
    for (const delay of this.retryDelays) {
      const id = setTimeout(() => {
        this.timers.delete(id)
        if (this.disposed) return
        if (this.sync(target)) this.cancelRetry()
      }, delay)
      this.timers.add(id)
    }
  }

  /** 取消尚未执行的重试，不销毁同步器 */
  cancelRetry(): void {
    for (const id of this.timers) clearTimeout(id)
    this.timers.clear()
  }

  /** 销毁：取消所有重试并让后续调用全部失效 */
  dispose(): void {
    this.disposed = true
    this.cancelRetry()
  }

  private rendered(content: string): boolean {
    return this.hooks.isRendered ? this.hooks.isRendered(content) : true
  }

  private consumeInitPayload(target: string): void {
    if (this.initPayload === target) this.initPayload = ""
  }

  private remember(value: string): void {
    this.lastApplied = value
    this.lastEmitted = value
  }
}
