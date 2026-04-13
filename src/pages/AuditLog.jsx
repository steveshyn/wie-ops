import { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import { getAuditLog, getAuditTables } from '../api/client'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'

const PAGE_SIZE = 50
const MAX_VALUE_CHARS = 40

// ── Operator colors (per ARCH-001 spec) ──────────────────────────────────────
const OPERATOR_STYLES = {
  steve: {
    bg:     'rgba(201,168,76,0.15)',
    border: '#c9a84c',
    text:   '#c9a84c',
  },
  claude_code: {
    bg:     'rgba(56,189,248,0.12)',
    border: '#38bdf8',
    text:   '#7dd3fc',
  },
  pipeline_auto: {
    bg:     'rgba(120,120,120,0.15)',
    border: '#666',
    text:   '#9e8e7e',
  },
}

const OPERATOR_OPTIONS = ['', 'steve', 'claude_code', 'pipeline_auto']

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(isoStr) {
  if (!isoStr) return '—'
  const diff = Date.now() - new Date(isoStr).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60)    return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60)    return `${m} minute${m > 1 ? 's' : ''} ago`
  const h = Math.floor(m / 60)
  if (h < 24)    return `${h} hour${h > 1 ? 's' : ''} ago`
  const d = Math.floor(h / 24)
  if (d < 30)    return `${d} day${d > 1 ? 's' : ''} ago`
  return new Date(isoStr).toLocaleDateString('en-US',
    { month: 'short', day: 'numeric', year: 'numeric' })
}

function fullTimestamp(isoStr) {
  if (!isoStr) return ''
  return new Date(isoStr).toLocaleString('en-US', { hour12: false })
}

function truncate(s, n = MAX_VALUE_CHARS) {
  if (s == null) return ''
  const str = String(s)
  return str.length > n ? str.slice(0, n) + '…' : str
}

function isoDateInput(daysAgo) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

function csvEscape(val) {
  if (val == null) return ''
  const s = String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function rowsToCsv(rows) {
  const headers = [
    'id', 'changed_at', 'session_id', 'operator', 'table_name',
    'record_id', 'field_name', 'old_value', 'new_value', 'script_name', 'note',
  ]
  const lines = [headers.join(',')]
  for (const r of rows) {
    lines.push(headers.map(h => csvEscape(r[h])).join(','))
  }
  return lines.join('\n')
}

function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Design primitives (matched from LookupTables) ────────────────────────────

const TH = ({ children, style = {} }) => (
  <th style={{
    padding: '10px 16px', textAlign: 'left', fontSize: 10,
    fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
    color: 'var(--text-dim)', userSelect: 'none', background: '#111',
    whiteSpace: 'nowrap', ...style,
  }}>
    {children}
  </th>
)

const TD = ({ children, style = {} }) => (
  <td style={{
    padding: '11px 16px', fontSize: 13, verticalAlign: 'top',
    borderTop: '1px solid var(--border)', ...style,
  }}>{children}</td>
)

function OperatorChip({ operator }) {
  const s = OPERATOR_STYLES[operator] || OPERATOR_STYLES.pipeline_auto
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '2px 8px',
      borderRadius: 10, letterSpacing: '0.04em',
      background: s.bg, border: `1px solid ${s.border}`, color: s.text,
      display: 'inline-block', whiteSpace: 'nowrap',
    }}>
      {operator}
    </span>
  )
}

function FieldCell({ row }) {
  if (!row.field_name) {
    return (
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
        padding: '2px 6px', borderRadius: 3,
        background: 'rgba(22,163,74,0.15)',
        border: '1px solid var(--green)',
        color: 'var(--green-light)',
      }}>
        INSERT
      </span>
    )
  }
  return <span style={{ color: 'var(--text)', fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>{row.field_name}</span>
}

function ValueDiffCell({ row }) {
  // Insert event — no field, just badge
  if (!row.field_name && !row.old_value) {
    return (
      <span style={{
        fontSize: 10, fontWeight: 700,
        padding: '2px 6px', borderRadius: 3,
        background: 'rgba(22,163,74,0.15)',
        border: '1px solid var(--green)',
        color: 'var(--green-light)',
      }}>
        NEW
      </span>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {row.old_value != null && (
        <span style={{
          textDecoration: 'line-through',
          color: '#a85050',
          fontSize: 12,
          fontFamily: 'monospace',
        }}>
          {truncate(row.old_value)}
        </span>
      )}
      {row.new_value != null && (
        <span style={{
          color: 'var(--green-light)',
          fontSize: 12,
          fontFamily: 'monospace',
        }}>
          {truncate(row.new_value)}
        </span>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AuditLog() {
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filters
  const [filterOperator, setFilterOperator] = useState('')
  const [filterTable, setFilterTable] = useState('')
  const [filterFrom, setFilterFrom] = useState(isoDateInput(7))
  const [filterTo, setFilterTo] = useState(isoDateInput(0))
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [expandedId, setExpandedId] = useState(null)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getAuditLog({
        tableName: filterTable || undefined,
        operator:  filterOperator || undefined,
        limit:     PAGE_SIZE,
        offset:    page * PAGE_SIZE,
        from_date: filterFrom || undefined,
        to_date:   filterTo || undefined,
      })
      setRows(data.rows || [])
      setTotal(data.total || 0)
    } catch (err) {
      setError(err.message || 'Failed to load audit log')
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [filterOperator, filterTable, filterFrom, filterTo, page])

  const fetchTables = useCallback(async () => {
    try {
      const data = await getAuditTables()
      setTables(data.tables || [])
    } catch {
      // non-fatal
    }
  }, [])

  useEffect(() => { fetchRows() },   [fetchRows])
  useEffect(() => { fetchTables() }, [fetchTables])

  // Reset page when filters change
  useEffect(() => { setPage(0) }, [filterOperator, filterTable, filterFrom, filterTo, search])

  // Client-side date + search filter on the loaded page
  const visibleRows = useMemo(() => {
    let out = rows
    if (filterFrom) {
      const fromMs = new Date(filterFrom + 'T00:00:00').getTime()
      out = out.filter(r => new Date(r.changed_at).getTime() >= fromMs)
    }
    if (filterTo) {
      const toMs = new Date(filterTo + 'T23:59:59').getTime()
      out = out.filter(r => new Date(r.changed_at).getTime() <= toMs)
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      out = out.filter(r =>
        (r.note || '').toLowerCase().includes(q) ||
        (r.script_name || '').toLowerCase().includes(q)
      )
    }
    return out
  }, [rows, filterFrom, filterTo, search])

  const clearFilters = () => {
    setFilterOperator('')
    setFilterTable('')
    setFilterFrom(isoDateInput(7))
    setFilterTo(isoDateInput(0))
    setSearch('')
    setPage(0)
  }

  const handleExport = () => {
    const csv = rowsToCsv(visibleRows)
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    downloadCsv(`wie_audit_log_${ts}.csv`, csv)
  }

  const showingFrom = total === 0 ? 0 : page * PAGE_SIZE + 1
  const showingTo   = Math.min(total, page * PAGE_SIZE + visibleRows.length)
  const totalPages  = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const canPrev     = page > 0
  const canNext     = (page + 1) * PAGE_SIZE < total

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Filter bar */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '16px 20px',
        display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 14,
      }}>
        <FilterField label="Operator" minWidth={140}>
          <select value={filterOperator} onChange={e => setFilterOperator(e.target.value)}>
            {OPERATOR_OPTIONS.map(op => (
              <option key={op || 'all'} value={op}>{op || 'All operators'}</option>
            ))}
          </select>
        </FilterField>

        <FilterField label="Table" minWidth={180}>
          <select value={filterTable} onChange={e => setFilterTable(e.target.value)}>
            <option value="">All tables</option>
            {tables.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </FilterField>

        <FilterField label="From" minWidth={140}>
          <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
        </FilterField>

        <FilterField label="To" minWidth={140}>
          <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} />
        </FilterField>

        <FilterField label="Search note / script" minWidth={220}>
          <input
            type="text"
            placeholder="filter by note or script"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </FilterField>

        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <button onClick={clearFilters} style={ghostBtn}>Clear filters</button>
          <button onClick={handleExport} disabled={visibleRows.length === 0} style={{
            ...ghostBtn,
            opacity: visibleRows.length === 0 ? 0.4 : 1,
            cursor: visibleRows.length === 0 ? 'not-allowed' : 'pointer',
          }}>
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        overflow: 'hidden',
      }}>
        {loading && rows.length === 0 ? (
          <div style={{ padding: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--text-dim)' }}>
            <LoadingSpinner size="md" /> Loading audit log…
          </div>
        ) : error ? (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <div style={{
              color: 'var(--red)', fontSize: 13, marginBottom: 16,
              background: 'rgba(220,38,38,0.08)', border: '1px solid var(--red)',
              borderRadius: 4, padding: '12px 16px', display: 'inline-block',
            }}>
              {error}
            </div>
            <div>
              <button onClick={fetchRows} style={ghostBtn}>Retry</button>
            </div>
          </div>
        ) : visibleRows.length === 0 ? (
          <div style={{ padding: '12px 0' }}>
            <EmptyState
              message="No audit rows match these filters. Try widening the date range, clearing filters, or running a recompute."
            />
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
            <thead>
              <tr>
                <TH>Time</TH>
                <TH>Operator</TH>
                <TH>Table</TH>
                <TH>Record ID</TH>
                <TH>Field</TH>
                <TH>Old → New</TH>
                <TH>Script</TH>
                <TH>Note</TH>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map(r => {
                const expanded = expandedId === r.id
                return (
                  <Fragment key={r.id}>
                    <tr
                      onClick={() => setExpandedId(expanded ? null : r.id)}
                      style={{
                        cursor: 'pointer',
                        background: expanded ? 'var(--bg-hover)' : 'transparent',
                      }}
                      onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                      onMouseLeave={e => { if (!expanded) e.currentTarget.style.background = 'transparent' }}
                    >
                      <TD>
                        <span title={fullTimestamp(r.changed_at)} style={{ color: 'var(--text-dim)' }}>
                          {timeAgo(r.changed_at)}
                        </span>
                      </TD>
                      <TD><OperatorChip operator={r.operator} /></TD>
                      <TD style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text)' }}>
                        {r.table_name}
                      </TD>
                      <TD style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-dim)' }}>
                        {r.record_id != null ? r.record_id : '—'}
                      </TD>
                      <TD><FieldCell row={r} /></TD>
                      <TD><ValueDiffCell row={r} /></TD>
                      <TD style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-dim)' }}>
                        {truncate(r.script_name, 30)}
                      </TD>
                      <TD style={{ color: 'var(--text-dim)', fontSize: 12 }}>
                        {truncate(r.note, 30)}
                      </TD>
                    </tr>
                    {expanded && (
                      <tr style={{ background: '#0f0f0f' }}>
                        <td colSpan={8} style={{ padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
                          <DetailGrid row={r} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {total > 0 && !error && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 4px',
        }}>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            Showing {showingFrom}–{showingTo} of {total.toLocaleString()} changes
            {visibleRows.length !== rows.length && (
              <span> (filtered from {rows.length} on this page)</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={!canPrev}
              style={{ ...ghostBtn, opacity: canPrev ? 1 : 0.4, cursor: canPrev ? 'pointer' : 'not-allowed' }}
            >
              ← Previous
            </button>
            <span style={{ fontSize: 12, color: 'var(--text-dim)', minWidth: 80, textAlign: 'center' }}>
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={!canNext}
              style={{ ...ghostBtn, opacity: canNext ? 1 : 0.4, cursor: canNext ? 'pointer' : 'not-allowed' }}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Local components ─────────────────────────────────────────────────────────

function FilterField({ label, minWidth, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth }}>
      <label style={{
        fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: 'var(--text-dim)',
      }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function DetailGrid({ row }) {
  const fields = [
    ['ID',          row.id],
    ['Time',        fullTimestamp(row.changed_at)],
    ['Session',     row.session_id],
    ['Operator',    row.operator],
    ['Table',       row.table_name],
    ['Record ID',   row.record_id],
    ['Field',       row.field_name || '(insert)'],
    ['Old value',   row.old_value],
    ['New value',   row.new_value],
    ['Script',      row.script_name],
    ['Note',        row.note],
  ]
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '140px 1fr',
      rowGap: 8, columnGap: 16,
      fontSize: 12,
    }}>
      {fields.map(([label, value]) => (
        <Fragment key={label}>
          <div style={{
            color: 'var(--text-dim)', fontWeight: 600,
            letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: 10,
          }}>
            {label}
          </div>
          <div style={{
            color: 'var(--text)', fontFamily: 'monospace',
            wordBreak: 'break-word', whiteSpace: 'pre-wrap',
          }}>
            {value == null || value === '' ? '—' : String(value)}
          </div>
        </Fragment>
      ))}
    </div>
  )
}

const ghostBtn = {
  padding: '8px 14px',
  fontSize: 12, fontWeight: 500,
  background: 'transparent',
  border: '1px solid var(--gold)',
  borderRadius: 4,
  color: 'var(--gold)',
}
