import { useState, useRef, useEffect } from 'react'
import { askWine } from '../api/client'

const SUGGESTIONS = [
  'Top 10 wines by score',
  'Italian wines above 80',
  'How many wines by country?',
  'Wines missing WIQS vectors',
]

export default function AskWine() {
  const [question, setQuestion] = useState('')
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [history, loading])

  const submit = async (q) => {
    const text = (q || question).trim()
    if (!text || loading) return
    setQuestion('')
    setError(null)
    setLoading(true)

    const ts = new Date()
    try {
      const res = await askWine(text)
      setHistory(prev => [...prev.slice(-9), {
        question: text,
        answer: res.formatted_answer,
        sql: res.sql,
        rowCount: res.row_count,
        timestamp: ts,
      }])
    } catch (err) {
      setError(err.message || 'Request failed')
      setHistory(prev => [...prev.slice(-9), {
        question: text,
        answer: null,
        error: err.message || 'Request failed',
        timestamp: ts,
      }])
    } finally {
      setLoading(false)
    }
  }

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px 12px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.18em',
            textTransform: 'uppercase', color: 'var(--gold)',
          }}>Ask WINE</div>
          <div style={{
            fontSize: 11, color: 'var(--text-dim)', marginTop: 2,
          }}>Ask anything about the catalog</div>
        </div>
        {history.length > 0 && (
          <button
            onClick={() => setHistory([])}
            style={{
              background: 'none', border: 'none',
              color: 'var(--text-dim)', fontSize: 10,
              cursor: 'pointer', padding: '4px 8px',
            }}
          >Clear</button>
        )}
      </div>

      {/* Conversation area */}
      <div
        ref={scrollRef}
        style={{
          padding: '16px 20px',
          minHeight: 120,
          maxHeight: 480,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* Suggestions — show when empty */}
        {history.length === 0 && !loading && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 8,
            justifyContent: 'center', padding: '12px 0',
          }}>
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                onClick={() => { setQuestion(s); submit(s) }}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 16,
                  padding: '6px 14px',
                  color: 'var(--text-dim)',
                  fontSize: 12,
                  cursor: 'pointer',
                  transition: 'border-color 150ms, color 150ms',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--gold-dim)'
                  e.currentTarget.style.color = 'var(--gold)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.color = 'var(--text-dim)'
                }}
              >{s}</button>
            ))}
          </div>
        )}

        {/* History */}
        {history.map((h, i) => (
          <Exchange key={i} entry={h} />
        ))}

        {/* Loading */}
        {loading && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            color: 'var(--text-dim)', fontSize: 12,
            padding: '8px 0',
          }}>
            <Shimmer />
            Thinking...
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div style={{
            fontSize: 12, color: 'var(--red)',
            padding: '8px 12px',
            background: 'rgba(220,38,38,0.08)',
            borderRadius: 6,
          }}>{error}</div>
        )}
      </div>

      {/* Input bar */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        gap: 8,
      }}>
        <input
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={onKey}
          placeholder="Ask anything..."
          disabled={loading}
          style={{
            flex: 1,
            background: '#111',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: '8px 12px',
            color: 'var(--text)',
            fontSize: 13,
            outline: 'none',
          }}
          onFocus={e => e.currentTarget.style.borderColor = 'var(--gold-dim)'}
          onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
        />
        <button
          onClick={() => submit()}
          disabled={loading || !question.trim()}
          style={{
            background: loading || !question.trim() ? '#333' : 'var(--gold)',
            border: 'none',
            borderRadius: 4,
            padding: '8px 16px',
            color: loading || !question.trim() ? '#666' : '#0d0d0d',
            fontSize: 13,
            fontWeight: 600,
            cursor: loading || !question.trim() ? 'default' : 'pointer',
            transition: 'background 150ms',
            whiteSpace: 'nowrap',
          }}
        >Ask</button>
      </div>
    </div>
  )
}


function Exchange({ entry }) {
  const [showSql, setShowSql] = useState(false)
  const ago = entry.timestamp
    ? (() => {
        const s = Math.floor((Date.now() - entry.timestamp.getTime()) / 1000)
        if (s < 60) return `${s}s ago`
        return `${Math.floor(s / 60)}m ago`
      })()
    : ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* User question */}
      <div style={{
        fontSize: 12, color: 'var(--text-dim)',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{ fontWeight: 600, color: 'var(--text)' }}>You</span>
        {entry.question}
      </div>

      {/* Answer block */}
      {entry.answer ? (
        <div style={{
          background: '#111',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '12px 16px',
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'var(--gold)',
            marginBottom: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span>WINE</span>
            <span style={{ fontWeight: 400, letterSpacing: 0, fontSize: 10, color: 'var(--text-dim)' }}>
              {ago}
            </span>
          </div>
          <div style={{
            fontSize: 13, color: 'var(--text)',
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>
            <MarkdownLite text={entry.answer} />
          </div>

          {/* SQL toggle */}
          {entry.sql && (
            <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
              <button
                onClick={() => setShowSql(!showSql)}
                style={{
                  background: 'none', border: 'none',
                  color: 'var(--gold-dim)', fontSize: 11,
                  cursor: 'pointer', padding: 0,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                <span style={{
                  display: 'inline-block',
                  transform: showSql ? 'rotate(90deg)' : 'rotate(0)',
                  transition: 'transform 150ms',
                  fontSize: 10,
                }}>&#9654;</span>
                Show SQL
              </button>
              {showSql && (
                <pre style={{
                  marginTop: 8, padding: '8px 10px',
                  background: '#0a0a0a',
                  border: '1px solid #222',
                  borderRadius: 4,
                  fontSize: 11, color: 'var(--text-dim)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  overflow: 'auto',
                  maxHeight: 180,
                }}>{entry.sql}</pre>
              )}
            </div>
          )}
        </div>
      ) : entry.error ? (
        <div style={{
          fontSize: 12, color: 'var(--red)',
          padding: '8px 12px',
          background: 'rgba(220,38,38,0.08)',
          borderRadius: 6,
        }}>{entry.error}</div>
      ) : null}
    </div>
  )
}


function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function MarkdownLite({ text }) {
  if (!text) return null
  // Minimal markdown: bold, tables, line breaks
  const lines = text.split('\n')
  const elements = []
  let inTable = false
  let tableRows = []

  const flushTable = () => {
    if (tableRows.length === 0) return
    elements.push(
      <div key={`t-${elements.length}`} style={{ overflowX: 'auto', margin: '8px 0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <tbody>
            {tableRows.map((row, ri) => (
              <tr key={ri} style={{ borderBottom: '1px solid #222' }}>
                {row.map((cell, ci) => {
                  const Tag = ri === 0 ? 'th' : 'td'
                  return (
                    <Tag key={ci} style={{
                      padding: '4px 8px',
                      textAlign: 'left',
                      color: ri === 0 ? 'var(--text-dim)' : 'var(--text)',
                      fontWeight: ri === 0 ? 600 : 400,
                      fontSize: ri === 0 ? 10 : 12,
                      letterSpacing: ri === 0 ? '0.05em' : 0,
                      whiteSpace: 'nowrap',
                    }}>{cell.trim()}</Tag>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
    tableRows = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // Table separator row
    if (/^\|[\s\-:|]+\|$/.test(line)) continue
    // Table row
    if (line.startsWith('|') && line.endsWith('|')) {
      if (!inTable) inTable = true
      const cells = line.slice(1, -1).split('|')
      tableRows.push(cells)
      continue
    }

    if (inTable) {
      flushTable()
      inTable = false
    }

    // Bold
    const escaped = escapeHtml(line)
    const boldified = escaped.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    if (line.trim()) {
      elements.push(
        <div key={`l-${i}`} dangerouslySetInnerHTML={{ __html: boldified }} />
      )
    } else {
      elements.push(<div key={`l-${i}`} style={{ height: 6 }} />)
    }
  }
  if (inTable) flushTable()

  return <>{elements}</>
}


function Shimmer() {
  return (
    <div style={{
      width: 16, height: 16, borderRadius: '50%',
      border: '2px solid var(--gold-dim)',
      borderTopColor: 'var(--gold)',
      animation: 'spin 0.8s linear infinite',
    }} />
  )
}
