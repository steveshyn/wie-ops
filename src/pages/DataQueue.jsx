import { useCallback, useEffect, useState } from 'react'
import {
  getCandidateQueueSummary,
  getCandidateReviewQueue,
  submitCandidateDecision,
} from '../api/client'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'

// W-56 Session 1 — Data Queue page.
// Classifies W-55's pending_review pool into approve / reject / defer.
// Detail panel + batch actions + filters ship in Sessions 2 & 3.

const PAGE_SIZE = 50

const CONFIDENCE_STYLES = {
  high:   { bg: 'rgba(201,168,76,0.15)', border: '#c9a84c', text: '#c9a84c' },
  medium: { bg: 'rgba(125,211,252,0.10)', border: '#7dd3fc', text: '#7dd3fc' },
  low:    { bg: 'rgba(120,120,120,0.15)', border: '#666',    text: '#9e8e7e' },
}

const Card = ({ children, style = {} }) => (
  <div style={{
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: 0,
    overflow: 'hidden',
    ...style,
  }}>{children}</div>
)

const TH = ({ children, style = {} }) => (
  <th style={{
    padding: '10px 14px', textAlign: 'left', fontSize: 10,
    fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
    color: 'var(--text-dim)', background: '#111',
    whiteSpace: 'nowrap', ...style,
  }}>{children}</th>
)

const TD = ({ children, style = {} }) => (
  <td style={{
    padding: '10px 14px', fontSize: 12,
    borderTop: '1px solid var(--border)', ...style,
  }}>{children}</td>
)

function ConfidenceChip({ confidence }) {
  const s = CONFIDENCE_STYLES[confidence] || CONFIDENCE_STYLES.low
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: '2px 7px',
      borderRadius: 10, background: s.bg,
      border: `1px solid ${s.border}`, color: s.text,
      display: 'inline-block', textTransform: 'uppercase',
      letterSpacing: '0.06em',
    }}>{confidence || '—'}</span>
  )
}

const btnBase = {
  padding: '5px 10px', fontSize: 10, fontWeight: 500,
  background: 'transparent', borderRadius: 3, cursor: 'pointer',
}
const approveBtn = { ...btnBase, border: '1px solid var(--gold)', color: 'var(--gold)' }
const rejectBtn  = { ...btnBase, border: '1px solid var(--red)',  color: 'var(--red)' }
const deferBtn   = { ...btnBase, border: '1px solid var(--border)', color: 'var(--text-dim)' }

function StatChip({ label, value, tone = 'dim' }) {
  const colors = {
    gold: { bg: 'rgba(201,168,76,0.12)', border: '#c9a84c', text: '#c9a84c' },
    amber: { bg: 'rgba(125,211,252,0.10)', border: '#7dd3fc', text: '#7dd3fc' },
    dim: { bg: 'rgba(120,120,120,0.10)', border: 'var(--border)', text: 'var(--text-dim)' },
  }
  const c = colors[tone] || colors.dim
  return (
    <span style={{
      fontSize: 11, padding: '4px 10px', borderRadius: 4,
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      whiteSpace: 'nowrap',
    }}>
      <strong style={{ fontWeight: 600 }}>{label}:</strong> {value?.toLocaleString?.() ?? value ?? '—'}
    </span>
  )
}

export default function DataQueue() {
  const [summary, setSummary] = useState(null)
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [version, setVersion] = useState(0)

  const [actioning, setActioning] = useState(null)  // { id, decision }
  const [actionNote, setActionNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [flash, setFlash] = useState(null)          // { id, kind }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [s, q] = await Promise.all([
        getCandidateQueueSummary(),
        getCandidateReviewQueue({ limit: PAGE_SIZE, offset }),
      ])
      setSummary(s)
      setRows(q.rows || [])
      setTotal(q.total || 0)
    } catch (err) {
      setError(err.message || 'Failed to load data queue')
    } finally {
      setLoading(false)
    }
  }, [offset])

  useEffect(() => { load() }, [load, version])

  const refresh = () => setVersion(v => v + 1)

  const startAction = (row, decision) => {
    setActioning({ id: row.id, decision })
    setActionNote('')
  }

  const cancelAction = () => {
    setActioning(null)
    setActionNote('')
  }

  const submitAction = async () => {
    if (!actioning || !actionNote.trim()) return
    setSubmitting(true)
    try {
      await submitCandidateDecision(
        actioning.id,
        actioning.decision,
        actionNote.trim(),
      )
      if (actioning.decision === 'defer') {
        setFlash({ id: actioning.id, kind: 'deferred' })
        setTimeout(() => setFlash(null), 1500)
        setActioning(null)
        setActionNote('')
        // Row stays in queue on defer; no total adjustment needed.
        return
      }
      // Approve / reject: remove row from view, adjust summary counts.
      const removedId = actioning.id
      const kind = actioning.decision === 'approve' ? 'ready_to_promote' : 'rejected'
      setRows(prev => prev.filter(r => r.id !== removedId))
      setTotal(t => Math.max(0, t - 1))
      setSummary(prev => prev ? {
        ...prev,
        counts: {
          ...prev.counts,
          pending_review: Math.max(0, prev.counts.pending_review - 1),
          [kind]: prev.counts[kind] + 1,
        },
      } : prev)
      setActioning(null)
      setActionNote('')
    } catch (err) {
      alert(err.message || 'Decision submit failed')
    } finally {
      setSubmitting(false)
    }
  }

  const page = offset / PAGE_SIZE + 1
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rangeStart = total === 0 ? 0 : offset + 1
  const rangeEnd = Math.min(offset + rows.length, total)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <Card style={{ padding: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <StatChip label="pending_review" value={summary?.counts?.pending_review} tone="gold" />
          <StatChip label="ready_to_promote" value={summary?.counts?.ready_to_promote} tone="amber" />
          <StatChip label="rejected" value={summary?.counts?.rejected} tone="dim" />
          <StatChip label="total" value={summary?.counts?.total} tone="dim" />
          <div style={{ flex: 1 }} />
          <button onClick={refresh} style={{ ...btnBase, border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
            Refresh
          </button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 10, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <span>
            <strong>Last classified:</strong>{' '}
            {summary?.last_classified_at
              ? new Date(summary.last_classified_at).toLocaleString()
              : '—'}
          </span>
          {summary?.top_reasons?.[0] && (
            <span>
              <strong>Top reason:</strong> {summary.top_reasons[0].reason}{' '}
              ({summary.top_reasons[0].count.toLocaleString()})
            </span>
          )}
        </div>
      </Card>

      {loading ? (
        <div style={{ padding: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--text-dim)' }}>
          <LoadingSpinner size="md" /> Loading data queue…
        </div>
      ) : error ? (
        <div style={{
          background: 'rgba(220,38,38,0.08)', border: '1px solid var(--red)',
          borderRadius: 8, padding: '12px 16px', color: 'var(--red)', fontSize: 13,
        }}>{error}</div>
      ) : rows.length === 0 ? (
        <Card><EmptyState message="Queue clear — no pending_review candidates." /></Card>
      ) : (
        <>
          <Card>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <TH style={{ paddingLeft: 24 }}>Confidence</TH>
                  <TH>Producer</TH>
                  <TH>Wine</TH>
                  <TH>Country</TH>
                  <TH>Reason</TH>
                  <TH>Rules</TH>
                  <TH>Proposed Tier</TH>
                  <TH style={{ paddingRight: 24, textAlign: 'right' }}>Actions</TH>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const isActioning = actioning?.id === r.id
                  const isFlashing = flash?.id === r.id
                  const rowBg = isFlashing
                    ? 'rgba(125,211,252,0.06)'
                    : isActioning ? 'rgba(201,168,76,0.04)' : 'transparent'
                  const reasonShort = r.status_reason?.length > 60
                    ? r.status_reason.slice(0, 57) + '…'
                    : r.status_reason
                  return (
                    <tr key={r.id} style={{ background: rowBg, transition: 'background 200ms' }}>
                      <TD style={{ paddingLeft: 24 }}><ConfidenceChip confidence={r.confidence} /></TD>
                      <TD style={{ color: 'var(--text)' }}>{r.producer_name || '—'}</TD>
                      <TD style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>{r.wine_name || '—'}</TD>
                      <TD style={{ color: 'var(--text-dim)' }}>{r.country_inferred || '—'}</TD>
                      <TD style={{ color: 'var(--text-dim)', maxWidth: 280 }} title={r.status_reason || ''}>
                        {reasonShort || '—'}
                      </TD>
                      <TD style={{ fontFamily: 'monospace', color: 'var(--text-dim)', fontSize: 11 }}>
                        {Array.isArray(r.rule_ids_applied) ? `${r.rule_ids_applied.length} rule${r.rule_ids_applied.length === 1 ? '' : 's'}` : '—'}
                      </TD>
                      <TD style={{ color: 'var(--text-dim)', fontFamily: 'monospace', fontSize: 11 }}>
                        {r.proposed_production_tier || '—'}
                      </TD>
                      <TD style={{ paddingRight: 24, textAlign: 'right' }}>
                        {isActioning ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                            <input
                              type="text"
                              autoFocus
                              placeholder={`${actioning.decision} note (required)`}
                              value={actionNote}
                              onChange={e => setActionNote(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') submitAction()
                                if (e.key === 'Escape') cancelAction()
                              }}
                              style={{
                                fontSize: 11, padding: '4px 8px',
                                background: 'var(--bg)', border: '1px solid var(--border)',
                                color: 'var(--text)', borderRadius: 3, minWidth: 220,
                              }}
                            />
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button
                                onClick={submitAction}
                                disabled={submitting || !actionNote.trim()}
                                style={
                                  actioning.decision === 'approve' ? approveBtn
                                  : actioning.decision === 'reject' ? rejectBtn
                                  : deferBtn
                                }
                              >{submitting ? '…' : 'Confirm'}</button>
                              <button onClick={cancelAction} style={deferBtn}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                            <button onClick={() => startAction(r, 'approve')} style={approveBtn}>Approve</button>
                            <button onClick={() => startAction(r, 'reject')}  style={rejectBtn}>Reject</button>
                            <button onClick={() => startAction(r, 'defer')}   style={deferBtn}>Defer</button>
                          </div>
                        )}
                      </TD>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>

          {/* Pagination */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontSize: 12, color: 'var(--text-dim)', padding: '0 4px',
          }}>
            <span>
              Showing {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()} of {total.toLocaleString()}
            </span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={() => setOffset(o => Math.max(0, o - PAGE_SIZE))}
                disabled={offset === 0}
                style={{ ...btnBase, border: '1px solid var(--border)', color: 'var(--text-dim)', opacity: offset === 0 ? 0.4 : 1 }}
              >‹ Previous</button>
              <span style={{ fontFamily: 'monospace' }}>{page} / {pageCount}</span>
              <button
                onClick={() => setOffset(o => (o + PAGE_SIZE < total ? o + PAGE_SIZE : o))}
                disabled={offset + PAGE_SIZE >= total}
                style={{ ...btnBase, border: '1px solid var(--border)', color: 'var(--text-dim)', opacity: offset + PAGE_SIZE >= total ? 0.4 : 1 }}
              >Next ›</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
