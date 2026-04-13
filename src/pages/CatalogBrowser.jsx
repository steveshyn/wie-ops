import { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  getAdminFamilies, getAdminFamily, updateAdminFamily,
  retireFamily, recomputeFamily,
  overridePillar, deletePillarOverride, overridePrestige,
} from '../api/client'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import HelpTip from '../components/HelpTip'

const PAGE_SIZE = 50

const TIER_STYLES = {
  exceptional:   { bg: 'rgba(201,168,76,0.15)',  border: '#c9a84c', text: '#c9a84c', label: 'Exceptional' },
  distinguished: { bg: 'rgba(74,158,142,0.15)',  border: '#4a9e8e', text: '#7ed4c4', label: 'Distinguished' },
  quality:       { bg: 'rgba(22,163,74,0.12)',   border: '#16a34a', text: '#4ade80', label: 'Quality' },
  standard:      { bg: 'rgba(102,102,102,0.15)', border: '#666',    text: '#9e8e7e', label: 'Standard' },
  basic:         { bg: 'rgba(127,29,29,0.12)',   border: '#7f1d1d', text: '#f87171', label: 'Basic' },
}

const TIERS = ['exceptional', 'distinguished', 'quality', 'standard', 'basic']

const COUNTRY_OPTIONS = [
  '', 'France', 'Italy', 'USA', 'Spain', 'Germany', 'Australia',
]

const SORT_OPTIONS = [
  { value: 'wiqs_score_desc', label: 'WIQS ↓' },
  { value: 'wiqs_score_asc',  label: 'WIQS ↑' },
  { value: 'wine_name_asc',   label: 'Name A–Z' },
  { value: 'updated_at_desc', label: 'Recently Updated' },
]

const OPERATOR_STYLES = {
  steve:         { bg: 'rgba(201,168,76,0.15)', border: '#c9a84c', text: '#c9a84c' },
  claude_code:   { bg: 'rgba(56,189,248,0.12)', border: '#38bdf8', text: '#7dd3fc' },
  pipeline_auto: { bg: 'rgba(120,120,120,0.15)', border: '#666',    text: '#9e8e7e' },
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60)    return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60)    return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)    return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function useDebounced(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

// ── Design primitives ────────────────────────────────────────────────────────

const Card = ({ children, style = {} }) => (
  <div style={{
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '20px 24px',
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

function TierBadge({ tier }) {
  if (!tier) return <span style={{ color: 'var(--text-dim)' }}>—</span>
  const s = TIER_STYLES[tier] || TIER_STYLES.standard
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: '3px 8px',
      borderRadius: 10, letterSpacing: '0.04em',
      background: s.bg, border: `1px solid ${s.border}`, color: s.text,
      textTransform: 'uppercase', display: 'inline-block',
    }}>
      {s.label}
    </span>
  )
}

function TierPill({ tier, active, onClick }) {
  const s = TIER_STYLES[tier]
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 11, fontWeight: 600, padding: '5px 10px',
        borderRadius: 12, letterSpacing: '0.04em',
        background: active ? s.bg : 'transparent',
        border: `1px solid ${active ? s.border : '#333'}`,
        color: active ? s.text : 'var(--text-dim)',
        textTransform: 'uppercase', cursor: 'pointer',
        transition: 'all 150ms',
      }}
    >
      {s.label}
    </button>
  )
}

function OperatorChip({ operator }) {
  const s = OPERATOR_STYLES[operator] || OPERATOR_STYLES.pipeline_auto
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: '2px 7px',
      borderRadius: 10, background: s.bg,
      border: `1px solid ${s.border}`, color: s.text,
      display: 'inline-block', whiteSpace: 'nowrap',
    }}>{operator}</span>
  )
}

const ghostBtn = {
  padding: '6px 12px', fontSize: 11, fontWeight: 500,
  background: 'transparent', border: '1px solid var(--gold)',
  borderRadius: 4, color: 'var(--gold)', cursor: 'pointer',
}

const goldBtn = {
  padding: '8px 14px', fontSize: 12, fontWeight: 600,
  background: 'var(--gold)', border: '1px solid var(--gold)',
  borderRadius: 4, color: '#0d0d0d', cursor: 'pointer',
}

const redBtn = {
  padding: '8px 14px', fontSize: 12, fontWeight: 600,
  background: 'transparent', border: '1px solid var(--red)',
  borderRadius: 4, color: 'var(--red)', cursor: 'pointer',
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CatalogBrowser() {
  const [searchParams] = useSearchParams()

  const [q, setQ]               = useState('')
  const [country, setCountry]   = useState('')
  const [selectedTiers, setSelectedTiers] = useState(() => {
    const t = searchParams.get('tier')
    return t ? [t] : []
  })
  const [sort, setSort]         = useState('wiqs_score_desc')
  const [lwinFilter, setLwinFilter] = useState(searchParams.get('lwin') || '')

  const [page, setPage]         = useState(0)
  const [rows, setRows]         = useState([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  const [selectedFamilyId, setSelectedFamilyId] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const debouncedQ = useDebounced(q, 300)

  const fetchFamilies = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const tier = selectedTiers.length === 1 ? selectedTiers[0] : undefined
      const data = await getAdminFamilies({
        q:       debouncedQ || undefined,
        country: country || undefined,
        tier,
        lwin:    lwinFilter || undefined,
        sort,
        limit:   PAGE_SIZE,
        offset:  page * PAGE_SIZE,
      })
      setRows(data.families || [])
      setTotal(data.total || 0)
    } catch (err) {
      setError(err.message || 'Failed to load catalog')
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [debouncedQ, country, selectedTiers, sort, lwinFilter, page])

  useEffect(() => { fetchFamilies() }, [fetchFamilies])
  useEffect(() => { setPage(0) }, [debouncedQ, country, selectedTiers, sort, lwinFilter])

  const toggleTier = (t) => {
    setSelectedTiers(prev => prev.includes(t) ? prev.filter(x => x !== t) : [t])
  }

  const openDrawer = (familyId) => {
    setSelectedFamilyId(familyId)
    setDrawerOpen(true)
  }

  const closeDrawer = () => {
    setDrawerOpen(false)
    setTimeout(() => setSelectedFamilyId(null), 200)
  }

  const showingFrom = total === 0 ? 0 : page * PAGE_SIZE + 1
  const showingTo   = Math.min(total, page * PAGE_SIZE + rows.length)
  const totalPages  = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const canPrev     = page > 0
  const canNext     = (page + 1) * PAGE_SIZE < total

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Filter bar */}
      <Card style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <label style={labelStyle}>Search</label>
            <input
              type="text"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search wine or producer…"
            />
          </div>
          <div style={{ minWidth: 160 }}>
            <label style={labelStyle}>Country</label>
            <select value={country} onChange={e => setCountry(e.target.value)}>
              {COUNTRY_OPTIONS.map(c => (
                <option key={c || 'all'} value={c}>{c || 'All countries'}</option>
              ))}
            </select>
          </div>
          <div style={{ minWidth: 180 }}>
            <label style={labelStyle}>Sort</label>
            <select value={sort} onChange={e => setSort(e.target.value)}>
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          {lwinFilter && (
            <div>
              <button onClick={() => setLwinFilter('')} style={ghostBtn}>
                Clear LWIN filter
              </button>
            </div>
          )}
        </div>

        <div style={{ marginTop: 14, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            onClick={() => setSelectedTiers([])}
            style={{
              fontSize: 11, fontWeight: 600, padding: '5px 10px',
              borderRadius: 12, letterSpacing: '0.04em',
              background: selectedTiers.length === 0 ? 'rgba(201,168,76,0.1)' : 'transparent',
              border: `1px solid ${selectedTiers.length === 0 ? 'var(--gold)' : '#333'}`,
              color: selectedTiers.length === 0 ? 'var(--gold)' : 'var(--text-dim)',
              textTransform: 'uppercase', cursor: 'pointer',
            }}
          >
            All
          </button>
          {TIERS.map(t => (
            <TierPill
              key={t}
              tier={t}
              active={selectedTiers.includes(t)}
              onClick={() => toggleTier(t)}
            />
          ))}
        </div>

        <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-dim)' }}>
          {total.toLocaleString()} wines {lwinFilter === 'missing' && '(LWIN missing)'}
        </div>
      </Card>

      {/* Results table */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {loading && rows.length === 0 ? (
          <div style={{ padding: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--text-dim)' }}>
            <LoadingSpinner size="md" /> Loading catalog…
          </div>
        ) : error ? (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <div style={{
              color: 'var(--red)', fontSize: 13, marginBottom: 16,
              background: 'rgba(220,38,38,0.08)', border: '1px solid var(--red)',
              borderRadius: 4, padding: '12px 16px', display: 'inline-block',
            }}>{error}</div>
            <div><button onClick={fetchFamilies} style={ghostBtn}>Retry</button></div>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState message="No wines match the current filters." />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <TH style={{ paddingLeft: 24 }}>Wine</TH>
                <TH>Producer</TH>
                <TH>Country / Region</TH>
                <TH style={{ textAlign: 'right' }}>WIQS <HelpTip term="wiqs_score" /></TH>
                <TH>Tier <HelpTip term="tier" /></TH>
                <TH style={{ textAlign: 'right' }}>Vintages <HelpTip term="vintages" /></TH>
                <TH>LWIN <HelpTip term="lwin7" /></TH>
                <TH style={{ paddingRight: 24 }}>Actions</TH>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr
                  key={r.wine_family_id}
                  onClick={() => openDrawer(r.wine_family_id)}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <TD style={{
                    paddingLeft: 24, fontFamily: 'var(--font-serif)',
                    fontStyle: 'italic', color: 'var(--text)',
                  }}>
                    {r.wine_name}
                  </TD>
                  <TD style={{ color: 'var(--text-dim)' }}>{r.producer}</TD>
                  <TD style={{ color: 'var(--text-dim)', fontSize: 11 }}>
                    {r.country} · {r.region}
                  </TD>
                  <TD style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text)' }}>
                    {r.wiqs_score != null ? r.wiqs_score.toFixed(2) : '—'}
                  </TD>
                  <TD><TierBadge tier={r.wiqs_tier} /></TD>
                  <TD style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-dim)' }}>
                    {r.vintage_count}
                  </TD>
                  <TD>
                    {r.lwin7
                      ? <span style={{ color: 'var(--green-light)', fontFamily: 'monospace', fontSize: 11 }}>
                          ✓ {r.lwin7}
                        </span>
                      : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                  </TD>
                  <TD style={{ paddingRight: 24 }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openDrawer(r.wine_family_id)} style={ghostBtn}>
                        View
                      </button>
                    </div>
                  </TD>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Pagination */}
      {total > 0 && !error && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px',
        }}>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            Showing {showingFrom}–{showingTo} of {total.toLocaleString()} wines
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={!canPrev}
              style={{ ...ghostBtn, opacity: canPrev ? 1 : 0.4, cursor: canPrev ? 'pointer' : 'not-allowed' }}
            >← Previous</button>
            <span style={{ fontSize: 12, color: 'var(--text-dim)', minWidth: 80, textAlign: 'center' }}>
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={!canNext}
              style={{ ...ghostBtn, opacity: canNext ? 1 : 0.4, cursor: canNext ? 'pointer' : 'not-allowed' }}
            >Next →</button>
          </div>
        </div>
      )}

      {/* Detail drawer */}
      {drawerOpen && selectedFamilyId && (
        <FamilyDetailDrawer
          wineFamilyId={selectedFamilyId}
          onClose={closeDrawer}
          onRefreshList={fetchFamilies}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Family detail drawer
// ═══════════════════════════════════════════════════════════════════════════

function FamilyDetailDrawer({ wineFamilyId, onClose, onRefreshList }) {
  const [detail, setDetail]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [tab, setTab]         = useState('details')
  const [version, setVersion] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const d = await getAdminFamily(wineFamilyId)
      setDetail(d)
    } catch (err) {
      setError(err.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [wineFamilyId])

  useEffect(() => { load() }, [load, version])

  const refresh = () => setVersion(v => v + 1)

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          zIndex: 200, animation: 'fadeIn 150ms',
        }}
      />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 480,
        background: 'var(--bg-card)', borderLeft: '2px solid var(--gold)',
        zIndex: 201, overflowY: 'auto',
        animation: 'slideInRight 200ms',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 5,
        }}>
          <div style={{ flex: 1 }}>
            {detail?.family && (
              <>
                <div style={{
                  fontFamily: 'var(--font-serif)', fontStyle: 'italic',
                  fontSize: 18, color: 'var(--gold)', marginBottom: 4,
                }}>{detail.family.wine_name}</div>
                <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-dim)' }}>
                  {detail.family.producer_name} · wf_id={wineFamilyId}
                </div>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: 'var(--text-dim)',
              fontSize: 24, lineHeight: 1, padding: '2px 8px', marginLeft: 12,
              cursor: 'pointer',
            }}
          >×</button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: 4, padding: '0 24px',
          borderBottom: '1px solid var(--border)',
          position: 'sticky', top: 69, background: 'var(--bg-card)', zIndex: 4,
        }}>
          {['details', 'vintages', 'overrides', 'audit'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '12px 14px', fontSize: 11, fontWeight: 600,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                background: 'transparent', border: 'none',
                color: tab === t ? 'var(--gold)' : 'var(--text-dim)',
                borderBottom: tab === t ? '2px solid var(--gold)' : '2px solid transparent',
                cursor: 'pointer',
              }}
            >{t}</button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, padding: 24, overflow: 'auto' }}>
          {loading ? (
            <div style={{ padding: 24, display: 'flex', justifyContent: 'center' }}>
              <LoadingSpinner size="md" />
            </div>
          ) : error ? (
            <div style={{ color: 'var(--red)', fontSize: 13 }}>{error}</div>
          ) : !detail ? null : (
            <>
              {tab === 'details'   && <DetailsTab detail={detail} onSaved={() => { refresh(); onRefreshList() }} />}
              {tab === 'vintages'  && <VintagesTab detail={detail} onRefresh={refresh} />}
              {tab === 'overrides' && <OverridesTab detail={detail} onRefresh={refresh} />}
              {tab === 'audit'     && <AuditTab detail={detail} />}
            </>
          )}
        </div>
      </div>
    </>
  )
}

// ── Details tab ──────────────────────────────────────────────────────────────

const EDITABLE_FIELDS = [
  'wine_name', 'producer_name', 'production_tier', 'vineyard_type',
  'winemaking_style', 'wine_prestige_score', 'lwin7',
]

function DetailsTab({ detail, onSaved }) {
  const [editing, setEditing] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [editNote, setEditNote]   = useState('')
  const [saving, setSaving]       = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [showRetire, setShowRetire] = useState(false)
  const [retireReason, setRetireReason] = useState('')
  const [retireLoading, setRetireLoading] = useState(false)
  const [recomputing, setRecomputing] = useState(false)
  const [recomputeNote, setRecomputeNote] = useState('')
  const [showRecompute, setShowRecompute] = useState(false)
  const [recomputeResult, setRecomputeResult] = useState(null)

  const fam = detail.family

  const startEdit = (field) => {
    setEditing(field)
    setEditValue(fam[field] ?? '')
    setEditNote('')
    setSaveError(null)
  }

  const cancelEdit = () => {
    setEditing(null)
    setEditValue('')
    setEditNote('')
    setSaveError(null)
  }

  const saveEdit = async () => {
    if (!editNote.trim()) {
      setSaveError('Note is required')
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      await updateAdminFamily(fam.id, { [editing]: editValue }, editNote)
      cancelEdit()
      onSaved()
    } catch (err) {
      setSaveError(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const doRetire = async () => {
    if (!retireReason.trim()) return
    setRetireLoading(true)
    try {
      await retireFamily(fam.id, retireReason, true)
      setShowRetire(false)
      setRetireReason('')
      onSaved()
    } catch (err) {
      alert(err.message || 'Retire failed')
    } finally {
      setRetireLoading(false)
    }
  }

  const doRecompute = async () => {
    if (!recomputeNote.trim()) return
    setRecomputing(true)
    setRecomputeResult(null)
    try {
      const r = await recomputeFamily(fam.id, recomputeNote)
      setRecomputeResult(r)
      setRecomputeNote('')
      onSaved()
    } catch (err) {
      alert(err.message || 'Recompute failed')
    } finally {
      setRecomputing(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Recompute control */}
      <div style={{
        padding: '12px 16px', background: '#0f0f0f',
        border: '1px solid var(--border)', borderRadius: 6,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: 'var(--text-dim)' }}>
            Recompute WIQS
          </span>
          {!showRecompute && (
            <button onClick={() => setShowRecompute(true)} style={ghostBtn}>Open</button>
          )}
        </div>
        {showRecompute && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              type="text"
              placeholder="note (required)"
              value={recomputeNote}
              onChange={e => setRecomputeNote(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={doRecompute} disabled={recomputing || !recomputeNote.trim()} style={goldBtn}>
                {recomputing ? 'Recomputing…' : 'Run recompute'}
              </button>
              <button onClick={() => { setShowRecompute(false); setRecomputeNote(''); setRecomputeResult(null) }} style={ghostBtn}>
                Cancel
              </button>
            </div>
            {recomputeResult && (
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                Before: {recomputeResult.before?.wiqs_score} → After: <span style={{ color: 'var(--gold)' }}>{recomputeResult.after?.wiqs_score}</span>
                {recomputeResult.delta != null && <> (Δ {recomputeResult.delta > 0 ? '+' : ''}{recomputeResult.delta})</>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Editable fields */}
      <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', rowGap: 8, columnGap: 12 }}>
        {EDITABLE_FIELDS.map(field => (
          <Fragment key={field}>
            <div style={fieldLabelStyle}>
              {field}
              {field === 'production_tier' && <HelpTip term="production_tier" />}
              {field === 'lwin7' && <HelpTip term="lwin7" />}
              {field === 'wine_prestige_score' && <HelpTip term="prestige_score" />}
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text)' }}>
              {editing === field ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <input
                    type="text"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="reason for change (required)"
                    value={editNote}
                    onChange={e => setEditNote(e.target.value)}
                  />
                  {saveError && <div style={{ color: 'var(--red)', fontSize: 11 }}>{saveError}</div>}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={saveEdit} disabled={saving || !editNote.trim()} style={goldBtn}>
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button onClick={cancelEdit} style={ghostBtn}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => startEdit(field)}
                  style={{
                    cursor: 'pointer', padding: '4px 6px',
                    border: '1px dashed transparent', borderRadius: 3,
                  }}
                  onMouseEnter={e => e.currentTarget.style.border = '1px dashed var(--gold-dim)'}
                  onMouseLeave={e => e.currentTarget.style.border = '1px dashed transparent'}
                >
                  {fam[field] != null && fam[field] !== '' ? String(fam[field]) : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                </div>
              )}
            </div>
          </Fragment>
        ))}
      </div>

      {/* Read-only metadata */}
      <div style={{
        fontSize: 11, color: 'var(--text-dim)', marginTop: 8,
        paddingTop: 12, borderTop: '1px solid var(--border)',
      }}>
        <div>Region: {detail.family.region_name} · {detail.family.country}</div>
        <div>Created: {detail.family.created_at}</div>
        {detail.prestige && (
          <div style={{ marginTop: 6 }}>
            Prestige <HelpTip term="prestige_score" />: <span style={{ color: 'var(--text)' }}>
              {detail.prestige.prestige_score}
            </span> ({detail.prestige.tier}){detail.prestige.manually_set && <span style={{ color: 'var(--gold)' }}> · manual</span>}
          </div>
        )}
      </div>

      {/* Retire action */}
      <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
        {!showRetire ? (
          <button onClick={() => setShowRetire(true)} style={redBtn}>
            Retire this wine family
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--red)', fontWeight: 600 }}>
              This will retire the family and all its active vintages.
            </div>
            <textarea
              placeholder="Reason for retirement (required)"
              value={retireReason}
              onChange={e => setRetireReason(e.target.value)}
              rows={3}
              style={{ resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={doRetire}
                disabled={retireLoading || !retireReason.trim()}
                style={{ ...redBtn, background: retireReason.trim() ? 'rgba(220,38,38,0.08)' : 'transparent' }}
              >
                {retireLoading ? 'Retiring…' : 'Confirm retire'}
              </button>
              <button onClick={() => { setShowRetire(false); setRetireReason('') }} style={ghostBtn}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Vintages tab ─────────────────────────────────────────────────────────────

function VintagesTab({ detail, onRefresh }) {
  const [expanded, setExpanded] = useState(null)
  const [overrideForm, setOverrideForm] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const vintages = detail.vintages || []

  // Dedupe vintages that appear multiple times in the response due to
  // multiple vectors per vintage (keep first)
  const seen = new Set()
  const dedupedVintages = vintages.filter(v => {
    if (seen.has(v.wine_vintage_id)) return false
    seen.add(v.wine_vintage_id)
    return true
  })

  const submitOverride = async () => {
    if (!overrideForm.note.trim() || !overrideForm.value) return
    setSubmitting(true)
    try {
      await overridePillar(
        overrideForm.vintage_id,
        overrideForm.pillar,
        parseFloat(overrideForm.value),
        overrideForm.note,
      )
      setOverrideForm(null)
      onRefresh()
    } catch (err) {
      alert(err.message || 'Override failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (dedupedVintages.length === 0) {
    return <EmptyState message="No vintages for this family." />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {dedupedVintages.map(v => {
        const isExpanded = expanded === v.wine_vintage_id
        return (
          <div
            key={v.wine_vintage_id}
            style={{
              border: '1px solid var(--border)', borderRadius: 6,
              background: isExpanded ? '#0f0f0f' : 'transparent',
            }}
          >
            <div
              onClick={() => setExpanded(isExpanded ? null : v.wine_vintage_id)}
              style={{
                padding: '10px 14px', cursor: 'pointer',
                display: 'grid', gridTemplateColumns: '60px 70px 1fr 90px 90px', gap: 8,
                alignItems: 'center', fontSize: 12,
              }}
            >
              <span style={{ fontFamily: 'monospace', color: 'var(--text)' }}>{v.vintage_year}</span>
              <span style={{ fontFamily: 'monospace', color: 'var(--text)' }}>
                {v.wiqs_score != null ? v.wiqs_score.toFixed(2) : '—'}
              </span>
              <TierBadge tier={v.wiqs_tier} />
              <span style={{
                fontSize: 10, color: v.vector_dims_present === 8 ? 'var(--green-light)' : 'var(--amber)',
                fontFamily: 'monospace',
              }}>
                {v.vector_dims_present === 8 ? '✓ 8/8' : `${v.vector_dims_present}/8`}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'right' }}>
                vid {v.wine_vintage_id}
              </span>
            </div>
            {isExpanded && (
              <div style={{ padding: '8px 14px 14px', borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6, marginBottom: 12 }}>
                  {['p1','p2','p3','p4','p5'].map(p => {
                    const val = v.pillars?.[p]
                    const max = { p1: 25, p2: 20, p3: 20, p4: 20, p5: 15 }[p]
                    const pct = val != null ? (val / max) * 100 : 0
                    return (
                      <div key={p}>
                        <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 3 }}>
                          {p}
                        </div>
                        <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text)', marginBottom: 2 }}>
                          {val != null ? val.toFixed(1) : '—'}
                        </div>
                        <div style={{ height: 3, background: '#2a2a2a', borderRadius: 1 }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--gold)', borderRadius: 1 }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
                {overrideForm?.vintage_id === v.wine_vintage_id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: '#000', padding: 10, borderRadius: 4 }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <select
                        value={overrideForm.pillar}
                        onChange={e => setOverrideForm({ ...overrideForm, pillar: e.target.value })}
                        style={{ width: 70 }}
                      >
                        {['p1','p2','p3','p4','p5'].map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="value"
                        value={overrideForm.value}
                        onChange={e => setOverrideForm({ ...overrideForm, value: e.target.value })}
                        style={{ flex: 1 }}
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="note (required)"
                      value={overrideForm.note}
                      onChange={e => setOverrideForm({ ...overrideForm, note: e.target.value })}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={submitOverride}
                        disabled={submitting || !overrideForm.note.trim() || !overrideForm.value}
                        style={goldBtn}
                      >
                        {submitting ? 'Saving…' : 'Apply override'}
                      </button>
                      <button onClick={() => setOverrideForm(null)} style={ghostBtn}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setOverrideForm({
                      vintage_id: v.wine_vintage_id, pillar: 'p1', value: '', note: '',
                    })}
                    style={ghostBtn}
                  >
                    Override Pillar
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Overrides tab ────────────────────────────────────────────────────────────

function OverridesTab({ detail, onRefresh }) {
  const [removing, setRemoving] = useState(null)
  const [removeNote, setRemoveNote] = useState('')
  const [showPrestigeForm, setShowPrestigeForm] = useState(false)
  const [prestigeScore, setPrestigeScore] = useState('')
  const [prestigeNote, setPrestigeNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const overrides = detail.pillar_overrides || []

  const doRemove = async (oid) => {
    if (!removeNote.trim()) return
    setSubmitting(true)
    try {
      await deletePillarOverride(oid, removeNote)
      setRemoving(null)
      setRemoveNote('')
      onRefresh()
    } catch (err) {
      alert(err.message || 'Remove failed')
    } finally {
      setSubmitting(false)
    }
  }

  const doPrestige = async () => {
    if (!prestigeNote.trim() || !prestigeScore) return
    setSubmitting(true)
    try {
      await overridePrestige(detail.family.id, parseFloat(prestigeScore), null, prestigeNote)
      setShowPrestigeForm(false)
      setPrestigeScore('')
      setPrestigeNote('')
      onRefresh()
    } catch (err) {
      alert(err.message || 'Prestige override failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={fieldLabelStyle}>Pillar Overrides</div>
        {overrides.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic' }}>
            No active pillar overrides for this family.
          </div>
        ) : (
          overrides.map(o => (
            <div key={o.override_id} style={{
              padding: '10px 12px', marginBottom: 6,
              background: '#0f0f0f', border: '1px solid var(--border)', borderRadius: 4,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ fontSize: 12 }}>
                  <span style={{ color: 'var(--gold)', fontFamily: 'monospace' }}>
                    {o.pillar.toUpperCase()} = {o.override_value}
                  </span>
                  <span style={{ color: 'var(--text-dim)', marginLeft: 8, fontSize: 10 }}>
                    vintage {o.vintage_year}
                  </span>
                </div>
                {removing === o.override_id ? null : (
                  <button onClick={() => { setRemoving(o.override_id); setRemoveNote('') }} style={{
                    ...ghostBtn, borderColor: 'var(--red)', color: 'var(--red)', padding: '3px 8px', fontSize: 10,
                  }}>Remove</button>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                {o.note} · <OperatorChip operator={o.operator} /> · {timeAgo(o.created_at)}
              </div>
              {removing === o.override_id && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <input
                    type="text"
                    placeholder="reason for removal (required)"
                    value={removeNote}
                    onChange={e => setRemoveNote(e.target.value)}
                  />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => doRemove(o.override_id)}
                            disabled={submitting || !removeNote.trim()}
                            style={{ ...redBtn, padding: '6px 12px' }}>
                      {submitting ? 'Removing…' : 'Confirm'}
                    </button>
                    <button onClick={() => setRemoving(null)} style={ghostBtn}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div style={{ paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <div style={fieldLabelStyle}>Prestige Override</div>
        {detail.prestige ? (
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>
            Current: <span style={{ color: 'var(--text)', fontFamily: 'monospace' }}>{detail.prestige.prestige_score}</span>
            {detail.prestige.manually_set && <span style={{ color: 'var(--gold)', marginLeft: 6 }}>· manually set</span>}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8, fontStyle: 'italic' }}>
            No prestige entry — creating one will insert.
          </div>
        )}
        {!showPrestigeForm ? (
          <button onClick={() => setShowPrestigeForm(true)} style={ghostBtn}>
            Override prestige
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: '#0f0f0f', padding: 10, borderRadius: 4 }}>
            <input
              type="number"
              step="0.1"
              placeholder="prestige score (0–20)"
              value={prestigeScore}
              onChange={e => setPrestigeScore(e.target.value)}
            />
            <input
              type="text"
              placeholder="note (required)"
              value={prestigeNote}
              onChange={e => setPrestigeNote(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={doPrestige}
                      disabled={submitting || !prestigeNote.trim() || !prestigeScore}
                      style={goldBtn}>
                {submitting ? 'Saving…' : 'Apply'}
              </button>
              <button onClick={() => { setShowPrestigeForm(false); setPrestigeScore(''); setPrestigeNote('') }} style={ghostBtn}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Audit tab ────────────────────────────────────────────────────────────────

function AuditTab({ detail }) {
  const rows = detail.audit || []
  if (rows.length === 0) {
    return <EmptyState message="No audit history for this family." />
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {rows.map(r => (
        <div key={r.id} style={{
          padding: '8px 10px', background: '#0f0f0f',
          border: '1px solid var(--border)', borderRadius: 4,
          fontSize: 11,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <div>
              <OperatorChip operator={r.operator} />
              <span style={{ color: 'var(--text)', marginLeft: 8, fontFamily: 'monospace' }}>
                {r.table_name}
              </span>
              {r.field_name && (
                <span style={{ color: 'var(--text-dim)', marginLeft: 6, fontStyle: 'italic' }}>
                  .{r.field_name}
                </span>
              )}
            </div>
            <span style={{ color: 'var(--text-dim)' }}>{timeAgo(r.changed_at)}</span>
          </div>
          {(r.old_value != null || r.new_value != null) && (
            <div style={{ fontFamily: 'monospace', fontSize: 10 }}>
              {r.old_value != null && <span style={{ color: '#a85050', textDecoration: 'line-through' }}>{r.old_value}</span>}
              {r.old_value != null && r.new_value != null && ' → '}
              {r.new_value != null && <span style={{ color: 'var(--green-light)' }}>{r.new_value}</span>}
            </div>
          )}
          {r.note && (
            <div style={{ color: 'var(--text-dim)', marginTop: 3, fontStyle: 'italic' }}>
              {r.note}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const labelStyle = {
  display: 'block', fontSize: 10, fontWeight: 600,
  letterSpacing: '0.1em', textTransform: 'uppercase',
  color: 'var(--text-dim)', marginBottom: 6,
}

const fieldLabelStyle = {
  fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
  textTransform: 'uppercase', color: 'var(--text-dim)',
  paddingTop: 6, marginBottom: 8,
}
