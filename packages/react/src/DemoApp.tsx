import React, { useCallback, useRef, useState } from 'react'
import { YuqueRichText } from 'yuque-editor-core/react'
import type { YuqueEditorRef, YuqueDocScheme } from 'yuque-editor-core/editor'
import type { UploadResult } from 'yuque-editor-core/editor'

export const INITIAL_VALUE = `<h1>Hello Yuque Editor!</h1>
<p>这是一个 <strong>React 示例</strong>，使用 yuque-editor-core 加载语雀编辑器。</p>
<h2>功能特性</h2>
<ul>
  <li>富文本编辑 · 图片/视频上传</li>
  <li>工具栏 · 字号 · 对齐</li>
  <li>undo/redo · 加粗/斜体/下划线</li>
  <li>字数统计 · 格式切换</li>
</ul>
<p>试试编辑上面的内容吧！</p>
`

/** 模拟上传：真实项目里替换为自己的上传接口即可 */
async function fakeUpload(params: { type: string; data: string | File }): Promise<UploadResult> {
  console.log('[uploadImage] 触发上传：', params.type, params.data)
  const size =
    params.data instanceof File
      ? params.data.size
      : params.type === 'base64'
        ? Math.ceil(String(params.data).length * 0.75)
        : 0
  return {
    url: `https://picsum.photos/seed/${Date.now()}/640/360`,
    size
  }
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e8e8e8',
      borderRadius: 8,
      padding: '10px 12px',
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 8, borderBottom: '1px solid #f0f0f0', paddingBottom: 6 }}>
        {title}
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
        {children}
      </div>
    </div>
  )
}

function CmdBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 12,
        padding: '3px 8px',
        border: '1px solid #d9d9d9',
        borderRadius: 4,
        background: '#fff',
        cursor: 'pointer',
        color: '#333',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

export function DemoApp() {
  const editorRef = useRef<YuqueEditorRef | null>(null)
  const [content, setContent] = useState(INITIAL_VALUE)
  const [wordCount, setWordCount] = useState(0)
  const [logs, setLogs] = useState<string[]>([])

  const addLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString()
    setLogs(prev => [`[${ts}] ${msg}`, ...prev].slice(0, 50))
  }, [])

  const handleChange = useCallback((v: string) => {
    setContent(v)
    setWordCount(editorRef.current?.wordCount() ?? 0)
  }, [])

  const handleLoad = useCallback(() => {
    addLog('Editor loaded!')
    setWordCount(editorRef.current?.wordCount() ?? 0)
  }, [addLog])

  const handleError = useCallback((err: Error) => {
    addLog(`ERROR: ${err.message}`)
  }, [addLog])

  const handleFocus = useCallback(() => addLog('focus'), [addLog])
  const handleBlur = useCallback(() => addLog('blur'), [addLog])
  const handleSelectionChange = useCallback(() => addLog('selectionchange'), [addLog])
  const handleFocusStatusChange = useCallback((focused: boolean) => addLog(`focusstatuschange: ${focused}`), [addLog])

  const clearLogs = () => setLogs([])

  const cmd = (label: string, fn: () => void) => {
    try {
      fn()
      addLog(`exec: ${label}`)
    } catch (e) {
      addLog(`exec FAIL: ${label} — ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', maxWidth: 960, margin: '0 auto', padding: '20px 16px' }}>
      <h1 style={{ textAlign: 'center', marginBottom: 24 }}>Yuque Editor — React Demo</h1>

      {/* ===== 功能面板 ===== */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: 16,
        marginBottom: 20,
      }}>
        {/* 基础操作 */}
        <Panel title="基础操作">
          <CmdBtn label="getSummaryContent" onClick={() => {
            const text = editorRef.current?.getSummaryContent() ?? ''
            addLog(`summary: "${text.slice(0, 60)}${text.length > 60 ? '…' : ''}"`)
          }} />
          <CmdBtn label="isEmpty" onClick={() => {
            addLog(`isEmpty: ${editorRef.current?.isEmpty()}`)
          }} />
          <CmdBtn label="wordCount" onClick={() => {
            addLog(`wordCount: ${editorRef.current?.wordCount()}`)
          }} />
          <CmdBtn label="setContent" onClick={() => {
            setContent('<p><strong>通过 setContent 重置的内容</strong></p>')
            addLog('setContent: reset')
          }} />
        </Panel>

        {/* execCommand: undo/redo */}
        <Panel title="撤销 / 重做">
          <CmdBtn label="undo" onClick={() => cmd('undo', () => editorRef.current!.undo())} />
          <CmdBtn label="redo" onClick={() => cmd('redo', () => editorRef.current!.redo())} />
        </Panel>

        {/* execCommand: 格式 */}
        <Panel title="文字格式 (execCommand)">
          <CmdBtn label="setBold" onClick={() => cmd('bold', () => editorRef.current!.setBold())} />
          <CmdBtn label="setItalic" onClick={() => cmd('italic', () => editorRef.current!.setItalic())} />
          <CmdBtn label="setUnderline" onClick={() => cmd('underline', () => editorRef.current!.setUnderline())} />
          <CmdBtn label="setStrikethrough" onClick={() => cmd('strikethrough', () => editorRef.current!.setStrikethrough())} />
          <CmdBtn label="clearFormat" onClick={() => cmd('clearFormat', () => editorRef.current!.clearFormat())} />
        </Panel>

        {/* execCommand: 颜色 */}
        <Panel title="颜色 (execCommand)">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['#FF6B00', '#1677FF', '#52C41A', '#F5222D', '#722ED1', '#000000'].map(color => (
              <button key={color} title={color}
                onClick={() => { editorRef.current?.setColor(color); addLog(`setColor: ${color}`) }}
                style={{ width: 28, height: 28, borderRadius: 4, border: '1px solid #ddd', background: color, cursor: 'pointer', padding: 0 }} />
            ))}
          </div>
          <CmdBtn label="clearColor" onClick={() => cmd('clearColor', () => editorRef.current!.clearColor())} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
            {['#FFEB3B', '#E1F5FE', '#F3E5F5', '#E8F5E9', '#FFF3E0'].map(color => (
              <button key={color} title={color}
                onClick={() => { editorRef.current?.setBgColor(color); addLog(`setBgColor: ${color}`) }}
                style={{ width: 28, height: 28, borderRadius: 4, border: '1px solid #ddd', background: color, cursor: 'pointer', padding: 0 }} />
            ))}
          </div>
        </Panel>

        {/* execCommand: 段落 */}
        <Panel title="段落样式 (execCommand)">
          {(['p', 'h1', 'h2', 'h3', 'h4'] as const).map(style => (
            <CmdBtn key={style} label={`style: ${style}`}
              onClick={() => cmd(`style=${style}`, () => editorRef.current!.setParagraphStyle(style))} />
          ))}
        </Panel>

        {/* execCommand: 对齐 */}
        <Panel title="对齐 / 缩进 (execCommand)">
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {(['left', 'center', 'right', 'justify'] as const).map(align => (
              <CmdBtn key={align} label={align}
                onClick={() => cmd(`alignment=${align}`, () => editorRef.current!.setAlignment(align))} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
            <CmdBtn label="indent" onClick={() => cmd('indent', () => editorRef.current!.indent())} />
            <CmdBtn label="outdent" onClick={() => cmd('outdent', () => editorRef.current!.outdent())} />
          </div>
        </Panel>

        {/* execCommand: 字号 */}
        <Panel title="字号 (execCommand)">
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {[12, 15, 18, 22, 24, 29, 32].map(size => (
              <CmdBtn key={size} label={`${size}px`}
                onClick={() => cmd(`fontsize=${size}`, () => editorRef.current!.setFontsize(size))} />
            ))}
          </div>
        </Panel>

        {/* 焦点 / 光标 */}
        <Panel title="焦点 / 光标">
          <CmdBtn label="focusToStart" onClick={() => cmd('focusToStart', () => editorRef.current!.focusToStart())} />
          <CmdBtn label="selectAll" onClick={() => cmd('selectAll', () => editorRef.current!.selectAll())} />
        </Panel>

        {/* 格式切换 */}
        <Panel title="格式切换 (getContent)">
          {(['text/html', 'text/markdown', 'text/plain', 'text/lake', 'json'] as YuqueDocScheme[]).map(scheme => (
            <CmdBtn key={scheme} label={`get: ${scheme}`}
              onClick={() => {
                const v = editorRef.current?.getContent(scheme) ?? ''
                addLog(`${scheme}: "${v.slice(0, 80)}${v.length > 80 ? '…' : ''}"`)
              }} />
          ))}
        </Panel>

        {/* 模拟上传 */}
        <Panel title="上传配置 (console)">
          <p style={{ fontSize: 12, color: '#666', margin: '0 0 8px' }}>
            查看控制台，观察 uploadImage 是否被调用
          </p>
          <p style={{ fontSize: 11, color: '#999', margin: 0 }}>
            提示：粘贴一张图片即可触发
          </p>
        </Panel>
      </div>

      {/* ===== 编辑器 ===== */}
      <div style={{
        border: '1px solid #e0e0e0',
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        width: '100%',
        height: '80vh',
        marginBottom: 16,
      }}>
        <YuqueRichText
          ref={editorRef}
          value={content}
          onChange={handleChange}
          onLoad={handleLoad}
          onError={handleError}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onSelectionChange={handleSelectionChange}
          onFocusStatusChange={handleFocusStatusChange}
          uploadImage={fakeUpload}
          showToolbar
          showToc={true}
        />
      </div>

      {/* ===== 状态栏 ===== */}
      <div style={{
        display: 'flex',
        gap: 16,
        alignItems: 'center',
        flexWrap: 'wrap',
        padding: '8px 12px',
        background: '#f5f5f5',
        borderRadius: 6,
        marginBottom: 16,
        fontSize: 13,
      }}>
        <span>字数: <strong>{wordCount}</strong></span>
        <span>内容长度: <strong>{content.length}</strong></span>
        <span>isEmpty: <strong>{editorRef.current?.isEmpty() ? 'true' : 'false'}</strong></span>
        <span style={{ marginLeft: 'auto', color: '#999' }}>打开开发者工具查看日志</span>
      </div>

      {/* ===== 事件日志 ===== */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 14, color: '#333' }}>事件日志</h3>
          <button onClick={clearLogs} style={{ fontSize: 12, padding: '2px 8px', cursor: 'pointer' }}>清空</button>
        </div>
        <div style={{
          background: '#1e1e1e',
          borderRadius: 6,
          padding: '10px 12px',
          height: 180,
          overflowY: 'auto',
          fontFamily: '"SF Mono", Monaco, Menlo, monospace',
          fontSize: 12,
        }}>
          {logs.length === 0 ? (
            <span style={{ color: '#555' }}>操作编辑器，事件日志将显示在这里…</span>
          ) : logs.map((log, i) => (
            <div key={i} style={{ color: i === 0 ? '#4fc3f7' : '#ccc', whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.6 }}>{log}</div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default DemoApp
