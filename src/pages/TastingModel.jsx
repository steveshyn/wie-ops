import { useState, useEffect, useCallback } from 'react'
import { getTastingModelDashboard } from '../api/client'
import StatCard from '../components/StatCard'
import LoadingSpinner from '../components/LoadingSpinner'
import { fmtScore, fmtCount, fmtDate } from '../utils/formatters'

const CLUSTER_COLORS = {
  bordeaux:   '#c9a84c',
  burgundy:   '#9b7cb8',
  nebbiolo:   '#c67a4a',
  napa:       '#2d7a4f',
  california: '#2d7a4f',
}

const MATURITY_COLORS = {
  'pre-window': '#38bdf8',
  'opening':    '#f59e0b',
  'peak':       '#4ade80',
  'late':       '#dc2626',
  'mixed':      '#666',
}

const QUALITY_COLORS = {
  icon:         '#c9a84c',
  elite:        '#e8ddd0',
  excellent:    '#4ade80',
  very_good:    '#16a34a',
  good:         '#666',
  unclassified: '#444',
}

function archetypeColor(tag) {
  if (!tag) return '#555'
  const t = tag.toLowerCase()
  if (t.includes('bordeaux') || t.includes('claret'))  return CLUSTER_COLORS.bordeaux
  if (t.includes('burgundy') || t.includes('pinot'))   return CLUSTER_COLORS.burgundy
  if (t.includes('nebbiolo') || t.includes('barolo'))  return CLUSTER_COLORS.nebbiolo
  if (t.includes('napa') || t.includes('california') || t.includes('cab')) return CLUSTER_COLORS.napa
  return '#666'
}

const Card = ({ title, children, style = {} }) => (
  <div style={{
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '20px 24px', ...style,
  }}>
    {title && (
      <div style={{
        fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 16,
      }}>{title}</div>
    )}
    {children}
  </div>
)

export default function TastingModel() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    setError(null)
    try {
      const d = await getTastingModelDashboard()
      setData(d)
    } catch (err) {
      setError(err.message || 'Failed to load tasting model data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading && !data) {
    return (
      <div style={{ padding: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--text-dim)' }}>
        <LoadingSpinner size="md" /> Loading tasting model...
      </div>
    )
  }

  if (error && !data) {
    return (
      <div style={{
        background: 'rgba(220,38,38,0.08)', border: '1px solid var(--red)',
        borderRadius: 8, padding: '12px 16px', color: 'var(--red)', fontSize: 13,
      }}>{error}</div>
    )
  }

  if (!data) return null

  const s = data.summary
  const maxArchCount = Math.max(...(data.archetype_distribution || []).map(a => a.wine_count), 1)
  const totalRollup = s.tasting_rollup_count || 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ROW 1 -- Summary cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 16,
      }}>
        <StatCard title="Tasting Events" value={fmtCount(s.tasting_events_count)} />
        <StatCard title="Rollup Wines" value={fmtCount(s.tasting_rollup_count)} />
        <StatCard title="Unresolved" value={fmtCount(s.unresolved_count)}
          accent={s.unresolved_count > 0 ? 'var(--amber)' : 'var(--green-light)'} />
        <StatCard title="Active Archetypes" value={fmtCount(s.archetype_count)} />
      </div>

      {/* ROW 2 -- Archetypes + Maturity/Quality */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* LEFT: Archetype Distribution */}
        <Card title="Archetype Distribution">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(data.archetype_distribution || []).map(a => (
              <div key={a.archetype_tag} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 140, fontSize: 11, color: 'var(--text-dim)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}>
                  {(a.archetype_tag || '').replace(/_/g, ' ')}
                </div>
                <div style={{ flex: 1, height: 18, background: '#1a1a1a', borderRadius: 3, position: 'relative' }}>
                  <div style={{
                    width: `${(a.wine_count / maxArchCount) * 100}%`,
                    height: '100%', borderRadius: 3,
                    background: archetypeColor(a.archetype_tag),
                    opacity: 0.7, transition: 'width 300ms',
                  }} />
                </div>
                <div style={{ width: 32, textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                  {a.wine_count}
                </div>
                <div style={{
                  width: 48, textAlign: 'right', fontSize: 11, color: 'var(--text-dim)',
                }}>
                  {a.avg_weighted_score != null ? fmtScore(a.avg_weighted_score) : '—'}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* RIGHT: Maturity + Quality */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Card title="Maturity Breakdown">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.entries(data.maturity_breakdown || {}).map(([key, count]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 90, fontSize: 12, color: 'var(--text-dim)', textTransform: 'capitalize' }}>
                    {key.replace(/_/g, ' ')}
                  </div>
                  <div style={{ flex: 1, height: 8, background: '#1a1a1a', borderRadius: 2 }}>
                    <div style={{
                      width: `${(count / totalRollup) * 100}%`, height: '100%',
                      borderRadius: 2,
                      background: MATURITY_COLORS[key.replace('_', '-')] || '#555',
                    }} />
                  </div>
                  <div style={{ width: 36, textAlign: 'right', fontSize: 12, color: 'var(--text)' }}>
                    {count}
                  </div>
                  <div style={{ width: 40, textAlign: 'right', fontSize: 11, color: 'var(--text-dim)' }}>
                    {((count / totalRollup) * 100).toFixed(0)}%
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Quality Bands">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {Object.entries(data.quality_band_breakdown || {}).map(([band, count]) => (
                <span key={band} style={{
                  fontSize: 12, fontWeight: 600, padding: '4px 12px',
                  borderRadius: 12,
                  background: `${QUALITY_COLORS[band] || '#444'}20`,
                  border: `1px solid ${QUALITY_COLORS[band] || '#444'}`,
                  color: QUALITY_COLORS[band] || '#777',
                }}>
                  {band.replace(/_/g, ' ')} <span style={{ opacity: 0.7, marginLeft: 4 }}>{count}</span>
                </span>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* ROW 3 -- Top wines table */}
      <Card title="Top Wines by Weighted Adjusted Score">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Producer', 'Wine', 'Vintage', 'Score', 'Archetype', 'Maturity', 'Quality', 'Tastings'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '8px 10px', fontSize: 10,
                    fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                    color: 'var(--text-dim)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data.top_wines || []).map((w, i) => (
                <tr key={i} style={{
                  borderBottom: '1px solid var(--border)',
                  transition: 'background 100ms',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '10px', color: 'var(--text)', fontFamily: 'var(--font-serif)' }}>
                    {w.producer}
                  </td>
                  <td style={{ padding: '10px', color: 'var(--text-dim)' }}>{w.wine}</td>
                  <td style={{ padding: '10px', color: 'var(--text-dim)' }}>{w.vintage}</td>
                  <td style={{ padding: '10px' }}>
                    <span style={{
                      fontSize: 16, fontWeight: 700,
                      color: w.weighted_adjusted_score_100 >= 95 ? '#c9a84c'
                           : w.weighted_adjusted_score_100 >= 90 ? '#e8ddd0'
                           : w.weighted_adjusted_score_100 >= 85 ? '#4ade80'
                           : '#777',
                    }}>
                      {fmtScore(w.weighted_adjusted_score_100)}
                    </span>
                  </td>
                  <td style={{ padding: '10px' }}>
                    {w.archetype_tag && (
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                        background: `${archetypeColor(w.archetype_tag)}20`,
                        border: `1px solid ${archetypeColor(w.archetype_tag)}`,
                        color: archetypeColor(w.archetype_tag),
                        whiteSpace: 'nowrap',
                      }}>
                        {(w.archetype_tag || '').replace(/_/g, ' ')}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '10px' }}>
                    {w.maturity_status && (
                      <span style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 4,
                        background: `${MATURITY_COLORS[w.maturity_status] || '#555'}20`,
                        color: MATURITY_COLORS[w.maturity_status] || '#777',
                      }}>
                        {w.maturity_status}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '10px', fontSize: 11, color: 'var(--text-dim)', textTransform: 'capitalize' }}>
                    {(w.quality_band || '').replace(/_/g, ' ')}
                  </td>
                  <td style={{ padding: '10px', color: 'var(--text-dim)', textAlign: 'center' }}>
                    {w.tasting_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ROW 4 -- Unresolved + Import History */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* LEFT: Unresolved Queue */}
        <Card title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Unresolved Queue
            {(data.unresolved_producers || []).length > 0 && (
              <span style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 10,
                background: 'rgba(220,38,38,0.15)', border: '1px solid var(--red)',
                color: 'var(--red)',
              }}>
                {s.unresolved_count}
              </span>
            )}
          </span>
        }>
          {(data.unresolved_producers || []).length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic' }}>
              No unresolved rows
            </div>
          ) : (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Producer', 'Count', 'Reason'].map(h => (
                      <th key={h} style={{
                        textAlign: 'left', padding: '6px 8px', fontSize: 10,
                        fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                        color: 'var(--text-dim)',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data.unresolved_producers || []).map((u, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px', color: 'var(--text)' }}>{u.producer}</td>
                      <td style={{ padding: '8px', color: 'var(--amber)', fontWeight: 600 }}>{u.count}</td>
                      <td style={{ padding: '8px', color: 'var(--text-dim)', fontSize: 11 }}>{u.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 12, fontStyle: 'italic' }}>
                These rows could not be mapped to a wine_family_id during import. Review and add mappings.
              </div>
            </>
          )}
        </Card>

        {/* RIGHT: Import History */}
        <Card title="Import History">
          {(data.import_history || []).length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic' }}>
              No imports recorded yet
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Batch ID', 'Inserted', 'Date'].map(h => (
                    <th key={h} style={{
                      textAlign: 'left', padding: '6px 8px', fontSize: 10,
                      fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                      color: 'var(--text-dim)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data.import_history || []).map((imp, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px', color: 'var(--text-dim)', fontSize: 11, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {imp.import_batch_id}
                    </td>
                    <td style={{ padding: '8px', color: 'var(--gold)', fontWeight: 600 }}>
                      {fmtCount(imp.inserted_count)}
                    </td>
                    <td style={{ padding: '8px', color: 'var(--text-dim)' }}>
                      {fmtDate(imp.imported_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  )
}
