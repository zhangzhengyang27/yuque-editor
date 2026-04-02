import React from 'react'
import ReactDOM from 'react-dom/client'
import { YuqueRichText } from 'yuque-editor-core/react'
import type { YuqueEditorRef } from 'yuque-editor-core/editor'

const INITIAL_VALUE = `<h1>Hello Yuque Editor!</h1>
<p>这是一个 <strong>React 示例</strong>，使用 yuque-editor-core 加载语雀编辑器。</p>
<h2>功能特性</h2>
<ul>
  <li>富文本编辑</li>
  <li>Markdown 支持</li>
  <li>工具栏</li>
  <li>图片上传</li>
</ul>
<p>试试编辑上面的内容吧！</p>
`

function App() {
  const editorRef = React.useRef<YuqueEditorRef>(null)
  const [content, setContent] = React.useState(INITIAL_VALUE)
  const [wordCount, setWordCount] = React.useState(0)

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px' }}>
      <h1 style={{ textAlign: 'center' }}>Yuque Editor React Demo</h1>

      <div style={{
        display: 'flex',
        gap: 12,
        marginBottom: 16,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        <button onClick={() => {
          const text = editorRef.current?.getSummaryContent() ?? ''
          setWordCount(editorRef.current?.wordCount() ?? 0)
          alert(`摘要内容:\n${text}`)
        }}>
          获取摘要
        </button>
        <button onClick={() => {
          setContent('<p>已清空内容，重新开始编辑吧！</p>')
        }}>
          清空内容
        </button>
        <span style={{ color: '#666', fontSize: 14 }}>
          字数: {wordCount}
        </span>
      </div>

      <div style={{
        border: '1px solid #e8e8e8',
        borderRadius: 8,
        overflow: 'hidden',
      }}>
        <YuqueRichText
          ref={editorRef}
          value={content}
          onChange={(v) => setContent(v)}
          onLoad={() => {
            console.log('Editor loaded!')
            setWordCount(editorRef.current?.wordCount() ?? 0)
          }}
          onError={(err) => console.error('Editor error:', err)}
          showToolbar
          showToc={false}
        />
      </div>

      <details style={{ marginTop: 16 }}>
        <summary style={{ cursor: 'pointer', color: '#666' }}>
          查看原始 HTML
        </summary>
        <pre style={{
          background: '#f5f5f5',
          padding: 12,
          borderRadius: 4,
          overflow: 'auto',
          maxHeight: 300,
          fontSize: 12,
        }}>
          {content}
        </pre>
      </details>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
