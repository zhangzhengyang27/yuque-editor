# 06 - 媒体上传通道

> 编辑器的四类媒体插入——图片、视频、附件、音频——在 Lake 内部是四条**互相独立**的上传通道，各有各的调用约定与返回值口味。本章记录它们的全貌：内核如何桥接、Lake 如何回调、哪些坑是实测踩出来的。

> 📌 **文档状态（2026-09-16，基于 `80579e0` upload-channel 桥接重构）**：
> - 本内核此前只暴露了 `uploadImage` 通道，视频/附件/音频走 Lake 内置默认端点 `/api/upload*`，宿主未实现该路由即 404（表现为卡片「上传中」不消失、「无法播放」「Cannot POST」错误态）
> - `80579e0` 新增 `uploadFile` / `uploadAudio` 选项，并修正 `uploadVideo` 的回调契约（见 §2.2，旧实现把 image 的请求对象约定误推广到了 video）
> - 实测回归工具：知识库仓库（xiaoye）`scripts/probe-editor-upload.mjs`，五通道端到端探针

## 1. 全景：四条通道与两个约定

| 通道 | Lake 配置键 | 入口（slash 菜单） | 默认端点（未配置时） |
|------|------------|-------------------|---------------------|
| 图片 | `image` | `/tp` 图片、粘贴、工具栏 | 无内置上传（未配置则仅 URL 插入） |
| 视频 | `video` | `/sp` 本地视频 | `POST /api/upload/video` |
| 附件 | `file` | `/fj` 附件、`/bdwj` 本地文件 | `POST /api/upload` |
| 音频 | `audio` | `/yp` 本地音频 | `POST /api/upload` + 转码轮询 |

内核把宿主钩子映射进 Lake 的配置对象（`editor.ts` 的 `createOpenEditor` 调用）：`uploadImage → image`、`uploadVideo → video`、`uploadFile → file`、`uploadAudio → audio`。**某通道未配置钩子时，对应配置键不注入，Lake 使用内置默认**——默认上传端点 `Hee={uploadFileURL:"/api/upload",quickUploadUrl:"/api/upload",...}` 就是 `Cannot POST` 的来源。

## 2. Lake 侧的回调约定（逆向所得，升级 Lake 必须复核）

### 2.1 图片通道：请求对象

图片插件（`plugins/image/src/common/image-option.ts`）按**优先级**取 `createUploadTask → createUploadPromise → uploadFileURL/crawlURL`，其中 `createUploadPromise` 经 `f_e` 包装后收到的是**请求对象** `{ type: "url"|"file"|"base64", data }`。

### 2.2 视频/附件/音频通道：原始负载

这三个通道的任务包装类分别是 `JSe`（视频）、`zCe`（附件/文件）、`GFe`（音频），它们的 `run()` 都是同一模式：

```js
this.upload(this._data, progressCb)   // 原始 File（或 URL 字符串）直接作为首参
```

**不是请求对象**。`80579e0` 之前的 video 映射按请求对象解构 `request.data`，实际拿到 `data: undefined`——这是当年没接 video 通道所以没暴露的契约错误。

优先级与降级（以视频插件为例）：

```
字符串负载 → crawlVideo（URL 抓取分支，到不了 createUploadPromise）
文件负载   → createUploadTask(e) → createUploadPromise(e) → uploadFileURL 默认上传
```

### 2.3 返回值口味

- **图片/视频卡**：认 `UploadResult`（`{ url, size, filename?, cover? }`）——视频卡完成回调读 `t.filename / t.size / t.url`，`videoId` 可缺省。
- **音频卡**：认**语雀传统响应字段**——`handleUploadSuccess` 读 `e.video_id || e.audioId`（设为卡片 id）、`e.filesize`、`e.filename`。`UploadResult` 的 `url/size` 命名它不认识，内核适配层做了字段改写（见 §3.2）。

## 3. 内核适配层（editor.ts）

### 3.1 通道映射

```ts
// 图片：请求对象透传
image: options.uploadImage ? { createUploadPromise(req) { ... } } : undefined
// 视频/文件/音频：原始负载 → 统一包成 { type, data } 喂给宿主钩子
video: { createUploadPromise(data) { return uploadVideo({ type: typeof data === "string" ? "url" : "file", data }) } }
file:  { createUploadPromise(data) { return uploadFile({ type: "file", data }) } }
audio: { createUploadPromise(data) { ... } }   // 详见 §3.2
```

宿主钩子因此获得**统一契约** `EditorUploadHandler`；Lake 侧的约定差异全部由内核吸收。

### 3.2 音频卡的两处特殊处理

音频卡（`plugins/audio`）不是「上传完成即播放」：

1. **完成回调字段适配**：内核把 `UploadResult` 改写为 `{ ...result, audioId: url, filesize: size }` 再交给 Lake，否则 `setId(undefined)` 后卡片永远停在「上传中」（status 不翻转，UI 不出播放器）。
2. **播放地址换取**：音频卡默认设计是「上传 → 服务端转码 → 轮询 `queryURL` 拿转码结果」，`queryAudioUrlByOption` 在未配置 `queryAudioUrl` 时会走 `tryPollingAudioUrl` 轮询。自有存储没有转码环节，内核注入的 `queryAudioUrl` 直接返回上传 URL：

```ts
queryAudioUrl(cardData) {
  const info = cardData?.getAudioInfo?.()
  const url = info?.url || info?.id || ""
  return { audioUrl: url, downloadUrl: url }
}
```

即「上传完成 → id 即播放地址 → 跳过轮询 → 卡片直接可播」。音频卡状态机：`pending → uploading → uploaded(h7)`，`transcoded(v7→m7)` 只在真有转码环节时出现。

## 4. 框架封装透传（vue.ts / react.tsx）

四个上传钩子都是**函数型配置**，在两处登记：

- Vue：props 声明、`lastConfig` 缓存、`createYuqueEditor` 调用、重建 watch 的依赖数组（共 4 处）
- React：props 类型（继承 `YuqueEditorOptions`）、`extractConfig`、重建 effect 依赖数组

`shallowEqual` 对函数恒等比较（"函数不比较"），宿主用内联箭头函数传入也不会引发实例重建；但 `undefined ↔ function` 的翻转是真实变更，会正常触发重建。

## 5. 宿主接入契约与降级策略

- 统一签名：`({ type: "url" | "file" | "base64", data }) => Promise<UploadResult>`
- `type === "url"` 时宿主可直接 `{ url: data, size: 0 }` 透传（实际只有图片通道会送 url 进来；视频 URL 走各自 crawl 分支，到不了上传钩子）
- **媒体通道没有 base64 内联降级**——动辄数 MB 的 dataURL 会撑爆宿主的自动保存请求体，这与图片通道「上传失败降级 base64 保编辑不中断」的策略是刻意的不同。宿主未传钩子时，内核不注入对应配置（保持 Lake 默认），而不是注入一个会抛错的钩子。

## 6. 回归验证

知识库仓库（xiaoye）的 `scripts/probe-editor-upload.mjs` 覆盖五条链路（图片/视频/音频/附件/本地文件）：

1. slash 拼音检索（`/tp` `/sp` `/yp` `/fj` `/bdwj`）唤起菜单并选中
2. Playwright filechooser 提交真实样本（png / mp4 / m4a / txt）
3. 断言网络端点：必须命中宿主 OSS 上传接口、不得出现 `/api/upload*`
4. 断言卡片状态：无「上传中」「无法播放」「Cannot POST」错误文本
5. 旁路核验对象已落对象存储

跑法：后端 + preview 4173 在跑时 `node scripts/probe-editor-upload.mjs`。改内核上传相关代码后必须复跑。
