import { useState, useEffect, useCallback, Fragment } from 'react'
import { getAuditTrail, getAuditExportUrl } from '../api/client'
import LoadingSpinner from '../components/LoadingSpinner'

const LIMIT = 100

const OP_STYLES = {
  steve:         { bg: 'rgba(201,168,76,0.15)', color: '#c9a84c', border: 'rgba(201,168,76,0.3)', label: 'Steve' },
  claude_code:   { bg: 'rgba(37,99,235,0.1)',  color: '#60a5fa', border: 'rgba(37,99,235,0.2)', label: 'Claude Code' },
  pipeline_auto: { bg: 'rgba(22,163,74,0.1)',  color: '#4ade80', border: 'rgba(22,163,74,0.2)', label: 'Pipeline' },
  test:          { bg: 'rgba(150,150,150,0.1)', color: '#999',    border: 'rgba(150,150,150,0.2)', label: 'Test' },
}

const PROTECTED_FIDS = new Set([11, 12, 369, 912, 983, 1061])

function relativeTime(iso) {
  if (!iso) return '\u2014'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

function scoreDelta(oldVal, newVal) {
  const o = parseFloat(oldVal)
  const n = parseFloat(newVal)
  if (isNaN(o) || isNaN(n)) return null
  const delta = n - o
  if (delta === 0) return null
  return delta > 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2)
}

function OperatorBadge({ op }) {
  const s = OP_STYLES[op] || OP_STYLES.test
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
      padding: '2px 6px', borderRadius: 3,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>{s.label || op}</span>
  )
}

function ValueCell({ value, isDiff, isOld }) {
  if (value == null) return <span style={{ color: '#555' }}>{'\u2014'}</span>
  const truncated = value.length > 40 ? value.slice(0, 40) + '\u2026' : value
  const color = isDiff ? (isOld ? 'rgba(220,38,38,0.7)' : 'rgba(22,163,74,0.7)') : '#9e8e7e'
  return <span title={value} style={{ color, fontFamily: 'monospace', fontSize: 11 }}>{truncated}</span>
}

function DeltaBadge({ oldVal, newVal }) {
  const d = scoreDelta(oldVal, newVal)
  if (!d) return null
  const isPos = d.startsWith('+')
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, marginLeft: 4, padding: '1px 4px', borderRadius: 3,
      background: isPos ? 'rgba(22,163,74,0.15)' : 'rgba(220,38,38,0.15)',
      color: isPos ? '#4ade80' : '#f87171',
    }}>{d}</span>
  )
}

function ExpandedRow({ row }) {
  return (
    <tr>
      <td colSpan={10} style={{ padding: '12px 16px', background: '#111', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 12 }}>
          <div>
            <div style={{ color: 'var(--text-dim)', marginBottom: 4 }}>Full Timestamp</div>
            <div style={{ fontFamily: 'monospace', color: 'var(--text)' }}>{row.changed_at}</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-dim)', marginBottom: 4 }}>Session ID</div>
            <div style={{ fontFamily: 'monospace', color: 'var(--text)', wordBreak: 'break-all' }}>{row.session_id || '\u2014'}</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-dim)', marginBottom: 4 }}>Old Value (full)</div>
            <div style={{ fontFamily: 'monospace', color: '#9e8e7e', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 120, overflow: 'auto' }}>
              {row.old_value || '\u2014'}
            </div>
          </div>
          <div>
            <div style={{ color: 'var(--text-dim)', marginBottom: 4 }}>New Value (full)</div>
            <div style={{ fontFamily: 'monospace', color: '#9e8e7e', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 120, overflow: 'auto' }}>
              {row.new_value || '\u2014'}
            </div>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ color: 'var(--text-dim)', marginBottom: 4 }}>Note</div>
            <div style={{ color: 'var(--text)' }}>{row.note || '\u2014'}</div>
          </div>
          {row.record_id != null && (
            <div>
              <a href={`/catalog?q=${row.record_id}`} style={{ color: 'var(--gold)', fontSize: 12 }}>
                View wine fid={row.record_id}
              </a>
            </div>
          )}
        </div>
        {row.protected_tier_touch && (
          <div style={{
            marginTop: 10, padding: '8px 12px', borderRadius: 4,
            background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
            color: '#f59e0b', fontSize: 12,
          }}>
            This wine is a protected tier record. All changes are audited.
          </div>
        )}
      </td>
    </tr>
  )
}

export default function AuditTrail() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [operator, setOperator] = useState('')
  const [tableName, setTableName] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(0)
  const [expanded, setExpanded] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = { limit: LIMIT, offset: page * LIMIT }
      if (operator) params.operator = operator
      if (tableName) params.table_name = tableName
      if (dateFrom) params.date_from = dateFrom
      if (dateTo) params.date_to = dateTo
      if (search) params.search = search
      setData(await getAuditTrail(params))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [operator, tableName, dateFrom, dateTo, search, page])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { setPage(0) }, [operator, tableName, dateFrom, dateTo, search])

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400)
    return () => clearTimeout(t)
  }, [searchInput])

  const handleExport = () => {
    const params = {}
    if (operator) params.operator = operator
    if (tableName) params.table_name = tableName
    if (dateFrom) params.date_from = dateFrom
    if (dateTo) params.date_to = dateTo
    if (search) params.search = search
    const key = localStorage.getItem('wie_api_key')
    const url = getAuditExportUrl(params) + (key ? `&_key=${key}` : '')
    window.open(url, '_blank')
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  const chipStyle = (op) => {
    const active = operator === op
    const s = op ? OP_STYLES[op] : null
    return {
      padding: '4px 12px', borderRadius: 4, fontSize: 12, fontWeight: 600,
      border: `1px solid ${active ? (s?.border || 'var(--gold)') : 'var(--border)'}`,
      background: active ? (s?.bg || 'var(--bg-hover)') : 'transparent',
      color: active ? (s?.color || 'var(--gold)') : 'var(--text-dim)',
      cursor: 'pointer',
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ZONE 1 — Filter Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        padding: '12px 16px', background: 'var(--bg-card)', borderRadius: 8,
        border: '1px solid var(--border)',
      }}>
        {/* Operator chips */}
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { val: '', label: 'All Operators' },
            { val: 'steve', label: 'Steve' },
            { val: 'claude_code', label: 'Claude Code' },
            { val: 'pipeline_auto', label: 'Pipeline' },
          ].map(op => (
            <button key={op.val} onClick={() => setOperator(op.val)} style={chipStyle(op.val || undefined)}>
              {op.label}
            </button>
          ))}
        </div>

        {/* Table filter */}
        <select value={tableName} onChange={e => setTableName(e.target.value)} style={{
          padding: '4px 8px', borderRadius: 4, fontSize: 12,
          background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)',
        }}>
          <option value="">All Tables</option>
          {(data?.available_tables || []).map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        {/* Date range */}
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{
          padding: '4px 8px', borderRadius: 4, fontSize: 12,
          background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)',
        }} />
        <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>to</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{
          padding: '4px 8px', borderRadius: 4, fontSize: 12,
          background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)',
        }} />

        {/* Search */}
        <input type="text" placeholder="Search notes, values..." value={searchInput}
          onChange={e => setSearchInput(e.target.value)} style={{
            padding: '4px 10px', borderRadius: 4, fontSize: 12, flex: '1 1 160px', minWidth: 140,
            background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)',
          }} />

        {/* Export */}
        <button onClick={handleExport} style={{
          padding: '4px 12px', borderRadius: 4, fontSize: 12, fontWeight: 600,
          background: 'transparent', border: '1px solid var(--gold)', color: 'var(--gold)',
          cursor: 'pointer', whiteSpace: 'nowrap',
        }}>
          Export CSV
        </button>

        <span style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
          {total.toLocaleString()} events
        </span>
      </div>

      {/* ZONE 2 — Summary Strip */}
      {data?.summary && (
        <div style={{ display: 'flex', gap: 12 }}>
          {data.summary.map(s => {
            const os = OP_STYLES[s.operator] || OP_STYLES.test
            return (
              <div key={s.operator} style={{
                flex: 1, padding: '12px 16px', background: 'var(--bg-card)', borderRadius: 8,
                borderLeft: `3px solid ${os.color}`, border: `1px solid var(--border)`,
                borderLeftColor: os.color,
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: os.color, marginBottom: 4 }}>
                  {os.label || s.operator}
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
                  {s.event_count.toLocaleString()} <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-dim)' }}>events</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                  {s.tables} tables &middot; last {relativeTime(s.last_event)}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ZONE 3 — Audit Table */}
      {error && (
        <div style={{ padding: 16, color: 'var(--red)', background: 'rgba(220,38,38,0.1)', borderRadius: 8 }}>
          {error}
        </div>
      )}

      {loading && !data ? (
        <LoadingSpinner />
      ) : data?.rows?.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 4 }}>No audit events match your filters.</div>
          <div style={{ color: '#555', fontSize: 12 }}>ARCH-001 audit trail has been active since April 8, 2026.</div>
        </div>
      ) : (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 1100 }}>
            <thead>
              <tr style={{
                color: 'var(--text-dim)', fontSize: 10, textTransform: 'uppercase',
                letterSpacing: '0.1em', textAlign: 'left', borderBottom: '1px solid var(--border)',
              }}>
                {['Time', 'Operator', 'Table', 'Record', 'Field', 'Old Value', 'New Value', 'Script', 'Note'].map(h => (
                  <th key={h} style={{ padding: '8px 10px', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
                <th style={{ width: 30 }} />
              </tr>
            </thead>
            <tbody>
              {data?.rows?.map(r => {
                const isExpanded = expanded === r.id
                return (
                  <Fragment key={r.id}>
                    <tr
                      onClick={() => setExpanded(isExpanded ? null : r.id)}
                      style={{
                        height: 36, borderBottom: '1px solid #1a1a1a', cursor: 'pointer',
                        borderLeft: r.protected_tier_touch ? '3px solid var(--amber)' : '3px solid transparent',
                        background: isExpanded ? '#181818' : undefined,
                      }}
                      onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = '#141414' }}
                      onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = '' }}
                    >
                      <td style={{ padding: '4px 10px', fontFamily: 'monospace', fontSize: 11, color: '#9e8e7e', whiteSpace: 'nowrap' }}
                          title={r.changed_at}>
                        {relativeTime(r.changed_at)}
                      </td>
                      <td style={{ padding: '4px 10px', width: 100 }}><OperatorBadge op={r.operator} /></td>
                      <td style={{ padding: '4px 10px', fontFamily: 'monospace', color: '#9e8e7e' }}>{r.table_name}</td>
                      <td style={{ padding: '4px 10px', fontFamily: 'monospace', width: 70 }}>
                        {r.record_id ?? '\u2014'}
                        {r.protected_tier_touch && (
                          <span title="Protected tier wine" style={{ color: 'var(--amber)', marginLeft: 4, fontSize: 11 }}>
                            {'\u26A0'}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '4px 10px', fontFamily: 'monospace', fontSize: 11, color: '#9e8e7e' }}>
                        {r.is_insert ? <span style={{ fontStyle: 'italic', color: '#555' }}>new record</span> : (r.field_name || '\u2014')}
                      </td>
                      <td style={{ padding: '4px 10px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.is_insert
                          ? <span style={{ color: '#555' }}>{'\u2014'}</span>
                          : <ValueCell value={r.old_value} isDiff={r.has_diff} isOld />
                        }
                      </td>
                      <td style={{ padding: '4px 10px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <ValueCell value={r.new_value} isDiff={r.has_diff} isOld={false} />
                        {r.has_diff && <DeltaBadge oldVal={r.old_value} newVal={r.new_value} />}
                      </td>
                      <td style={{ padding: '4px 10px', fontFamily: 'monospace', fontSize: 11, color: '#9e8e7e', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={r.script_name || ''}>
                        {r.script_name ? (r.script_name.length > 20 ? r.script_name.slice(0, 20) + '\u2026' : r.script_name) : '\u2014'}
                      </td>
                      <td style={{ padding: '4px 10px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--text-dim)' }}
                          title={r.note || ''}>
                        {r.note ? (r.note.length > 60 ? r.note.slice(0, 60) + '\u2026' : r.note) : '\u2014'}
                      </td>
                      <td style={{ padding: '4px 10px', color: '#555', fontSize: 10 }}>{isExpanded ? '\u25B2' : '\u25BC'}</td>
                    </tr>
                    {isExpanded && <ExpandedRow row={r} />}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > LIMIT && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{
            padding: '4px 12px', borderRadius: 4, fontSize: 12,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            color: 'var(--text-dim)', opacity: page === 0 ? 0.4 : 1,
          }}>Prev</button>
          <span style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'monospace' }}>
            Page {page + 1} of {totalPages} &middot; {total.toLocaleString()} total events
          </span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page + 1 >= totalPages} style={{
            padding: '4px 12px', borderRadius: 4, fontSize: 12,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            color: 'var(--text-dim)', opacity: page + 1 >= totalPages ? 0.4 : 1,
          }}>Next</button>
          <input type="number" min={1} max={totalPages} placeholder="Go to"
            onKeyDown={e => { if (e.key === 'Enter') { const v = parseInt(e.target.value); if (v >= 1 && v <= totalPages) setPage(v - 1); }}}
            style={{
              width: 60, padding: '4px 6px', borderRadius: 4, fontSize: 12, textAlign: 'center',
              background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)',
            }} />
        </div>
      )}
    </div>
  )
}

