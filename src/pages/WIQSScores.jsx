import { useState, useEffect, useRef } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Dot,
} from 'recharts'
import { useAPI } from '../hooks/useAPI'
import {
  getCatalogStats, getWIQSScores, getWIQSHistory,
  searchWines, batchRecompute, recomputeWine,
} from '../api/client'
import Badge from '../components/Badge'
import LoadingSpinner from '../components/LoadingSpinner'
import { TIER_COLORS, scoreToColor } from '../utils/tierColors'
import { fmtScore, fmtPct, fmtDate, capitalize } from '../utils/formatters'
import HelpTip from '../components/HelpTip'

const PAGE_SIZE  = 50
const TIER_ORDER = ['exceptional', 'distinguished', 'quality', 'standard', 'basic']

const REASON_COLORS = {
  initial_backfill: '#555',
  batch_recompute:  '#555',
  region_fix:       '#1d4ed8',
  manual_recompute: '#b8922a',
  annual_update:    '#166534',
}

// ── Pillar bar ────────────────────────────────────────────────────────────────
function PillarBar({ label, score, max }) {
  const pct = score != null ? Math.min(100, (score / max) * 100) : 0
  const c   = scoreToColor(score != null ? (score / max) * 100 : 0)
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: '#aaa' }}>{label}</span>
        <span style={{ fontSize: 11, color: c.text, fontWeight: 600 }}>
          {score != null ? score.toFixed(1) : '—'} / {max}
        </span>
      </div>
      <div style={{ height: 6, background: '#2a2a2a', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: c.text, borderRadius: 3,
          transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  )
}

// ── Chart tooltip ─────────────────────────────────────────────────────────────
function HistoryTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{
      background: '#1e1e1e', border: '1px solid #333',
      borderRadius: 8, padding: '10px 14px', fontSize: 11,
    }}>
      <div style={{ color: '#c9a84c', fontWeight: 700, marginBottom: 6 }}>
        {fmtScore(d.wiqs_score)} — <span style={{ textTransform: 'capitalize' }}>{d.wiqs_tier}</span>
      </div>
      <div style={{ color: '#888', marginBottom: 4 }}>{fmtDate(d.computed_at)}</div>
      <div style={{ color: '#aaa', marginBottom: 2 }}>
        P1 {d.p1_site_terroir?.toFixed(1) ?? '—'} · P2 {d.p2_producer_prestige?.toFixed(1) ?? '—'} · P3 {d.p3_classification?.toFixed(1) ?? '—'}
      </div>
      <div style={{ color: '#aaa', marginBottom: 4 }}>
        P4 {d.p4_market_validation?.toFixed(1) ?? '—'} · P5 {d.p5_sensory_complexity?.toFixed(1) ?? '—'}
      </div>
      <div style={{ color: '#666' }}>Reason: {d.compute_reason}</div>
    </div>
  )
}

// ── Shimmer skeleton ──────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr>
      {[200, 120, 100, 80, 70, 60, 60, 50, 50, 50, 50, 50, 90, 80].map((w, i) => (
        <td key={i} style={{ padding: '10px 12px' }}>
          <div style={{
            height: 12, width: w, borderRadius: 4,
            background: 'linear-gradient(90deg,#222 25%,#2a2a2a 50%,#222 75%)',
            backgroundSize: '400px 100%',
            animation: 'shimmer 1.4s infinite',
          }} />
        </td>
      ))}
      <td style={{ padding: '10px 12px' }} />
    </tr>
  )
}

// ── Sort icon ─────────────────────────────────────────────────────────────────
function SortIcon({ sortKey, k, sortDir }) {
  if (sortKey !== k) return <span style={{ color: '#444', marginLeft: 3 }}>↕</span>
  return <span style={{ color: '#c9a84c', marginLeft: 3 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function WIQSScores() {
  const [activeTab,      setActiveTab]      = useState('catalog')
  const [selectedWine,   setSelectedWine]   = useState(null)

  // Catalog state
  const [search,         setSearch]         = useState('')
  const [tierFilter,     setTierFilter]     = useState('all')
  const [countryFilter,  setCountryFilter]  = useState('all')
  const [sortKey,        setSortKey]        = useState('wiqs_score')
  const [sortDir,        setSortDir]        = useState('desc')
  const [page,           setPage]           = useState(0)

  // Batch recompute
  const [batchDropOpen,  setBatchDropOpen]  = useState(false)
  const [batchLoading,   setBatchLoading]   = useState(false)
  const [batchResult,    setBatchResult]    = useState(null)
  const [batchConfirm,   setBatchConfirm]   = useState(null)
  const batchDropRef = useRef(null)

  // History search
  const [histSearch,     setHistSearch]     = useState('')
  const [histResults,    setHistResults]    = useState([])
  const [histSearching,  setHistSearching]  = useState(false)
  const [showAllHistory, setShowAllHistory] = useState(false)
  const [recomputing,    setRecomputing]    = useState(false)
  const histSearchTimer = useRef(null)

  // API
  const { data: stats }                               = useAPI(getCatalogStats)
  const { data: scoresRes, loading: scoresLoading }   = useAPI(getWIQSScores)
  const historyWineId = selectedWine?.wine_family_id ?? null
  const { data: historyRes, loading: historyLoading, refetch: refetchHistory } = useAPI(
    () => historyWineId ? getWIQSHistory(historyWineId) : Promise.resolve(null),
    [historyWineId]
  )

  // Close batch dropdown on outside click
  useEffect(() => {
    function handler(e) {
      if (batchDropRef.current && !batchDropRef.current.contains(e.target))
        setBatchDropOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Reset page on filter change
  useEffect(() => { setPage(0) }, [search, tierFilter, countryFilter, sortKey, sortDir])

  // Debounced history search
  function onHistSearchChange(q) {
    setHistSearch(q)
    clearTimeout(histSearchTimer.current)
    if (!q.trim()) { setHistResults([]); return }
    histSearchTimer.current = setTimeout(async () => {
      setHistSearching(true)
      try {
        const res = await searchWines(q)
        setHistResults(res.results || [])
      } catch { setHistResults([]) }
      finally   { setHistSearching(false) }
    }, 300)
  }

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  function openHistory(wine) {
    setSelectedWine(wine)
    setActiveTab('history')
    setHistSearch('')
    setHistResults([])
    setShowAllHistory(false)
  }

  async function runBatch(scope) {
    setBatchConfirm(null)
    setBatchLoading(true)
    setBatchResult(null)
    try {
      const res = await batchRecompute(scope)
      setBatchResult({ ok: true, computed: res.computed, errors: res.errors })
    } catch (err) {
      setBatchResult({ ok: false, message: err.message })
    } finally { setBatchLoading(false) }
  }

  async function handleRecompute() {
    if (!selectedWine) return
    setRecomputing(true)
    try {
      await recomputeWine(selectedWine.wine_family_id, 'manual_recompute')
      await refetchHistory()
    } catch (err) { setBatchResult({ ok: false, message: err.message || 'Recompute failed' }) }
    finally { setRecomputing(false) }
  }

  // ── Filtered / sorted wines ────────────────────────────────────────────────
  const wines     = scoresRes?.wines ?? []
  const countries = [...new Set(wines.map(w => w.country).filter(Boolean))].sort()

  const filtered = wines.filter(w => {
    if (tierFilter    !== 'all' && w.wiqs_tier !== tierFilter)   return false
    if (countryFilter !== 'all' && w.country   !== countryFilter) return false
    if (search) {
      const q = search.trim().toLowerCase()
      if (!q) return true
      const hay = [w.wine_name, w.producer_name, w.region_name, w.country]
        .filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    }
    return true
  }).sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1
    if (sortKey === 'wine_name')       return dir * (a.wine_name || '').localeCompare(b.wine_name || '')
    if (sortKey === 'wiqs_confidence') return dir * ((a.wiqs_confidence ?? 0) - (b.wiqs_confidence ?? 0))
    return dir * ((a.wiqs_score ?? 0) - (b.wiqs_score ?? 0))
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageWines  = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const anyFiltered = search || tierFilter !== 'all' || countryFilter !== 'all'

  // Tier distribution summary
  const tierDist    = stats?.tier_distribution ?? {}
  const tierSummary = TIER_ORDER.filter(t => tierDist[t])
    .map(t => `${tierDist[t]} ${capitalize(t)}`).join(' · ')

  // History chart data
  const history       = historyRes?.history ?? []
  const histChartData = [...history].reverse()
  const latestHistory = history[0] ?? null
  const shownHistory  = showAllHistory ? history : history.slice(0, 10)

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: 'Inter, -apple-system, sans-serif' }}>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: -400px 0 }
          100% { background-position:  400px 0 }
        }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{
          fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700,
          color: '#fff', margin: '0 0 4px',
        }}>WIQS Scores</h1>
        <p style={{ fontSize: 12, color: '#666', margin: 0 }}>
          {stats ? `${stats.wiqs_scored_count.toLocaleString()} wines scored · avg ${Number(stats.avg_wiqs_score ?? 0).toFixed(1)}` : ''}
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid #222' }}>
        {['catalog', 'history'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '8px 20px', fontSize: 13, fontWeight: 600,
            color: activeTab === tab ? '#c9a84c' : '#666',
            borderBottom: activeTab === tab ? '2px solid #c9a84c' : '2px solid transparent',
            marginBottom: -1, transition: 'color 0.15s',
          }}>
            {tab === 'catalog' ? 'Catalog' : 'Score History'}
          </button>
        ))}
      </div>

      {/* ── CATALOG ────────────────────────────────────────────────────────── */}
      {activeTab === 'catalog' && (
        <>
          {/* Summary pills + batch button */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 10, marginBottom: 16,
          }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <span style={pillStyle}>
                Scored: <b style={{ color: '#c9a84c' }}>{stats?.wiqs_scored_count?.toLocaleString() ?? '—'}</b>
              </span>
              <span style={pillStyle}>
                Avg: <b style={{ color: '#c9a84c' }}>{stats?.avg_wiqs_score != null ? Number(stats.avg_wiqs_score).toFixed(1) : '—'}</b>
              </span>
              {tierSummary && (
                <span style={{ ...pillStyle, fontSize: 10, color: '#555' }}>{tierSummary}</span>
              )}
            </div>

            <div style={{ position: 'relative' }} ref={batchDropRef}>
              <button onClick={() => setBatchDropOpen(o => !o)} disabled={batchLoading}
                style={{
                  background: '#1e1e1e', border: '1px solid #333',
                  color: '#c9a84c', fontSize: 12, fontWeight: 600,
                  padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                {batchLoading && <LoadingSpinner size="sm" />}
                Batch Recompute ▾
              </button>
              {batchDropOpen && (
                <div style={{
                  position: 'absolute', right: 0, top: '100%', marginTop: 4,
                  background: '#1a1a1a', border: '1px solid #333',
                  borderRadius: 8, overflow: 'hidden', zIndex: 100, minWidth: 200,
                }}>
                  {[
                    { scope: 'all',            label: `All Wines (${wines.length.toLocaleString()})` },
                    { scope: 'low_confidence', label: 'Low Confidence Only' },
                  ].map(({ scope, label }) => (
                    <button key={scope}
                      onClick={() => { setBatchDropOpen(false); setBatchConfirm(scope) }}
                      style={{
                        width: '100%', display: 'block', textAlign: 'left',
                        background: 'none', border: 'none', cursor: 'pointer',
                        padding: '10px 14px', fontSize: 12, color: '#ccc',
                        borderBottom: '1px solid #222',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#222'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Batch result */}
          {batchResult && (
            <div style={{
              marginBottom: 14, padding: '10px 14px', borderRadius: 8,
              background: batchResult.ok ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)',
              border: `1px solid ${batchResult.ok ? '#166534' : '#991b1b'}`,
              fontSize: 12, color: batchResult.ok ? '#4ade80' : '#fca5a5',
              display: 'flex', justifyContent: 'space-between',
            }}>
              {batchResult.ok
                ? `✓ Recomputed ${batchResult.computed} wines · ${batchResult.errors} errors`
                : `✗ Failed: ${batchResult.message}`}
              <button onClick={() => setBatchResult(null)}
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 14 }}>
                ×
              </button>
            </div>
          )}

          {/* Filter bar */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16, alignItems: 'center' }}>
            <input
              placeholder="Search wines, producers, regions…"
              value={search} onChange={e => setSearch(e.target.value)}
              style={inputStyle}
            />
            <select value={tierFilter} onChange={e => setTierFilter(e.target.value)} style={selectStyle}>
              <option value="all">All tiers</option>
              {TIER_ORDER.map(t => <option key={t} value={t}>{capitalize(t)}</option>)}
            </select>
            <select value={countryFilter} onChange={e => setCountryFilter(e.target.value)} style={selectStyle}>
              <option value="all">All countries</option>
              {countries.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {anyFiltered && (
              <button onClick={() => { setSearch(''); setTierFilter('all'); setCountryFilter('all') }}
                style={{ background: 'none', border: 'none', color: '#c9a84c', fontSize: 11, cursor: 'pointer' }}>
                Clear filters
              </button>
            )}
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#555' }}>
              {filtered.length.toLocaleString()} wines
            </span>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #222' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#161616', borderBottom: '1px solid #222' }}>
                  {[
                    { id: 'wine',     key: 'wine_name',       label: 'Wine',    w: 180 },
                    { id: 'producer', key: null,              label: 'Producer', w: 130 },
                    { id: 'region',   key: null,              label: 'Region',   w: 110 },
                    { id: 'country',  key: null,              label: 'Country',  w: 80  },
                    { id: 'tier',     key: null,              label: <>Tier<HelpTip term="tier" /></>,     w: 110 },
                    { id: 'score',    key: 'wiqs_score',      label: <>Score<HelpTip term="wiqs_score" /></>,   w: 62  },
                    { id: 'conf',     key: 'wiqs_confidence', label: <>Conf<HelpTip term="confidence" /></>,    w: 52  },
                    { id: 'p1', key: null, label: <>P1<HelpTip term="p1" /></>, w: 40 },
                    { id: 'p2', key: null, label: <>P2<HelpTip term="p2" /></>, w: 40 },
                    { id: 'p3', key: null, label: <>P3<HelpTip term="p3" /></>, w: 40 },
                    { id: 'p4', key: null, label: <>P4<HelpTip term="p4" /></>, w: 40 },
                    { id: 'p5', key: null, label: <>P5<HelpTip term="p5" /></>, w: 40 },
                    { id: 'qpr',      key: null,              label: <>QPR<HelpTip term="qpr" /></>,      w: 100 },
                    { id: 'computed', key: null,              label: 'Computed', w: 90  },
                  ].map(({ id, key, label, w }) => (
                    <th key={id} onClick={key ? () => handleSort(key) : undefined}
                      style={{
                        padding: '10px 12px', textAlign: 'left',
                        color: '#666', fontWeight: 600, fontSize: 10,
                        letterSpacing: '0.5px', textTransform: 'uppercase',
                        whiteSpace: 'nowrap', width: w,
                        cursor: key ? 'pointer' : 'default', userSelect: 'none',
                      }}>
                      {label}
                      {key && <SortIcon sortKey={sortKey} k={key} sortDir={sortDir} />}
                    </th>
                  ))}
                  <th style={{ padding: '10px 12px', width: 72 }} />
                </tr>
              </thead>
              <tbody>
                {scoresLoading
                  ? Array.from({ length: 8 }, (_, i) => <SkeletonRow key={i} />)
                  : pageWines.map(w => {
                    const sc = scoreToColor(w.wiqs_score)
                    const qprColor = w.qpr_label?.includes('exceptional') ? '#4ade80'
                                   : w.qpr_label?.includes('good')        ? '#a3e635'
                                   : '#555'
                    return (
                      <tr key={w.wine_family_id}
                        style={{ borderBottom: '1px solid #1a1a1a', transition: 'background 0.1s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#181818'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '9px 12px', maxWidth: 180 }}>
                          <button onClick={() => openHistory(w)}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              fontFamily: 'Georgia, serif', fontStyle: 'italic',
                              fontSize: 12, color: '#e8ddd0', textAlign: 'left',
                              padding: 0, overflow: 'hidden', textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap', maxWidth: 175, display: 'block',
                            }}>
                            {w.wine_name}
                          </button>
                        </td>
                        <td style={tdStyle}>{w.producer_name}</td>
                        <td style={tdStyle}>{w.region_name || '—'}</td>
                        <td style={tdStyle}>{w.country || '—'}</td>
                        <td style={{ padding: '9px 12px' }}><Badge tier={w.wiqs_tier} /></td>
                        <td style={{ padding: '9px 12px', color: sc.text, fontWeight: 700 }}>
                          {fmtScore(w.wiqs_score)}
                        </td>
                        <td style={{ padding: '9px 12px', color: w.wiqs_confidence >= 0.8 ? '#4ade80' : '#f59e0b' }}>
                          {fmtPct(w.wiqs_confidence)}
                        </td>
                        {[
                          w.p1_site_terroir, w.p2_producer_prestige, w.p3_classification,
                          w.p4_market_validation, w.p5_sensory_complexity,
                        ].map((v, i) => (
                          <td key={i} style={{ padding: '9px 12px', color: '#555', fontSize: 11 }}>
                            {v != null ? Number(v).toFixed(1) : '—'}
                          </td>
                        ))}
                        <td style={{ padding: '9px 12px' }}>
                          {w.qpr_label && w.qpr_label !== 'none' ? (
                            <span style={{
                              fontSize: 9, padding: '2px 6px', borderRadius: 10,
                              background: `${qprColor}22`, color: qprColor,
                              border: `1px solid ${qprColor}44`, whiteSpace: 'nowrap',
                            }}>
                              {w.qpr_label.replace(/_/g, ' ')}
                            </span>
                          ) : '—'}
                        </td>
                        <td style={{ ...tdStyle, color: '#444', fontSize: 10 }}>
                          {fmtDate(w.wiqs_computed_at)}
                        </td>
                        <td style={{ padding: '9px 12px' }}>
                          <button onClick={() => openHistory(w)}
                            style={{
                              fontSize: 10, padding: '3px 8px',
                              background: 'rgba(201,168,76,0.08)',
                              border: '1px solid rgba(201,168,76,0.25)',
                              color: '#c9a84c', borderRadius: 5, cursor: 'pointer',
                            }}>
                            History
                          </button>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex', justifyContent: 'center', alignItems: 'center',
              gap: 10, marginTop: 16,
            }}>
              <button onClick={() => setPage(0)} disabled={page === 0} style={pageBtn}>«</button>
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={pageBtn}>‹</button>
              <span style={{ fontSize: 12, color: '#666' }}>
                Page {page + 1} of {totalPages} · {filtered.length.toLocaleString()} wines
              </span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} style={pageBtn}>›</button>
              <button onClick={() => setPage(totalPages - 1)} disabled={page === totalPages - 1} style={pageBtn}>»</button>
            </div>
          )}
        </>
      )}

      {/* ── HISTORY ─────────────────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <>
          {!selectedWine ? (
            /* Wine selector */
            <div style={{ maxWidth: 480, position: 'relative' }}>
              <p style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
                Search for a wine to view its score history.
              </p>
              <input
                placeholder="Search by wine name or producer…"
                value={histSearch} onChange={e => onHistSearchChange(e.target.value)}
                autoFocus
                style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
              />
              {histSearching && <div style={{ marginTop: 8 }}><LoadingSpinner size="sm" /></div>}
              {histResults.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0,
                  background: '#1a1a1a', border: '1px solid #333',
                  borderRadius: 8, overflow: 'hidden', zIndex: 50,
                  maxHeight: 300, overflowY: 'auto',
                }}>
                  {histResults.map(r => (
                    <button key={r.wine_family_id || r.id}
                      onClick={() => {
                        setSelectedWine({ wine_family_id: r.wine_family_id || r.id, wine_name: r.wine_name, producer_name: r.producer_name })
                        setHistSearch('')
                        setHistResults([])
                      }}
                      style={{
                        width: '100%', textAlign: 'left', background: 'none',
                        border: 'none', cursor: 'pointer', padding: '10px 14px',
                        borderBottom: '1px solid #222', color: '#ccc',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#222'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <div style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 13 }}>
                        {r.wine_name}
                      </div>
                      <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>{r.producer_name}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Wine header */}
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 10,
              }}>
                <div>
                  <h2 style={{
                    fontFamily: 'Georgia, serif', fontStyle: 'italic',
                    fontSize: 18, color: '#e8ddd0', margin: '0 0 4px',
                  }}>
                    {selectedWine.wine_name}
                  </h2>
                  <div style={{ fontSize: 12, color: '#666' }}>{selectedWine.producer_name}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleRecompute} disabled={recomputing}
                    style={{
                      fontSize: 11, padding: '6px 12px',
                      background: 'rgba(201,168,76,0.1)',
                      border: '1px solid rgba(201,168,76,0.3)',
                      color: '#c9a84c', borderRadius: 6, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                    {recomputing && <LoadingSpinner size="sm" />}
                    Recompute Now
                  </button>
                  <button onClick={() => setSelectedWine(null)}
                    style={{
                      fontSize: 11, padding: '6px 12px',
                      background: '#1a1a1a', border: '1px solid #333',
                      color: '#888', borderRadius: 6, cursor: 'pointer',
                    }}>
                    ← Change wine
                  </button>
                </div>
              </div>

              {historyLoading
                ? <div style={{ padding: 40, textAlign: 'center' }}><LoadingSpinner size="md" /></div>
                : (
                  <>
                    {/* Two-panel */}
                    <div style={{ display: 'flex', gap: 20, marginBottom: 24, flexWrap: 'wrap' }}>

                      {/* LEFT — Timeline */}
                      <div style={{
                        flex: '3 1 400px', background: '#111',
                        border: '1px solid #222', borderRadius: 12, padding: '18px 20px',
                      }}>
                        <div style={{
                          fontSize: 11, color: '#666', textTransform: 'uppercase',
                          letterSpacing: 1, marginBottom: 12,
                        }}>
                          Score Timeline
                        </div>
                        {histChartData.length === 0
                          ? <div style={{ color: '#555', fontSize: 12, padding: 20, textAlign: 'center' }}>
                              No history available.
                            </div>
                          : (
                            <ResponsiveContainer width="100%" height={300}>
                              <LineChart data={histChartData}
                                margin={{ top: 10, right: 80, left: -10, bottom: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                                <XAxis dataKey="computed_at"
                                  tickFormatter={v => fmtDate(v)}
                                  tick={{ fontSize: 9, fill: '#555' }} />
                                <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#555' }} />
                                <Tooltip content={<HistoryTooltip />} />
                                <ReferenceLine y={85} stroke="#c9a84c" strokeDasharray="4 3"
                                  label={{ value: 'Exceptional', fill: '#c9a84c', fontSize: 9, position: 'insideRight' }} />
                                <ReferenceLine y={70} stroke="#e8ddd0" strokeDasharray="4 3"
                                  label={{ value: 'Distinguished', fill: '#e8ddd0', fontSize: 9, position: 'insideRight' }} />
                                <ReferenceLine y={55} stroke="#4ade80" strokeDasharray="4 3"
                                  label={{ value: 'Quality', fill: '#4ade80', fontSize: 9, position: 'insideRight' }} />
                                <ReferenceLine y={40} stroke="#777" strokeDasharray="4 3"
                                  label={{ value: 'Standard', fill: '#777', fontSize: 9, position: 'insideRight' }} />
                                <Line type="monotone" dataKey="wiqs_score"
                                  stroke="#c9a84c" strokeWidth={2}
                                  dot={<Dot r={5} fill="#c9a84c" stroke="#111" strokeWidth={2} />}
                                  activeDot={{ r: 7, fill: '#fff' }} />
                              </LineChart>
                            </ResponsiveContainer>
                          )}

                        {/* Reason chips */}
                        {history.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
                            {history.map((h, i) => (
                              <span key={i} style={{
                                fontSize: 9, padding: '3px 8px', borderRadius: 10,
                                background: `${REASON_COLORS[h.compute_reason] ?? '#555'}22`,
                                color: REASON_COLORS[h.compute_reason] ?? '#777',
                                border: `1px solid ${REASON_COLORS[h.compute_reason] ?? '#555'}44`,
                              }}>
                                {h.compute_reason?.replace(/_/g, ' ')}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* RIGHT — Pillar breakdown */}
                      <div style={{
                        flex: '2 1 260px', background: '#111',
                        border: '1px solid #222', borderRadius: 12, padding: '18px 20px',
                      }}>
                        <div style={{
                          fontSize: 11, color: '#666', textTransform: 'uppercase',
                          letterSpacing: 1, marginBottom: 8,
                        }}>
                          Current Score
                        </div>
                        {latestHistory ? (
                          <>
                            <div style={{
                              fontSize: 44, fontWeight: 800,
                              color: scoreToColor(latestHistory.wiqs_score).text,
                              marginBottom: 4, lineHeight: 1,
                            }}>
                              {fmtScore(latestHistory.wiqs_score)}
                            </div>
                            <div style={{ marginBottom: 18 }}><Badge tier={latestHistory.wiqs_tier} /></div>

                            <PillarBar label={<>P1  Site & Terroir<HelpTip term="p1" /></>}     score={latestHistory.p1_site_terroir}       max={25} />
                            <PillarBar label={<>P2  Producer Prestige<HelpTip term="p2" /></>}  score={latestHistory.p2_producer_prestige}  max={20} />
                            <PillarBar label={<>P3  Classification<HelpTip term="p3" /></>}     score={latestHistory.p3_classification}     max={20} />
                            <PillarBar label={<>P4  Market Validation<HelpTip term="p4" /></>}  score={latestHistory.p4_market_validation}  max={20} />
                            <PillarBar label={<>P5  Sensory Complexity<HelpTip term="p5" /></>} score={latestHistory.p5_sensory_complexity} max={15} />

                            <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {latestHistory.commercial_inflation && latestHistory.commercial_inflation !== 'none' && (
                                <span style={{
                                  fontSize: 9, padding: '2px 8px', borderRadius: 10,
                                  background: 'rgba(239,68,68,0.1)', color: '#f87171',
                                  border: '1px solid rgba(239,68,68,0.25)',
                                }}>
                                  {latestHistory.commercial_inflation} inflation
                                </span>
                              )}
                              {latestHistory.qpr_label && latestHistory.qpr_label !== 'none' && (
                                <span style={{
                                  fontSize: 9, padding: '2px 8px', borderRadius: 10,
                                  background: 'rgba(74,222,128,0.1)', color: '#4ade80',
                                  border: '1px solid rgba(74,222,128,0.25)',
                                }}>
                                  {latestHistory.qpr_label.replace(/_/g, ' ')}
                                </span>
                              )}
                            </div>
                            <div style={{ marginTop: 12, fontSize: 11, color: '#555' }}>
                              Data confidence:{' '}
                              <span style={{ color: latestHistory.wiqs_confidence >= 0.8 ? '#4ade80' : '#f59e0b' }}>
                                {fmtPct(latestHistory.wiqs_confidence)}
                              </span>
                            </div>
                          </>
                        ) : (
                          <div style={{ color: '#555', fontSize: 12 }}>No score data.</div>
                        )}
                      </div>
                    </div>

                    {/* History table */}
                    {history.length > 0 && (
                      <div style={{ border: '1px solid #222', borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{
                          padding: '10px 14px', background: '#161616',
                          borderBottom: '1px solid #222',
                          fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 1,
                        }}>
                          All Compute Events
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #1a1a1a' }}>
                              {['Date', 'Score', 'Tier', 'Confidence', 'Reason'].map(h => (
                                <th key={h} style={{
                                  padding: '8px 12px', textAlign: 'left',
                                  color: '#555', fontWeight: 600, fontSize: 10,
                                  textTransform: 'uppercase', letterSpacing: 0.5,
                                }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {shownHistory.map((h, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid #161616' }}>
                                <td style={tdStyle}>{fmtDate(h.computed_at)}</td>
                                <td style={{ ...tdStyle, color: scoreToColor(h.wiqs_score).text, fontWeight: 700 }}>
                                  {fmtScore(h.wiqs_score)}
                                </td>
                                <td style={{ padding: '8px 12px' }}><Badge tier={h.wiqs_tier} /></td>
                                <td style={{ padding: '8px 12px', color: '#888' }}>{fmtPct(h.wiqs_confidence)}</td>
                                <td style={{ padding: '8px 12px' }}>
                                  <span style={{
                                    fontSize: 9, padding: '2px 8px', borderRadius: 10,
                                    background: `${REASON_COLORS[h.compute_reason] ?? '#555'}22`,
                                    color: REASON_COLORS[h.compute_reason] ?? '#777',
                                    border: `1px solid ${REASON_COLORS[h.compute_reason] ?? '#555'}44`,
                                  }}>
                                    {h.compute_reason?.replace(/_/g, ' ')}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {history.length > 10 && !showAllHistory && (
                          <div style={{ padding: '10px 14px', textAlign: 'center', borderTop: '1px solid #1a1a1a' }}>
                            <button onClick={() => setShowAllHistory(true)}
                              style={{ background: 'none', border: 'none', color: '#c9a84c', fontSize: 11, cursor: 'pointer' }}>
                              Show all {history.length} events ↓
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
            </>
          )}
        </>
      )}

      {/* Batch confirm modal */}
      {batchConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
        }}>
          <div style={{
            background: '#1a1a1a', border: '1px solid #333',
            borderRadius: 12, padding: '24px 28px', maxWidth: 380,
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 10 }}>
              Confirm batch recompute
            </div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 20 }}>
              Recompute WIQS scores for{' '}
              <b style={{ color: '#c9a84c' }}>
                {batchConfirm === 'all' ? `all ${wines.length.toLocaleString()} wines` : 'low confidence wines'}
              </b>.
              This may take a minute.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setBatchConfirm(null)}
                style={{ ...pageBtn, padding: '7px 16px', fontSize: 12 }}>
                Cancel
              </button>
              <button onClick={() => runBatch(batchConfirm)}
                style={{
                  padding: '7px 16px', fontSize: 12, fontWeight: 600,
                  background: '#c9a84c', color: '#111', border: 'none',
                  borderRadius: 6, cursor: 'pointer',
                }}>
                Recompute
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Style tokens ──────────────────────────────────────────────────────────────
const pillStyle = {
  fontSize: 11, padding: '4px 10px', borderRadius: 20,
  background: '#1e1e1e', border: '1px solid #2a2a2a', color: '#888',
}
const inputStyle = {
  background: '#1a1a1a', border: '1px solid #2a2a2a',
  color: '#ccc', borderRadius: 6, padding: '6px 10px',
  fontSize: 12, outline: 'none', minWidth: 220,
}
const selectStyle = {
  background: '#1a1a1a', border: '1px solid #2a2a2a',
  color: '#888', borderRadius: 6, padding: '6px 10px',
  fontSize: 11, cursor: 'pointer',
}
const tdStyle = {
  padding: '9px 12px', color: '#888',
  overflow: 'hidden', textOverflow: 'ellipsis',
  whiteSpace: 'nowrap', maxWidth: 130,
}
const pageBtn = {
  background: '#1a1a1a', border: '1px solid #2a2a2a',
  color: '#888', borderRadius: 5, padding: '4px 10px',
  cursor: 'pointer', fontSize: 12,
}
