import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getCandidateDetail,
  getCandidateQueueSummary,
  getCandidateReviewQueue,
  submitBatchDecision,
  submitCandidateDecision,
} from '../api/client'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'

// W-56 Sessions 1+2 — Data Queue page.
// Classifies W-55's pending_review pool into approve / reject / defer.
// S1: header + paginated table + single-row decisions.
// S2: filter bar, slide-in detail panel (with rule trace + cola_enrichment
//     + audit history), batch checkboxes + modal.
// S3: acceptance testing.

const PAGE_SIZE = 50
const FILTER_DEBOUNCE_MS = 400

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

const TD = ({ children, style = {}, onClick }) => (
  <td onClick={onClick} style={{
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
const inputStyle = {
  background: 'var(--bg)', border: '1px solid var(--border)',
  color: 'var(--text)', borderRadius: 3, padding: '5px 8px', fontSize: 12,
}

function StatChip({ label, value, tone = 'dim' }) {
  const colors = {
    gold:  { bg: 'rgba(201,168,76,0.12)',  border: '#c9a84c',         text: '#c9a84c' },
    amber: { bg: 'rgba(125,211,252,0.10)', border: '#7dd3fc',         text: '#7dd3fc' },
    dim:   { bg: 'rgba(120,120,120,0.10)', border: 'var(--border)',   text: 'var(--text-dim)' },
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

  // Single-row action state
  const [actioning, setActioning] = useState(null)  // { id, decision }
  const [actionNote, setActionNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [flash, setFlash] = useState(null)          // { id, kind }

  // Filters
  const [filters, setFilters] = useState({ country: '', confidence: '', reason: '' })
  const [debouncedFilters, setDebouncedFilters] = useState(filters)

  // Detail panel
  const [detailId, setDetailId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Batch selection + modal
  const [selected, setSelected] = useState(() => new Set())
  const [batchDecision, setBatchDecision] = useState(null)  // 'approve'|'reject'|'defer'|null
  const [batchNote, setBatchNote] = useState('')
  const [batchSubmitting, setBatchSubmitting] = useState(false)

  // ── Debounce filters ────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedFilters(filters), FILTER_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [filters])

  // Reset offset when debounced filters change
  useEffect(() => { setOffset(0) }, [debouncedFilters])

  // Clear selection on page or filter change — avoid cross-page ghost select
  useEffect(() => { setSelected(new Set()) }, [offset, debouncedFilters])

  // Escape closes panel/modal
  useEffect(() => {
    const handler = e => {
      if (e.key !== 'Escape') return
      if (batchDecision) { setBatchDecision(null); setBatchNote('') }
      else if (detailId !== null) setDetailId(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [detailId, batchDecision])

  // ── Load queue + summary ────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = { limit: PAGE_SIZE, offset }
      if (debouncedFilters.country)    params.country    = debouncedFilters.country
      if (debouncedFilters.confidence) params.confidence = debouncedFilters.confidence
      if (debouncedFilters.reason)     params.reason     = debouncedFilters.reason
      const [s, q] = await Promise.all([
        getCandidateQueueSummary(),
        getCandidateReviewQueue(params),
      ])
      setSummary(s)
      setRows(q.rows || [])
      setTotal(q.total || 0)
    } catch (err) {
      setError(err.message || 'Failed to load data queue')
    } finally {
      setLoading(false)
    }
  }, [offset, debouncedFilters])

  useEffect(() => { load() }, [load, version])

  const refresh = () => setVersion(v => v + 1)

  // ── Detail panel fetch ──────────────────────────────────────────────────
  useEffect(() => {
    if (detailId === null) { setDetail(null); return }
    let cancelled = false
    setDetailLoading(true)
    getCandidateDetail(detailId)
      .then(d => { if (!cancelled) setDetail(d) })
      .catch(err => { if (!cancelled) alert(err.message || 'Detail fetch failed') })
      .finally(() => { if (!cancelled) setDetailLoading(false) })
    return () => { cancelled = true }
  }, [detailId])

  // ── Single-row decision handlers ────────────────────────────────────────
  const startAction = (row, decision) => {
    setActioning({ id: row.id, decision })
    setActionNote('')
  }
  const cancelAction = () => { setActioning(null); setActionNote('') }

  const submitAction = async () => {
    if (!actioning || !actionNote.trim()) return
    setSubmitting(true)
    try {
      await submitCandidateDecision(actioning.id, actioning.decision, actionNote.trim())
      if (actioning.decision === 'defer') {
        setFlash({ id: actioning.id, kind: 'deferred' })
        setTimeout(() => setFlash(null), 1500)
      } else {
        const removedId = actioning.id
        const targetKind = actioning.decision === 'approve' ? 'ready_to_promote' : 'rejected'
        setRows(prev => prev.filter(r => r.id !== removedId))
        setTotal(t => Math.max(0, t - 1))
        setSelected(prev => {
          const n = new Set(prev); n.delete(removedId); return n
        })
        setSummary(prev => prev ? {
          ...prev,
          counts: {
            ...prev.counts,
            pending_review: Math.max(0, prev.counts.pending_review - 1),
            [targetKind]: prev.counts[targetKind] + 1,
          },
        } : prev)
      }
      setActioning(null)
      setActionNote('')
    } catch (err) {
      alert(err.message || 'Decision submit failed')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Batch handlers ──────────────────────────────────────────────────────
  const toggleRowSelect = (id) => {
    setSelected(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  const visibleIds = useMemo(() => rows.map(r => r.id), [rows])
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selected.has(id))
  const someVisibleSelected = !allVisibleSelected && visibleIds.some(id => selected.has(id))

  const toggleSelectAllVisible = () => {
    setSelected(prev => {
      const n = new Set(prev)
      if (allVisibleSelected) {
        visibleIds.forEach(id => n.delete(id))
      } else {
        visibleIds.forEach(id => n.add(id))
      }
      return n
    })
  }

  const openBatchModal = (decision) => {
    if (selected.size === 0) return
    setBatchDecision(decision)
    setBatchNote('')
  }
  const cancelBatch = () => { setBatchDecision(null); setBatchNote('') }

  const submitBatch = async () => {
    if (!batchDecision || !batchNote.trim() || selected.size === 0) return
    setBatchSubmitting(true)
    try {
      const ids = Array.from(selected)
      const resp = await submitBatchDecision(ids, batchDecision, batchNote.trim())
      if (batchDecision === 'approve' || batchDecision === 'reject') {
        const targetKind = batchDecision === 'approve' ? 'ready_to_promote' : 'rejected'
        const touched = new Set(ids)
        setRows(prev => prev.filter(r => !touched.has(r.id)))
        setTotal(t => Math.max(0, t - resp.written))
        setSummary(prev => prev ? {
          ...prev,
          counts: {
            ...prev.counts,
            pending_review: Math.max(0, prev.counts.pending_review - resp.written),
            [targetKind]: prev.counts[targetKind] + resp.written,
          },
        } : prev)
      }
      // defer → rows stay, just clear selection
      setSelected(new Set())
      setBatchDecision(null)
      setBatchNote('')
    } catch (err) {
      alert(err.message || 'Batch submit failed')
    } finally {
      setBatchSubmitting(false)
    }
  }

  // ── Pagination derived state ────────────────────────────────────────────
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

      {/* Filter bar */}
      <Card style={{ padding: 12 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Country…"
            value={filters.country}
            onChange={e => setFilters(f => ({ ...f, country: e.target.value }))}
            style={{ ...inputStyle, minWidth: 160 }}
          />
          <select
            value={filters.confidence}
            onChange={e => setFilters(f => ({ ...f, confidence: e.target.value }))}
            style={{ ...inputStyle, minWidth: 140 }}
          >
            <option value="">All confidences</option>
            <option value="high">high</option>
            <option value="medium">medium</option>
            <option value="low">low</option>
          </select>
          <input
            type="text"
            placeholder="Reason keyword…"
            value={filters.reason}
            onChange={e => setFilters(f => ({ ...f, reason: e.target.value }))}
            style={{ ...inputStyle, minWidth: 220, flex: 1 }}
          />
          <button
            onClick={() => setFilters({ country: '', confidence: '', reason: '' })}
            style={{ ...btnBase, border: '1px solid var(--border)', color: 'var(--text-dim)' }}
          >Clear</button>
        </div>
      </Card>

      {/* Batch action bar (only when something selected) */}
      {selected.size > 0 && (
        <Card style={{ padding: 10 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 600 }}>
              {selected.size} selected
            </span>
            <div style={{ flex: 1 }} />
            <button onClick={() => openBatchModal('approve')} style={approveBtn}>Approve All</button>
            <button onClick={() => openBatchModal('reject')}  style={rejectBtn}>Reject All</button>
            <button onClick={() => openBatchModal('defer')}   style={deferBtn}>Defer All</button>
            <button onClick={() => setSelected(new Set())}    style={{ ...btnBase, border: '1px solid var(--border)', color: 'var(--text-dim)' }}>Clear</button>
          </div>
        </Card>
      )}

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
        <Card><EmptyState message="Queue clear — no pending_review candidates match your filters." /></Card>
      ) : (
        <>
          <Card>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <TH style={{ paddingLeft: 16, width: 36 }}>
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      ref={el => { if (el) el.indeterminate = someVisibleSelected }}
                      onChange={toggleSelectAllVisible}
                      aria-label="Select all on page"
                    />
                  </TH>
                  <TH>Confidence</TH>
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
                  const isSelected = selected.has(r.id)
                  const rowBg = isFlashing
                    ? 'rgba(125,211,252,0.06)'
                    : isActioning ? 'rgba(201,168,76,0.04)'
                    : isSelected  ? 'rgba(201,168,76,0.03)' : 'transparent'
                  const reasonShort = r.status_reason?.length > 60
                    ? r.status_reason.slice(0, 57) + '…'
                    : r.status_reason
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setDetailId(r.id)}
                      style={{ background: rowBg, transition: 'background 200ms', cursor: 'pointer' }}
                    >
                      <TD style={{ paddingLeft: 16 }} onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRowSelect(r.id)}
                          aria-label={`Select candidate ${r.id}`}
                        />
                      </TD>
                      <TD><ConfidenceChip confidence={r.confidence} /></TD>
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
                      <TD
                        style={{ paddingRight: 24, textAlign: 'right' }}
                        onClick={e => e.stopPropagation()}
                      >
                        {isActioning ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                            <input
                              type="text"
                              autoFocus
                              placeholder={`${actioning.decision} note (required)`}
                              value={actionNote}
                              onChange={e => setActionNote(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter')  submitAction()
                                if (e.key === 'Escape') cancelAction()
                              }}
                              style={{ ...inputStyle, fontSize: 11, minWidth: 220 }}
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

      {/* Detail panel — slide-in from right */}
      {detailId !== null && (
        <DetailPanel
          detail={detail}
          loading={detailLoading}
          onClose={() => setDetailId(null)}
        />
      )}

      {/* Batch confirmation modal */}
      {batchDecision && (
        <BatchConfirmModal
          decision={batchDecision}
          count={selected.size}
          note={batchNote}
          onNoteChange={setBatchNote}
          submitting={batchSubmitting}
          onConfirm={submitBatch}
          onCancel={cancelBatch}
        />
      )}
    </div>
  )
}

// ── Detail panel ────────────────────────────────────────────────────────────

function DetailPanel({ detail, loading, onClose }) {
  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.4)', zIndex: 199,
      }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 460,
        background: 'var(--bg-card)',
        borderLeft: '1px solid var(--border)',
        zIndex: 200,
        overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', gap: 12, alignItems: 'center',
          background: '#111', position: 'sticky', top: 0, zIndex: 1,
        }}>
          <button
            onClick={onClose}
            style={{ ...btnBase, border: '1px solid var(--border)', color: 'var(--text-dim)' }}
            aria-label="Close detail panel"
          >✕</button>
          <div style={{ fontSize: 13, color: 'var(--text)', flex: 1, minWidth: 0 }}>
            {detail ? (
              <>
                <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {detail.candidate.producer_name || '—'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic', fontFamily: 'var(--font-serif)' }}>
                  {detail.candidate.wine_name || '—'}
                </div>
              </>
            ) : <span style={{ color: 'var(--text-dim)' }}>Loading…</span>}
          </div>
        </div>

        {loading || !detail ? (
          <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}>
            <LoadingSpinner size="md" />
          </div>
        ) : (
          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <DetailSection title="Core fields">
              <DetailRow label="Country" value={detail.candidate.country_inferred} />
              <DetailRow label="Status" value={detail.candidate.status} />
              <DetailRow label="Confidence" value={<ConfidenceChip confidence={detail.candidate.confidence} />} />
              <DetailRow label="Classified at" value={
                detail.candidate.classified_at
                  ? new Date(detail.candidate.classified_at).toLocaleString()
                  : '—'
              } />
              <DetailRow label="Proposed region"
                value={detail.candidate.proposed_region_name || '—'} />
              <DetailRow label="Proposed grape"
                value={detail.candidate.proposed_grape_name || '—'} />
              <DetailRow label="Proposed tier"
                value={detail.candidate.proposed_production_tier || '—'} />
              <DetailRow label="TTB id"
                value={<span style={{ fontFamily: 'monospace', fontSize: 11 }}>{detail.candidate.ttb_id || '—'}</span>} />
            </DetailSection>

            <DetailSection title="Classification reason">
              <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.4 }}>
                {detail.candidate.status_reason || '—'}
              </div>
            </DetailSection>

            <DetailSection title="Rule trace">
              {Array.isArray(detail.candidate.rule_ids_applied) && detail.candidate.rule_ids_applied.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {detail.candidate.rule_ids_applied.map((rid, i) => (
                    <span key={i} style={{
                      background: 'rgba(120,120,120,0.12)',
                      border: '1px solid var(--border)',
                      borderRadius: 3, padding: '2px 6px',
                      fontSize: 10, fontFamily: 'monospace',
                      color: 'var(--text-dim)',
                    }}>{rid}</span>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>No rules recorded.</div>
              )}
            </DetailSection>

            <DetailSection title="COLA enrichment">
              {detail.cola_enrichment ? (
                <>
                  <DetailRow label="Brand"        value={detail.cola_enrichment.brand_name} />
                  <DetailRow label="Product"      value={detail.cola_enrichment.product_name} />
                  <DetailRow label="Appellation"  value={detail.cola_enrichment.wine_appellation || '—'} />
                  <DetailRow label="Origin"       value={detail.cola_enrichment.origin_name || '—'} />
                  <DetailRow label="Grape varietals" value={
                    Array.isArray(detail.cola_enrichment.grape_varietals)
                      ? detail.cola_enrichment.grape_varietals.join(', ')
                      : (detail.cola_enrichment.grape_varietals || '—')
                  } />
                  <DetailRow label="Designation" value={detail.cola_enrichment.llm_wine_designation || '—'} />
                  <DetailRow label="Match score" value={
                    detail.cola_enrichment.match_score != null
                      ? <span style={{ fontFamily: 'monospace' }}>{detail.cola_enrichment.match_score}</span>
                      : '—'
                  } />
                </>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                  No COLA enrichment — missing_enrichment gate applies.
                </div>
              )}
            </DetailSection>

            <DetailSection title={`Audit history (${detail.audit_history.length})`}>
              {detail.audit_history.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>No audit history.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {detail.audit_history.map(a => (
                    <div key={a.id} style={{
                      fontSize: 11, padding: '6px 8px',
                      border: '1px solid var(--border)', borderRadius: 3,
                      background: 'rgba(120,120,120,0.04)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-dim)' }}>
                        <span style={{ fontFamily: 'monospace' }}>
                          {a.field_name}: {a.old_value ?? '∅'} → {a.new_value ?? '∅'}
                        </span>
                        <span>{a.changed_at ? new Date(a.changed_at).toLocaleString() : '—'}</span>
                      </div>
                      <div style={{ color: 'var(--text)', marginTop: 2 }}>{a.note || ''}</div>
                      <div style={{ color: 'var(--text-dim)', fontSize: 10, marginTop: 2 }}>
                        by {a.operator} via {a.script_name}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </DetailSection>
          </div>
        )}
      </div>
    </>
  )
}

function DetailSection({ title, children }) {
  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: 'var(--text-dim)',
        marginBottom: 6,
      }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{children}</div>
    </div>
  )
}

function DetailRow({ label, value }) {
  return (
    <div style={{ display: 'flex', fontSize: 12, gap: 10 }}>
      <div style={{ color: 'var(--text-dim)', minWidth: 120 }}>{label}</div>
      <div style={{ color: 'var(--text)', flex: 1, wordBreak: 'break-word' }}>
        {value == null || value === '' ? '—' : value}
      </div>
    </div>
  )
}

// ── Batch confirmation modal ────────────────────────────────────────────────

function BatchConfirmModal({ decision, count, note, onNoteChange, submitting, onConfirm, onCancel }) {
  const decisionBtn = decision === 'approve' ? approveBtn : decision === 'reject' ? rejectBtn : deferBtn
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)',
    }} onClick={onCancel}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 8, padding: 24, width: 380, display: 'flex',
          flexDirection: 'column', gap: 12,
        }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
          Apply <span style={{ color: 'var(--gold)' }}>{decision}</span> to {count.toLocaleString()} candidate{count === 1 ? '' : 's'}
        </div>
        <input
          type="text"
          autoFocus
          placeholder={`${decision} note (required for all ${count} rows)`}
          value={note}
          onChange={e => onNoteChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter')  onConfirm()
            if (e.key === 'Escape') onCancel()
          }}
          style={{ ...inputStyle, padding: '8px 10px' }}
        />
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          {decision === 'defer'
            ? 'Deferred rows stay in the queue; the note is logged.'
            : `Rows will move to ${decision === 'approve' ? 'ready_to_promote' : 'rejected'}. This cannot be undone from this page.`}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ ...btnBase, border: '1px solid var(--border)', color: 'var(--text-dim)' }}>Cancel</button>
          <button
            onClick={onConfirm}
            disabled={submitting || !note.trim()}
            style={decisionBtn}
          >{submitting ? 'Submitting…' : `Confirm ${decision}`}</button>
        </div>
      </div>
    </div>
  )
}
