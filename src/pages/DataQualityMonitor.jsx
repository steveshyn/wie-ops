import { useState, useEffect, useCallback } from 'react'
import { getDataQualitySummary, getDataQualityWines } from '../api/client'
import LoadingSpinner from '../components/LoadingSpinner'

const CERT_COLORS = {
  certified:    '#16a34a',
  needs_review: '#f59e0b',
  rejected:     '#dc2626',
}

function CertCard({ label, count, pct, color }) {
  return (
    <div style={{
      flex: 1, background: 'var(--bg-card)', border: `1px solid ${color}33`,
      borderRadius: 8, padding: '20px 24px', borderLeft: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1.1, marginBottom: 4, fontFamily: 'monospace' }}>
        {count?.toLocaleString() ?? '\u2014'}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{pct != null ? `${pct}%` : ''}</div>
    </div>
  )
}

function ScoreBar({ band, count, maxCount }) {
  const width = maxCount > 0 ? (count / maxCount) * 100 : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
      <span style={{ width: 50, textAlign: 'right', fontSize: 12, color: 'var(--text-dim)', fontFamily: 'monospace' }}>{band}</span>
      <div style={{ flex: 1, height: 18, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${width}%`, height: '100%', background: 'var(--gold)', borderRadius: 3, transition: 'width 300ms' }} />
      </div>
      <span style={{ width: 60, fontSize: 12, color: 'var(--text-dim)', fontFamily: 'monospace' }}>{count.toLocaleString()}</span>
    </div>
  )
}

function EnrichmentTable({ data }) {
  if (!data) return null
  const total = data.total || 1
  const rows = [
    { label: 'LWIN matched',    val: data.has_lwin },
    { label: 'BLS score',       val: data.has_bls },
    { label: 'Real soil data',  val: data.has_real_soil },
    { label: 'Climate data',    val: data.has_climate },
    { label: 'Prestige entry',  val: data.has_prestige },
    { label: 'Fully enriched',  val: data.fully_enriched, highlight: true },
  ]
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr style={{ color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left' }}>
          <th style={{ padding: '8px 12px' }}>Signal</th>
          <th style={{ padding: '8px 12px' }}>Count</th>
          <th style={{ padding: '8px 12px' }}>Coverage</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.label} style={{
            borderTop: '1px solid var(--border)',
            background: r.highlight ? 'rgba(201,168,76,0.08)' : undefined,
          }}>
            <td style={{ padding: '8px 12px', color: r.highlight ? 'var(--gold)' : 'var(--text)', fontWeight: r.highlight ? 600 : 400 }}>{r.label}</td>
            <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{(r.val ?? 0).toLocaleString()}</td>
            <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: 'var(--text-dim)' }}>{((r.val ?? 0) / total * 100).toFixed(1)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ProtectedTiers({ data }) {
  if (!data) return null
  const allOk = data.status === 'healthy'
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 16, color: allOk ? '#16a34a' : '#dc2626' }}>{allOk ? '\uD83D\uDEE1\uFE0F' : '\u26A0\uFE0F'}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: allOk ? '#16a34a' : '#dc2626' }}>
          {allOk ? 'All Protected' : 'VIOLATION'}
        </span>
      </div>
      {data.wines?.map(w => (
        <div key={w.fid} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 0', fontSize: 12, borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ color: w.ok ? '#16a34a' : '#dc2626', fontSize: 14 }}>{w.ok ? '\u2713' : '\u2717'}</span>
          <span style={{ color: 'var(--text-dim)', fontFamily: 'monospace', width: 50 }}>fid={w.fid}</span>
          <span style={{ color: 'var(--text)', flex: 1 }}>{w.name}</span>
          <span style={{ fontFamily: 'monospace', color: w.ok ? 'var(--text-dim)' : '#dc2626', fontSize: 11 }}>{w.tier}</span>
        </div>
      ))}
      <div style={{ marginTop: 8, fontSize: 11, color: data.trigger_active ? '#16a34a' : '#dc2626' }}>
        DB trigger: enforce_protected_tiers {data.trigger_active ? '\u2713' : '\u2717 MISSING'}
      </div>
    </div>
  )
}

function KnownIssueCard({ issue }) {
  const [expanded, setExpanded] = useState(false)
  const sevColors = { high: '#dc2626', medium: '#f59e0b', low: '#555' }
  const hasWines = issue.wines && issue.wines.length > 0

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 6, padding: '12px 16px', marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          color: sevColors[issue.severity] || '#555',
          background: `${sevColors[issue.severity] || '#555'}22`,
          padding: '1px 6px', borderRadius: 3,
        }}>{issue.severity}</span>
        <span style={{ fontSize: 13, color: 'var(--text)' }}>{issue.description}</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
        {issue.count > 0 && <span>{issue.count.toLocaleString()} wines affected</span>}
        {issue.fix_available && !issue.fix_command && (
          <span style={{ marginLeft: 12 }}>Fix: {issue.fix_session}</span>
        )}
      </div>

      {/* Expandable wine list */}
      {hasWines && (
        <div style={{ marginTop: 8 }}>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              background: 'none', border: 'none', padding: 0,
              color: 'var(--gold)', fontSize: 11, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <span style={{
              display: 'inline-block', transition: 'transform 150ms',
              transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            }}>{'\u25B6'}</span>
            {expanded ? 'Hide' : 'Show'} {issue.wines.length} wines
          </button>
          {expanded && (
            <div style={{
              marginTop: 6, padding: '8px 12px',
              background: 'var(--bg)', borderRadius: 4,
              fontSize: 12, lineHeight: 1.8,
            }}>
              {issue.wines.map((w, i) => (
                <div key={i} style={{ color: 'var(--text-dim)' }}>
                  <span style={{ fontFamily: 'monospace', color: 'var(--text-dim)', marginRight: 8 }}>
                    fid={issue.fids?.[i]}
                  </span>
                  <span style={{ color: 'var(--text)' }}>{w}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Fix command */}
      {issue.fix_command && (
        <div style={{
          marginTop: 8, padding: '6px 10px',
          background: 'var(--bg)', borderRadius: 4, fontFamily: 'monospace',
          fontSize: 11, color: 'var(--text-dim)', overflowX: 'auto',
        }}>
          $ {issue.fix_command}
        </div>
      )}

      {/* Self-healing tag */}
      {issue.self_healing && (
        <div style={{ marginTop: 6, fontSize: 11, fontStyle: 'italic', color: 'var(--text-dim)' }}>
          Resolves automatically after WIQS enrichment runs on these families
        </div>
      )}
    </div>
  )
}

function KnownIssues({ issues }) {
  if (!issues?.length) return null
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Known Issues</h3>
        <span style={{
          background: 'var(--bg-hover)', color: 'var(--text-dim)', fontSize: 11,
          padding: '1px 8px', borderRadius: 10, fontFamily: 'monospace',
        }}>{issues.length}</span>
      </div>
      {issues.map(issue => (
        <KnownIssueCard key={issue.id} issue={issue} />
      ))}
    </div>
  )
}

const STATUS_FILTERS = ['all', 'certified', 'needs_review', 'rejected']

function WineTable({ initialStatus }) {
  const [wines, setWines]     = useState([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState(initialStatus || 'all')
  const [page, setPage]       = useState(0)
  const LIMIT = 50

  const fetchWines = useCallback(async () => {
    setLoading(true)
    try {
      const params = { limit: LIMIT, offset: page * LIMIT }
      if (filter !== 'all') params.status = filter
      const res = await getDataQualityWines(params)
      setWines(res.wines || [])
      setTotal(res.total || 0)
    } catch { setWines([]) }
    finally { setLoading(false) }
  }, [filter, page])

  useEffect(() => { fetchWines() }, [fetchWines])
  useEffect(() => { setPage(0) }, [filter])

  const Check = ({ ok }) => (
    <span style={{ color: ok ? '#16a34a' : '#555', fontSize: 12 }}>{ok ? '\u2713' : '\u2014'}</span>
  )

  const scoreColor = (s) => {
    if (s == null) return 'var(--text-dim)'
    if (s >= 70) return '#16a34a'
    if (s >= 40) return '#f59e0b'
    return '#dc2626'
  }

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {STATUS_FILTERS.map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{
            background: filter === s ? 'var(--bg-hover)' : 'transparent',
            border: `1px solid ${filter === s ? 'var(--gold-dim)' : 'var(--border)'}`,
            color: filter === s ? 'var(--gold)' : 'var(--text-dim)',
            padding: '4px 12px', borderRadius: 4, fontSize: 12, textTransform: 'capitalize',
          }}>
            {s === 'all' ? 'All' : s.replace('_', ' ')}
          </button>
        ))}
        <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 8 }}>{total.toLocaleString()} wines</span>
      </div>

      {loading ? <LoadingSpinner /> : (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 900 }}>
            <thead>
              <tr style={{ color: 'var(--text-dim)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '10px 12px' }}>Wine</th>
                <th style={{ padding: '10px 12px' }}>Producer</th>
                <th style={{ padding: '10px 12px' }}>Country</th>
                <th style={{ padding: '10px 12px' }}>WIQS</th>
                <th style={{ padding: '10px 12px' }}>DQ Score</th>
                <th style={{ padding: '10px 12px' }}>Status</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>LWIN</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>Soil</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>Climate</th>
              </tr>
            </thead>
            <tbody>
              {wines.map(w => (
                <tr key={w.id} style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <td style={{ padding: '8px 12px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.wine_name || '\u2014'}</td>
                  <td style={{ padding: '8px 12px', color: 'var(--text-dim)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.producer_name}</td>
                  <td style={{ padding: '8px 12px', color: 'var(--text-dim)' }}>{w.country || '\u2014'}</td>
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: 'var(--gold)' }}>{w.best_wiqs?.toFixed(1) ?? '\u2014'}</td>
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600, color: scoreColor(w.data_quality_score) }}>
                    {w.data_quality_score?.toFixed(1) ?? '\u2014'}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                      color: CERT_COLORS[w.certification_status] || '#555',
                      background: `${CERT_COLORS[w.certification_status] || '#555'}22`,
                      padding: '2px 6px', borderRadius: 3,
                    }}>{(w.certification_status || '').replace('_', ' ')}</span>
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}><Check ok={w.has_lwin} /></td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}><Check ok={w.has_soil} /></td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}><Check ok={w.has_climate} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > LIMIT && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'center' }}>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-dim)', padding: '4px 12px', borderRadius: 4, fontSize: 12, opacity: page === 0 ? 0.4 : 1 }}>
            Prev
          </button>
          <span style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: '28px' }}>
            Page {page + 1} of {Math.ceil(total / LIMIT)}
          </span>
          <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * LIMIT >= total}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-dim)', padding: '4px 12px', borderRadius: 4, fontSize: 12, opacity: (page + 1) * LIMIT >= total ? 0.4 : 1 }}>
            Next
          </button>
        </div>
      )}
      {/* Row detail view — Phase 1b */}
    </div>
  )
}

export default function DataQualityMonitor() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const fetchSummary = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setSummary(await getDataQualitySummary())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSummary() }, [fetchSummary])

  if (loading) return <LoadingSpinner />
  if (error) return <div style={{ color: 'var(--red)', padding: 32 }}>Error: {error}</div>

  const cert = summary?.certification
  const dist = summary?.score_distribution || []
  const maxCount = Math.max(...dist.map(d => d.count), 1)

  return (
    <div>
      {/* Section 1 — Certification Overview */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <CertCard label="Certified" count={cert?.certified} pct={cert?.certified_pct} color={CERT_COLORS.certified} />
        <CertCard label="Needs Review" count={cert?.needs_review} pct={cert?.total ? (cert.needs_review / cert.total * 100).toFixed(1) : null} color={CERT_COLORS.needs_review} />
        <CertCard label="Rejected" count={cert?.rejected} pct={cert?.total ? (cert.rejected / cert.total * 100).toFixed(1) : null} color={CERT_COLORS.rejected} />
      </div>

      {/* Gate inactive notice */}
      <div style={{
        background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
        borderRadius: 6, padding: '12px 16px', marginBottom: 24,
        display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#f59e0b',
      }}>
        <span style={{ fontSize: 16 }}>{'\u26A0\uFE0F'}</span>
        <span>
          Certification gate inactive &mdash; formula calibration in progress (Phase 1b).
          All wines currently deploy to Palate regardless of certification status.
        </span>
      </div>

      {/* Score Distribution */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '20px 24px', marginBottom: 24 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: '0 0 16px' }}>Score Distribution</h3>
        {dist.map(d => <ScoreBar key={d.band} band={d.band} count={d.count} maxCount={maxCount} />)}
      </div>

      {/* Section 2 — Two columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* Enrichment Depth */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '20px 24px' }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: '0 0 12px' }}>Enrichment Depth</h3>
          <EnrichmentTable data={summary?.enrichment_depth} />
        </div>

        {/* Protected Tiers */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '20px 24px' }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: '0 0 12px' }}>Protected Tiers</h3>
          <ProtectedTiers data={summary?.protected_tiers} />
        </div>
      </div>

      {/* Section 3 — Known Issues */}
      <div style={{ marginBottom: 24 }}>
        <KnownIssues issues={summary?.known_issues} />
      </div>

      {/* Wine Table */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Wine Quality Table</h3>
        <WineTable />
      </div>
    </div>
  )
}
